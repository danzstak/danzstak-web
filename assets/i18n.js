"use strict";
(() => {
 const supported=new Set((window.danzstakLanguages||[['en','English']]).map(([code])=>code));
 const dictionaries=window.danzstakTranslations||{en:{}};
 const originalText=new WeakMap(),originalAttributes=new WeakMap();
 const excluded='script,style,textarea,[data-no-translate],.post-content,.post-header,.comment,.message:not(.system-message),.profile-bio,.profile-post-card p,.profile-post-meta,.profile-friend-card,.friend-details,.conversation-user,#conversationName,.news-card,.reel-details,.story-viewer-caption,.value,#profileName,#profileHandle,.facebook-import-items';
 let queued=false;
 function normalize(code){if(supported.has(code))return code;const base=String(code||'').split('-')[0];return supported.has(base)?base:'en';}
 function translate(raw){
  const source=String(raw),trimmed=source.trim(),language=normalize(document.documentElement.lang),dictionary=dictionaries[language]||{};
  let result=dictionary[trimmed];
  if(!result){const count=trimmed.match(/^(Notifications|Friends|Messages) \((\d+)\)$/);if(count)result=(dictionary[count[1]]||count[1])+' ('+count[2]+')';}
  if(!result)return source;
  return source.slice(0,source.indexOf(trimmed))+result+source.slice(source.indexOf(trimmed)+trimmed.length);
 }
 function apply(){
  queued=false;if(!document.body)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let textNode;
  while((textNode=walker.nextNode())){
    if(!textNode.parentElement||textNode.parentElement.closest(excluded))continue;
    const old=originalText.get(textNode),current=textNode.nodeValue;
    const source=old&&old.rendered===current?old.source:current;
    const rendered=translate(source);originalText.set(textNode,{source,rendered});if(current!==rendered)textNode.nodeValue=rendered;
  }
  for(const element of document.body.querySelectorAll('[placeholder],[title],[aria-label]')){
    if(element.closest(excluded))continue;let records=originalAttributes.get(element);if(!records){records=new Map();originalAttributes.set(element,records);}
    for(const name of ['placeholder','title','aria-label']){if(!element.hasAttribute(name))continue;const current=element.getAttribute(name),old=records.get(name),source=old&&old.rendered===current?old.source:current,rendered=translate(source);records.set(name,{source,rendered});if(current!==rendered)element.setAttribute(name,rendered);}
  }
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(apply);}
 function setLanguage(code){const language=normalize(code);document.documentElement.lang=language;document.documentElement.dir='ltr';try{localStorage.setItem('danzstak_language',language);}catch{}apply();return language;}
 window.danzstakSetLanguage=setLanguage;window.danzstakTranslate=translate;
 function start(){
  let language=document.documentElement.lang||'en';
  let saved='';try{saved=localStorage.getItem('danzstak_language')||'';}catch{}
  let regional='';try{regional=(navigator.languages||[navigator.language]).map(normalize).find(code=>code!=='en')||normalize(navigator.language);}catch{}
  language=saved||regional||language;
  document.documentElement.lang=normalize(language);apply();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  new MutationObserver(()=>{apply();for(const frame of document.querySelectorAll('iframe')){try{if(new URL(frame.src,location.href).origin===location.origin)frame.contentWindow?.postMessage({type:'danzstak-language',language:document.documentElement.lang},location.origin);}catch{}}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 addEventListener('storage',event=>{if(event.key==='danzstak_language')setLanguage(event.newValue);});
 addEventListener('message',event=>{if(event.source===window.parent&&event.origin===location.origin&&event.data?.type==='danzstak-language')setLanguage(event.data.language);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
