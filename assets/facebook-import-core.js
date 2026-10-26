"use strict";
(function(root){
  const MAX_ARCHIVE=200*1024*1024,MAX_EXPANDED=400*1024*1024,MAX_FILES=12000,MAX_JSON=16*1024*1024;
  function pathOf(value){const path=String(value||"").replace(/\\/g,"/").replace(/^\.\//,"");if(!path||path.startsWith("/")||path.includes(":")||path.includes("\0")||path.split("/").includes(".."))return "";return path;}
  function text(value){if(typeof value!=="string")return "";try{if(/[\u00c2-\u00f4]/.test(value)&&[...value].every(c=>c.charCodeAt(0)<=255))return new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from([...value],c=>c.charCodeAt(0)));}catch{}return value;}
  const str=(value,max)=>text(value).trim().slice(0,max);
  function mediaType(name){const ext=name.split('.').pop().toLowerCase();return {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'}[ext]||'';}
  function normalize(entries){
    const items=[],profile={},warnings={unsupported:0,missingMedia:0,invalidDate:0,tooLong:0},files=new Map(),seen=new Set();let documents=0;
    for(const entry of entries){const name=pathOf(entry.name);if(name)files.set(name,entry.bytes);}
    for(const [name,bytes] of files){
      if(!name.toLowerCase().endsWith('.json'))continue;
      const filename=name.split('/').pop();const postsFile=/^(?:posts(?:_\d+)?|your_posts[^/]*)\.json$/i.test(filename),profileFile=/^profile(?:_information)?(?:_\d+)?\.json$/i.test(filename);
      if(!postsFile&&!profileFile)continue;
      if(bytes.length>MAX_JSON)throw Error('A JSON file is too large. Export a smaller date range.');
      let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('A supported Facebook JSON file could not be read. Export in JSON format and try again.');}documents++;
      if(profileFile){const info=data.profile_v2||data.profile||data;const nameValue=typeof info.name==='string'?info.name:info.name?.full_name;profile.name ||= str(nameValue,80);profile.bio ||= str(typeof info.intro_bio==='string'?info.intro_bio:info.intro_bio?.text||info.bio,160);profile.location ||= str(info.current_city?.name||info.hometown?.name,80);profile.work ||= str(info.work_experiences?.[0]?.employer?.name,100);continue;}
      const posts=Array.isArray(data)?data:Array.isArray(data.status_updates)?data.status_updates:Array.isArray(data.posts)?data.posts:[];
      for(const post of posts){
        if(!post||typeof post!=='object')continue;
        const raw=Array.isArray(post.data)?post.data.map(part=>typeof part?.post==='string'?text(part.post):'').filter(Boolean).join('\n\n'):text(post.post||post.content||'');
        if(raw.length>5000){warnings.tooLong++;continue;}
        const date=typeof post.timestamp==='number'?new Date(post.timestamp*1000):new Date(post.created_time||post.timestamp||'');
        if(!Number.isFinite(date.getTime())||date.getTime()<0||date.getTime()>Date.now()+86400000){warnings.invalidDate++;continue;}
        const originalCreatedAt=date.toISOString(),media=[];
        for(const attachment of Array.isArray(post.attachments)?post.attachments:[]){for(const part of Array.isArray(attachment?.data)?attachment.data:[]){const m=part?.media;if(!m)continue;const path=pathOf(m.uri);if(path&&mediaType(path)){const candidates=files.has(path)?[path]:[...files.keys()].filter(name=>name.endsWith("/"+path));if(candidates.length===1)media.push(candidates[0]);else warnings.missingMedia++;}else warnings.unsupported++;}}
        if(!raw.trim()&&!media.length){warnings.unsupported++;continue;}
        const paths=media.length?media:[''];
        for(const mediaPath of paths){const content=raw.trim()||(mediaType(mediaPath).startsWith('video/')?'Imported video':'Imported photo');const localIdentity=JSON.stringify([originalCreatedAt,content,mediaPath]);if(seen.has(localIdentity))continue;seen.add(localIdentity);const identity=JSON.stringify([originalCreatedAt,content,mediaPath?mediaType(mediaPath):""]);items.push({content,originalCreatedAt,mediaPath,mediaType:mediaPath?mediaType(mediaPath):'',identity,sourceFile:name});if(items.length>2000)throw Error('This export contains more than 2,000 posts or attachments. Export a smaller date range.');}
      }
    }
    const needed=new Set(items.map(item=>item.mediaPath).filter(Boolean));const media=[...needed].map(name=>({name,type:mediaType(name),bytes:files.get(name)}));
    return {items,profile:Object.fromEntries(Object.entries(profile).filter(([,v])=>v)),media,warnings,documents};
  }
  function readArchive(buffer,name){
    if(buffer.byteLength>MAX_ARCHIVE)throw Error('Choose an export smaller than 200 MB. You can export a shorter date range.');
    let entries;
    if(String(name).toLowerCase().endsWith('.json'))entries=[{name:String(name).split(/[\\/]/).pop(),bytes:new Uint8Array(buffer)}];
    else if(String(name).toLowerCase().endsWith('.zip')){
      let total=0,count=0;
      const unzipped=root.fflate.unzipSync(new Uint8Array(buffer),{filter(file){if(++count>MAX_FILES)throw Error('This archive has too many files. Export a smaller date range.');if(!Number.isFinite(file.originalSize)||file.originalSize<0||(total+=file.originalSize)>MAX_EXPANDED)throw Error('The expanded export is too large. Export a smaller date range.');return Boolean(pathOf(file.name))&&(file.name.toLowerCase().endsWith('.json')||Boolean(mediaType(file.name)));}});
      entries=Object.entries(unzipped).map(([name,bytes])=>({name,bytes}));
    }else throw Error('Choose a Facebook ZIP export or supported posts/profile JSON file.');
    const result=normalize(entries);if(!result.documents)throw Error('No supported posts or profile JSON was found. Request a Facebook export in JSON format.');return result;
  }
  root.DanzStakFacebookImport={normalize,readArchive,pathOf,mediaType,MAX_ARCHIVE};
})(typeof self!=='undefined'?self:globalThis);
