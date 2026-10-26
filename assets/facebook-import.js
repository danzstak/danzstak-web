"use strict";
(() => {
  const API='https://api.danzstak.com';
  let dialog=null,activeWorker=null,loaded=null,running=false,stopping=false,changed=false,trigger=null;
  const selected=new Set(),profileFields=new Set();
  function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
  async function request(path,body){const response=await fetch(API+path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||(response.status===401?'Your session expired. Sign in again before importing.':'The import could not be saved. You can retry safely.'));return data;}
  async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function build(){
    dialog=node('dialog',null,'facebook-import-dialog');dialog.setAttribute('aria-labelledby','facebookImportTitle');
    dialog.innerHTML='<header><h2 id="facebookImportTitle">Import from Facebook</h2><button type="button" data-close aria-label="Close Facebook import">×</button></header><p>Bring your own profile, posts, photos, and videos to DanzStak. Your Facebook password is never needed here.</p><details class="facebook-import-help"><summary>How to get your export</summary><p>In Facebook Accounts Center, open Your information and permissions, then Download or Export your information. Export to your device in <strong>JSON format</strong>, including your posts, profile, and media. Download the ZIP when it is ready. For large histories, export shorter date ranges.</p><p>Importing makes a copy. DanzStak does not change or close your Facebook account.</p></details><label class="facebook-import-file">Choose your export<input type="file" accept=".zip,.json,application/zip,application/json"></label><p class="facebook-import-status" role="status" aria-live="polite"></p><section class="facebook-import-preview" hidden><h3>Review before importing</h3><p>Imported posts are saved as <strong>Only me</strong>. Original post dates are kept. Existing imports are skipped automatically.</p><p>Other people’s comments, likes, friends, messages, and shared third-party media are not recreated as DanzStak activity.</p><fieldset class="facebook-import-profile"><legend>Profile details (optional)</legend></fieldset><div class="facebook-import-selection"><button type="button" data-all>Select all posts</button><button type="button" data-none>Clear selection</button><span data-count></span></div><div class="facebook-import-items"></div><label class="facebook-import-certification"><input type="checkbox" data-cert><span>I created the selected content, including any music in videos, and I authorize copying it to my DanzStak account.</span></label><div class="facebook-import-actions"><button type="button" data-stop hidden>Stop after current item</button><button type="button" class="primary" data-import disabled>Import selected</button></div></section>';
    document.body.appendChild(dialog);
    const file=dialog.querySelector('input[type=file]');file.addEventListener('change',()=>read(file.files?.[0]));
    dialog.querySelector('[data-close]').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{if(running){event.preventDefault();stop();}});
    dialog.addEventListener('close',()=>{activeWorker?.terminate();activeWorker=null;loaded=null;selected.clear();profileFields.clear();if(changed)location.reload();else trigger?.focus();});
    dialog.querySelector('[data-cert]').addEventListener('change',update);
    dialog.querySelector('[data-all]').addEventListener('click',()=>{loaded?.items.forEach((_,i)=>selected.add(i));renderItems();update();});
    dialog.querySelector('[data-none]').addEventListener('click',()=>{selected.clear();renderItems();update();});
    dialog.querySelector('[data-import]').addEventListener('click',run);
    dialog.querySelector('[data-stop]').addEventListener('click',stop);
  }
  const status=message=>{dialog.querySelector('.facebook-import-status').textContent=message;};
  function close(){if(running){stop();return;}dialog.close();}
  function stop(){stopping=true;dialog.querySelector('[data-stop]').disabled=true;status('Stopping after the current item finishes. Completed imports are kept.');}
  function update(){const n=selected.size+profileFields.size;dialog.querySelector('[data-import]').disabled=running||!n||!dialog.querySelector('[data-cert]').checked;dialog.querySelector('[data-count]').textContent=selected.size+' posts selected';}
  async function read(file){
    if(!file||running)return;activeWorker?.terminate();selected.clear();profileFields.clear();loaded=null;
    dialog.querySelector('.facebook-import-preview').hidden=true;dialog.querySelector('[data-cert]').checked=false;
    if(file.size>200*1024*1024){status('Choose an export smaller than 200 MB. Export a shorter date range if needed.');return;}
    status('Reading your export on this device. Nothing has been uploaded.');
    const worker=activeWorker=new Worker('assets/facebook-import-worker.js');
    const timeout=setTimeout(()=>{if(activeWorker===worker){worker.terminate();activeWorker=null;status('Reading took too long. Try a smaller export.');}},30000);
    worker.onerror=()=>{clearTimeout(timeout);if(activeWorker!==worker)return;worker.terminate();activeWorker=null;status('The export reader could not start. Update DanzStak and try again.');};
    worker.onmessage=event=>{clearTimeout(timeout);if(activeWorker!==worker)return;worker.terminate();activeWorker=null;if(!event.data.ok){status(event.data.error);return;}loaded=event.data.result;render();};
    try{const buffer=await file.arrayBuffer();if(activeWorker===worker)worker.postMessage({name:file.name,buffer},[buffer]);}catch{clearTimeout(timeout);worker.terminate();activeWorker=null;status('The selected file could not be read.');}
  }
  function render(){
    dialog.querySelector('.facebook-import-preview').hidden=false;
    const fields=dialog.querySelector('.facebook-import-profile');fields.replaceChildren(node('legend','Profile details (optional)'));
    const names={name:'Display name',bio:'Bio',location:'Location',work:'Work'};
    for(const [key,value] of Object.entries(loaded.profile)){const label=node('label'),checkbox=node('input');checkbox.type='checkbox';checkbox.dataset.profileField=key;checkbox.addEventListener('change',()=>{checkbox.checked?profileFields.add(key):profileFields.delete(key);update();});label.append(checkbox,node('span',names[key]+': '+value));fields.append(label);}
    fields.hidden=!Object.keys(loaded.profile).length;renderItems();update();
    const skipped=Object.values(loaded.warnings).reduce((a,b)=>a+b,0);status('Found '+loaded.items.length+' posts or media attachments. Nothing has been uploaded.'+(skipped?' '+skipped+' unsupported, missing, or invalid items were skipped.':''));
  }
  function renderItems(){
    const list=dialog.querySelector('.facebook-import-items');list.replaceChildren();
    if(!loaded?.items.length){list.append(node('p','No supported posts were found in this export.'));return;}
    const show=(start=0)=>{for(let i=start;i<Math.min(start+100,loaded.items.length);i++){
      const item=loaded.items[i],row=node('div',null,'facebook-import-item'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=selected.has(i);checkbox.setAttribute('aria-label','Import post from '+new Date(item.originalCreatedAt).toLocaleDateString()+': '+item.content.slice(0,70));checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(i):selected.delete(i);update();});
      const details=node('details'),summary=node('summary',new Date(item.originalCreatedAt).toLocaleDateString()+' · '+item.content.slice(0,100));details.append(summary,node('p',item.content));
      if(item.mediaPath){details.append(node('p',(item.mediaType.startsWith('video/')?'Video: ':'Photo: ')+item.mediaPath));const preview=node('button','Preview media');preview.type='button';preview.addEventListener('click',()=>{const file=loaded.media.find(m=>m.name===item.mediaPath);if(!file)return;const url=URL.createObjectURL(new Blob([file.bytes],{type:file.type})),media=node(file.type.startsWith('video/')?'video':'img');media.src=url;if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';}else media.alt='Selected Facebook export photo';media.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});preview.replaceWith(media);});details.append(preview);}
      row.append(checkbox,details);list.append(row);
    }if(start+100<loaded.items.length){const more=node('button','Show more posts');more.type='button';more.addEventListener('click',()=>{more.remove();show(start+100);});list.append(more);}};show();
  }
  async function upload(item){
    if(!item.mediaPath)return {};
    const file=loaded.media.find(m=>m.name===item.mediaPath);if(!file||file.bytes.byteLength>100*1024*1024)throw Error('A selected media file is missing or larger than 100 MB. Clear that item and retry.');
    const ticket=await request('/stories',{contentType:file.type,purpose:'post'});
    const uploaded=await fetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:new Blob([file.bytes],{type:file.type})});if(!uploaded.ok)throw Error('Media upload failed. Completed imports are kept; retry when the connection is stable.');
    return {mediaKey:ticket.mediaKey,mediaType:file.type.startsWith('video/')?'video':'image'};
  }
  async function run(){
    if(running||!loaded||!dialog.querySelector('[data-cert]').checked||(!selected.size&&!profileFields.size))return;
    running=true;stopping=false;const controls=[...dialog.querySelectorAll('input,button')];controls.forEach(el=>el.disabled=true);const stopButton=dialog.querySelector('[data-stop]');stopButton.hidden=false;stopButton.disabled=false;let imported=0,duplicates=0;
    try{
      const chosen=[...selected];for(let index=0;index<chosen.length;index++){
        if(stopping)break;const i=chosen[index],item=loaded.items[i];status('Importing '+(index+1)+' of '+chosen.length+'…');
        const mediaFile=item.mediaPath?loaded.media.find(file=>file.name===item.mediaPath):null;
        const mediaHash=mediaFile?[...new Uint8Array(await crypto.subtle.digest("SHA-256",mediaFile.bytes))].map(x=>x.toString(16).padStart(2,"0")).join(""):"";
        const importKey=await digest(JSON.stringify([item.identity,mediaHash])),base={importSource:'facebook',importKey};const check=await request('/secure-posts',{...base,importCheckOnly:true});
        if(check.exists){duplicates++;selected.delete(i);continue;}
        const media=await upload(item);const result=await request('/secure-posts',{...base,content:item.content,originalCreatedAt:item.originalCreatedAt,originalContentCertified:true,audience:'private',...media});
        if(result.deduplicated)duplicates++;else{imported++;changed=true;}selected.delete(i);
      }
      if(!stopping&&profileFields.size){const changes=Object.fromEntries([...profileFields].map(key=>[key,loaded.profile[key]]));await request('/profiles',changes);profileFields.clear();changed=true;}
      status((stopping?'Stopped. ':'Finished. ')+imported+' posts imported as Only me. '+duplicates+' duplicates skipped.'+(selected.size?' '+selected.size+' posts remain selected.':'')+' Close this window to refresh your profile.');
    }catch(error){status(error.message+' '+imported+' posts were imported; retrying will skip completed items.');}
    finally{running=false;controls.forEach(el=>el.disabled=false);stopButton.hidden=true;dialog.querySelectorAll("[data-profile-field]").forEach(field=>{field.checked=profileFields.has(field.dataset.profileField);});renderItems();update();}
  }
  window.openDanzStakFacebookImport=button=>{if(!dialog)build();trigger=button||document.activeElement;changed=false;dialog.querySelector('input[type=file]').value='';dialog.querySelector('.facebook-import-preview').hidden=true;status('Your export stays on this device until you choose items and press Import selected.');dialog.showModal();};
})();
