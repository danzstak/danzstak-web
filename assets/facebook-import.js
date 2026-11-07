"use strict";
(() => {
  const API='https://api.danzstak.com';
  let dialog=null,activeWorker=null,loaded=null,running=false,stopping=false,changed=false,trigger=null;
  const selected=new Set(),profileFields=new Set(),sharedApprovals=new Set(),missingMediaApprovals=new Set(),itemAudiences=new Map();
  function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
  async function importFetch(url,options={},timeoutMs=15000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(url,{...options,signal:controller.signal});}catch(error){if(error?.name==='AbortError')throw Error('The import took too long. Completed items are kept; check your connection and retry.');throw Error('DanzStak cannot continue the import right now. Completed items are kept; check your connection and retry.');}finally{clearTimeout(timer);}}
  function importUploadDeadline(byteLength){return Math.max(120000,Math.ceil((Number(byteLength)||0)/(64*1024))*1000);}
  async function request(path,body){const response=await importFetch(API+path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||(response.status===401?'Your session expired. Sign in again before importing.':'The import could not be saved. You can retry safely.'));return data;}
  async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function build(){
    dialog=node('dialog',null,'facebook-import-dialog');dialog.setAttribute('aria-labelledby','facebookImportTitle');
    dialog.innerHTML='<header><div><p class="facebook-import-kicker">Pivot · Moving Day</p><h2 id="facebookImportTitle">Move from Facebook</h2></div><button type="button" data-close aria-label="Close Moving Day">×</button></header><p class="facebook-import-intro">Clean house before you move. Nothing comes to DanzStak until you choose it.</p><ol class="facebook-import-steps" aria-label="Moving Day steps"><li class="is-current"><span>1</span><strong>Choose export</strong></li><li><span>2</span><strong>Pick what moves</strong></li><li><span>3</span><strong>Set privacy</strong></li></ol><details class="facebook-import-help"><summary>How to get your Facebook export</summary><p>In Facebook Accounts Center, open Your information and permissions, then Download or Export your information. Export to your device in <strong>JSON format</strong>, including your posts, profile, and media. Download the ZIP when it is ready. For large histories, export shorter date ranges.</p><p>Importing makes a copy. DanzStak does not change or close your Facebook account, and your Facebook password is never needed here.</p></details><label class="facebook-import-file"><strong>Step 1 — Choose your export</strong><span>ZIP or JSON · read on this device first</span><input type="file" accept=".zip,.json,application/zip,application/json"></label><p class="facebook-import-status" role="status" aria-live="polite"></p><section class="facebook-import-preview" hidden><h3>Step 2 — Pick exactly what moves</h3><p>No posts or profile details are selected for you. Choose individual items, or use a date range. Original dates stay attached and completed imports are safely skipped if you retry.</p><fieldset class="facebook-import-profile"><legend>Profile details (optional)</legend></fieldset><div class="facebook-import-date-range" aria-labelledby="facebookImportDateRange"><strong id="facebookImportDateRange">Choose posts by date (optional)</strong><label>From<input type="date" data-date-from></label><label>Through<input type="date" data-date-to></label><button type="button" data-select-range>Select date range</button></div><div class="facebook-import-selection"><button type="button" data-all>Select all posts</button><button type="button" data-none>Clear selection</button><strong data-count>No posts selected</strong></div><div class="facebook-import-items"></div><section class="facebook-import-privacy-step" aria-labelledby="facebookImportPrivacy"><h3 id="facebookImportPrivacy">Step 3 — Choose privacy</h3><p>Everything starts as <strong>Just me</strong>. You can choose Friends or Public for the selected copies, or set a different audience on an individual post.</p><label class="facebook-import-audience">Default privacy for selected posts<select data-audience><option value="private" selected>Just me</option><option value="friends">Friends</option><option value="public">Public</option></select></label><p>Shared posts keep their source link. Media is copied only when Facebook included the actual file in your export.</p></section><label class="facebook-import-certification"><input type="checkbox" data-cert><span>I created the selected content and any uploaded media, including music in videos. Shared-source links remain attributed to their original source.</span></label><div class="facebook-import-actions"><button type="button" data-stop hidden>Stop after current item</button><button type="button" class="primary" data-import disabled>Move selected items</button></div></section>';
    const next=node('section',null,'facebook-import-next');
    next.dataset.next='';next.hidden=true;next.setAttribute('aria-labelledby','movingDayNext');
    next.innerHTML='<p class="facebook-import-kicker">Your next move</p><h3 id="movingDayNext">Make DanzStak yours</h3><p>Your history is here. Now finish your profile, build an EPK, invite your people, or join the conversation in Mix.</p><nav aria-label="Continue after Moving Day"><a href="profile.html?edit=1">Finish profile</a><a href="epk.html">Build my EPK</a><a href="feed.html?view=friends">Invite my people</a><a href="feed.html?view=feed">Open Mix</a></nav>';
    dialog.querySelector('.facebook-import-preview').append(next);
    document.body.appendChild(dialog);
    const file=dialog.querySelector('input[type=file]');file.addEventListener('change',()=>read(file.files?.[0]));
    dialog.querySelector('[data-close]').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{if(running){event.preventDefault();stop();}});
    dialog.addEventListener('close',()=>{activeWorker?.terminate();activeWorker=null;loaded=null;selected.clear();profileFields.clear();sharedApprovals.clear();missingMediaApprovals.clear();itemAudiences.clear();if(changed)location.reload();else trigger?.focus();});
    dialog.querySelector('[data-cert]').addEventListener('change',update);
    dialog.querySelector('[data-all]').addEventListener('click',()=>{loaded?.items.forEach((_,i)=>selected.add(i));renderItems();update();});
    dialog.querySelector('[data-none]').addEventListener('click',()=>{selected.clear();renderItems();update();});
    dialog.querySelector('[data-select-range]').addEventListener('click',selectDateRange);
    dialog.querySelector('[data-import]').addEventListener('click',run);
    dialog.querySelector('[data-stop]').addEventListener('click',stop);
  }
  const status=message=>{dialog.querySelector('.facebook-import-status').textContent=message;};
  function allowFileRetry(){const input=dialog?.querySelector('input[type=file]');if(input)input.value='';}
  function close(){if(running){stop();return;}dialog.close();}
  function stop(){stopping=true;dialog.querySelector('[data-stop]').disabled=true;status('Stopping after the current item finishes. Completed imports are kept.');}
  function selectDateRange(){
    if(!loaded?.items.length)return;
    const from=dialog.querySelector('[data-date-from]').value,to=dialog.querySelector('[data-date-to]').value;
    if(!from&&!to){status('Choose a From or Through date, then select the date range.');return;}
    if(from&&to&&from>to){status('The From date must be before the Through date.');return;}
    selected.clear();
    loaded.items.forEach((item,index)=>{const day=String(item.originalCreatedAt||'').slice(0,10);if(day&&(!from||day>=from)&&(!to||day<=to))selected.add(index);});
    renderItems();update();status(selected.size+' posts selected in that date range. Review each post before importing.');
  }
  function update(){const n=selected.size+profileFields.size,unapprovedShared=[...selected].filter(i=>loaded?.items[i]?.sharedSource&&!sharedApprovals.has(i)).length,unapprovedMissing=[...selected].filter(i=>loaded?.items[i]?.missingMedia&&!missingMediaApprovals.has(i)).length,unapproved=unapprovedShared+unapprovedMissing,button=dialog.querySelector('[data-import]');button.disabled=running||!n||!dialog.querySelector('[data-cert]').checked||unapproved>0;button.textContent=n?`Move ${n} selected item${n===1?'':'s'}`:'Move selected items';const review=[];if(unapprovedShared)review.push(unapprovedShared+' shared source'+(unapprovedShared===1?'':'s'));if(unapprovedMissing)review.push(unapprovedMissing+' missing attachment'+(unapprovedMissing===1?'':'s'));dialog.querySelector('[data-count]').textContent=selected.size?selected.size+' post'+(selected.size===1?'':'s')+' selected'+(review.length?' · review '+review.join(' and '):''):'No posts selected';}
  async function read(file){
    if(!file||running)return;activeWorker?.terminate();selected.clear();profileFields.clear();sharedApprovals.clear();missingMediaApprovals.clear();itemAudiences.clear();loaded=null;
    dialog.querySelector('.facebook-import-preview').hidden=true;dialog.querySelector('[data-next]').hidden=true;dialog.querySelector('[data-cert]').checked=false;
    if(file.size>200*1024*1024){allowFileRetry();status('Choose an export smaller than 200 MB. Export a shorter date range, then choose the export again.');return;}
    status('Reading your export on this device. Nothing has been uploaded.');
    const worker=activeWorker=new Worker('assets/facebook-import-worker.js');
    const timeout=setTimeout(()=>{if(activeWorker===worker){worker.terminate();activeWorker=null;allowFileRetry();status('Reading took too long. Try a smaller export, then choose it again.');}},30000);
    worker.onerror=()=>{clearTimeout(timeout);if(activeWorker!==worker)return;worker.terminate();activeWorker=null;allowFileRetry();status('The export reader could not start. Update DanzStak, then choose the export again.');};
    worker.onmessage=event=>{clearTimeout(timeout);if(activeWorker!==worker)return;worker.terminate();activeWorker=null;if(!event.data.ok){allowFileRetry();status(event.data.error+' Choose the export again after fixing it.');return;}loaded=event.data.result;render();};
    try{const buffer=await file.arrayBuffer();if(activeWorker===worker)worker.postMessage({name:file.name,buffer},[buffer]);}catch{clearTimeout(timeout);worker.terminate();activeWorker=null;allowFileRetry();status('The selected file could not be read. Choose the export again.');}
  }
  function render(){
    dialog.querySelector('.facebook-import-preview').hidden=false;
    const fields=dialog.querySelector('.facebook-import-profile');fields.replaceChildren(node('legend','Profile details (optional)'));
    const names={name:'Display name',bio:'Bio',location:'Location',work:'Work'};
    for(const [key,value] of Object.entries(loaded.profile)){const label=node('label'),checkbox=node('input');checkbox.type='checkbox';checkbox.dataset.profileField=key;checkbox.addEventListener('change',()=>{checkbox.checked?profileFields.add(key):profileFields.delete(key);update();});label.append(checkbox,node('span',names[key]+': '+value));fields.append(label);}
    fields.hidden=!Object.keys(loaded.profile).length;renderItems();update();
    const skipped=Object.values(loaded.warnings).reduce((a,b)=>a+b,0);status('Found '+loaded.items.length+' posts or media attachments. Nothing has been uploaded.'+(skipped?' '+skipped+' unsupported, missing, or invalid items were skipped.':''));
    requestAnimationFrame(()=>dialog.scrollTo({top:0}));
  }
  function renderItems(){
    const list=dialog.querySelector('.facebook-import-items');list.replaceChildren();
    if(!loaded?.items.length){list.append(node('p','No supported posts were found in this export.'));return;}
    const show=(start=0)=>{for(let i=start;i<Math.min(start+100,loaded.items.length);i++){
      const item=loaded.items[i],row=node('div',null,'facebook-import-item'),choice=node('label',null,'facebook-import-choice'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=selected.has(i);checkbox.setAttribute('aria-label','Move post from '+new Date(item.originalCreatedAt).toLocaleDateString()+': '+item.content.slice(0,70));checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(i):selected.delete(i);update();});choice.append(checkbox,node('span','Move'));
      const kind=item.mediaType?.startsWith('video/')?'Video':item.mediaType?.startsWith('image/')?'Photo':'Post',details=node('details'),summary=node('summary',new Date(item.originalCreatedAt).toLocaleDateString()+' · '+kind+(item.content?' · '+item.content.slice(0,88):''));details.append(summary,node('p',item.content||kind+' from your Facebook export'));
      const audienceLabel=node('label',null,'facebook-import-item-audience'),audienceSelect=node('select');audienceLabel.append(node('span','Audience'),audienceSelect);for(const [value,label] of [['','Use import default'],['public','Public'],['friends','Friends'],['private','Just me']]){const option=node('option',label);option.value=value;audienceSelect.append(option);}audienceSelect.value=itemAudiences.get(i)||'';audienceSelect.addEventListener('change',()=>{audienceSelect.value?itemAudiences.set(i,audienceSelect.value):itemAudiences.delete(i);});details.append(audienceLabel);
      if(item.sharedSource){const shared=node('label',null,'facebook-import-shared');const approval=node('input');approval.type='checkbox';approval.checked=sharedApprovals.has(i);approval.setAttribute('aria-label','Include shared source from '+item.sharedSource.title);approval.addEventListener('change',()=>{approval.checked?sharedApprovals.add(i):sharedApprovals.delete(i);update();});const copy=node('span');copy.append(node('strong','Shared from '+item.sharedSource.title),node('span',' Include this post and preserve the original source link. The external image is copied only when its file is included in your export.'));shared.append(approval,copy);details.append(shared);}
      if(item.missingMedia){const missing=node('label',null,'facebook-import-missing');const approval=node('input');approval.type='checkbox';approval.checked=missingMediaApprovals.has(i);approval.setAttribute('aria-label','Import this post without its missing attachment');approval.addEventListener('change',()=>{approval.checked?missingMediaApprovals.add(i):missingMediaApprovals.delete(i);update();});const copy=node('span');copy.append(node('strong','Attachment missing from the Facebook export'),node('span',' Import this post as text only. To keep the photo or video, request another Facebook export that includes media.'));missing.append(approval,copy);details.append(missing);}
      if(item.mediaPath){details.append(node('p',(item.mediaType.startsWith('video/')?'Video: ':'Photo: ')+item.mediaPath));const preview=node('button','Preview media');preview.type='button';preview.addEventListener('click',()=>{const file=loaded.media.find(m=>m.name===item.mediaPath);if(!file)return;const url=URL.createObjectURL(new Blob([file.bytes],{type:file.type})),media=node(file.type.startsWith('video/')?'video':'img');media.src=url;if(media.tagName==='VIDEO'){media.controls=true;media.preload='metadata';media.setAttribute('aria-label','Selected Facebook export video');}else media.alt='Selected Facebook export photo';media.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});preview.replaceWith(media);});details.append(preview);}
      row.append(choice,details);list.append(row);
    }if(start+100<loaded.items.length){const more=node('button','Show more posts');more.type='button';more.addEventListener('click',()=>{more.remove();show(start+100);});list.append(more);}};show();
  }
  async function upload(item){
    if(!item.mediaPath)return {};
    const file=loaded.media.find(m=>m.name===item.mediaPath);if(!file||file.bytes.byteLength>100*1024*1024)throw Error('A selected media file is missing or larger than 100 MB. Clear that item and retry.');
    const ticket=await request('/stories',{contentType:file.type,purpose:'post'});
    const uploaded=await importFetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:new Blob([file.bytes],{type:file.type})},importUploadDeadline(file.bytes.byteLength));if(!uploaded.ok)throw Error('Media upload failed. Completed imports are kept; retry when the connection is stable.');
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
        const media=await upload(item),audience=itemAudiences.get(i)||dialog.querySelector('[data-audience]').value;const content=item.sharedSource?item.content+'\n\nShared source: '+item.sharedSource.url:item.content;const result=await request('/secure-posts',{...base,content,originalCreatedAt:item.originalCreatedAt,originalContentCertified:true,audience,...media});
        if(result.deduplicated)duplicates++;else{imported++;changed=true;}selected.delete(i);
      }
      if(!stopping&&profileFields.size){const changes=Object.fromEntries([...profileFields].map(key=>[key,loaded.profile[key]]));await request('/profiles',changes);profileFields.clear();changed=true;}
      status((stopping?'Stopped. ':'Moving Day finished. ')+imported+' posts moved with your chosen privacy settings. '+duplicates+' duplicates skipped.'+(selected.size?' '+selected.size+' posts remain selected.':'')+(stopping?'':' Choose what you want to do next.'));
      if(!stopping&&changed){const next=dialog.querySelector('[data-next]');next.hidden=false;dialog.classList.add('is-complete');dialog.scrollTo({top:0,behavior:'smooth'});}
    }catch(error){status(error.message+' '+imported+' posts were imported; retrying will skip completed items.');}
    finally{running=false;controls.forEach(el=>el.disabled=false);stopButton.hidden=true;dialog.querySelectorAll("[data-profile-field]").forEach(field=>{field.checked=profileFields.has(field.dataset.profileField);});renderItems();update();}
  }
  window.openDanzStakFacebookImport=button=>{if(!dialog)build();trigger=button||document.activeElement;changed=false;dialog.classList.remove('is-complete');dialog.querySelector('input[type=file]').value='';dialog.querySelector('.facebook-import-preview').hidden=true;dialog.querySelector('[data-next]').hidden=true;status('Your export stays on this device until you choose items and press Move selected items.');dialog.showModal();};
})();
