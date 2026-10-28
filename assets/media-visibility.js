"use strict";
(() => {
 const tracked=new Set(),visible=new WeakMap();
 const eligible=element=>element?.matches?.('video,iframe.reel-player')&&!element.closest('.video-grid');
 function prepareVideoPreview(video){
  if(video.autoplay)return;
  video.playsInline=true;
  if(!video.getAttribute?.('preload'))video.preload='metadata';
  let previewTime=0,restored=false;
  const showFrame=()=>{
   if(!Number.isFinite(video.duration)||video.duration<=.12||video.currentTime>.02)return;
   previewTime=Math.min(.75,Math.max(.08,video.duration*.01),Math.max(.08,video.duration-.05));
   try{video.currentTime=previewTime;}catch{}
  };
  video.addEventListener('loadedmetadata',showFrame,{once:true});
  video.addEventListener('play',()=>{
   if(restored||!previewTime||Math.abs(video.currentTime-previewTime)>.08)return;
   restored=true;
   try{video.currentTime=0;}catch{}
  });
  if(video.readyState>=1)showFrame();
 }
 function pause(element){
  if(element.tagName==='VIDEO'){element.pause();return;}
  if(!element.isConnected||element.src==='about:blank')return;
  const original=element.src,button=document.createElement('button');button.type='button';button.className='reel-player reel-load-button';button.textContent='Play video';button.setAttribute('aria-label','Play video');
  element.src='about:blank';element.replaceWith(button);
  button.addEventListener('click',()=>{element.src=original;button.replaceWith(element);});
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const inView=entry.isIntersecting&&entry.intersectionRatio>=0.15;visible.set(entry.target,inView);if(!inView)pause(entry.target);}}, {threshold:[0,0.15]});
 function track(element){if(!eligible(element)||tracked.has(element))return;tracked.add(element);observer.observe(element);if(element.tagName==='VIDEO'){prepareVideoPreview(element);element.addEventListener('play',()=>{if(document.hidden||visible.get(element)===false)element.pause();});}}
 function added(root){if(eligible(root))track(root);root.querySelectorAll?.('video,iframe.reel-player').forEach(track);}
 function removed(root){for(const media of [...tracked])if(media===root||root.contains?.(media)){if(media.tagName==='VIDEO')media.pause();observer.unobserve(media);tracked.delete(media);}}
 added(document.body);
 new MutationObserver(records=>{for(const record of records){record.removedNodes.forEach(removed);record.addedNodes.forEach(added);}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const media of [...tracked])pause(media);});
})();
