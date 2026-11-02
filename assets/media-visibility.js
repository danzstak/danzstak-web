"use strict";
(() => {
 const tracked=new Set(),visible=new WeakMap(),manualPlayback=new WeakSet();
 const soundPreferenceKey='danzstak_video_sound';
 const soundEnabled=()=>{try{return localStorage.getItem(soundPreferenceKey)==='on';}catch{return false;}};
 let applyingSound=false;
 function updateYouTubeSound(enabled){
  document.querySelectorAll?.('iframe.reel-player[src*="youtube-nocookie.com/embed/"]').forEach(frame=>{
   try{const url=new URL(frame.src);const next=enabled?'0':'1';if(url.searchParams.get('mute')===next)return;url.searchParams.set('mute',next);url.searchParams.set('autoplay','1');frame.src=url.href;}catch{}
  });
 }
 function applySoundPreference(enabled,source){
  applyingSound=true;
  document.querySelectorAll?.('video').forEach(video=>{if(video!==source)video.muted=!enabled;});
  applyingSound=false;
  updateYouTubeSound(enabled);
  if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('danzstak-video-sound-change',{detail:{enabled}}));
 }
 function saveSoundPreference(enabled,source){
  try{localStorage.setItem(soundPreferenceKey,enabled?'on':'off');}catch{}
  applySoundPreference(enabled,source);
 }
 globalThis.danzstakMediaSound={enabled:soundEnabled,apply:()=>applySoundPreference(soundEnabled())};
 document.addEventListener('volumechange',event=>{
  const video=event.target;if(applyingSound||video?.tagName!=='VIDEO')return;
  saveSoundPreference(!video.muted,video);
 },true);
 const eligible=element=>element?.matches?.('video,iframe.reel-player')&&!element.closest('.video-grid');
 const isYouTubeFrame=element=>element?.tagName==='IFRAME'&&element.src?.includes('youtube-nocookie.com/embed/');
 function controlYouTube(frame,command){
  if(!isYouTubeFrame(frame)||!frame.contentWindow)return;
  try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func:command,args:[]}), 'https://www.youtube-nocookie.com');}catch{}
 }
 const dataSaverEnabled=()=>document.documentElement?.classList?.contains('data-saver')||(()=>{try{return localStorage.getItem('danzstak_data_saver')==='1';}catch{return false;}})();
 const isFeedVideo=video=>video?.matches?.('video.post-media');
 function prepareVideoPreview(video){
  video.playsInline=true;
  const setLayout=()=>{
   if(!video.videoWidth||!video.videoHeight)return;
   const layout=video.videoHeight>video.videoWidth?'portrait':'landscape';
   video.dataset.videoLayout=layout;
   video.style.setProperty('--video-aspect',layout==='portrait'?'9 / 16':'16 / 9');
  };
  video.addEventListener('loadedmetadata',setLayout);
  if(video.readyState>=1)setLayout();
  if(isFeedVideo(video)){
   video.preload='none';video.muted=!soundEnabled();video.autoplay=!dataSaverEnabled();video.loop=true;
   let pointerStartedPaused=false;
   video.addEventListener('pointerdown',()=>{pointerStartedPaused=video.paused;manualPlayback.add(video);},{passive:true});
   // Some mobile/WebView builds expose native controls but fail to complete the
   // first play gesture while an IntersectionObserver is also changing preload.
   // Preserve native pause behaviour, but finish an attempted play when the
   // browser leaves the video paused after the click.
   video.addEventListener('click',()=>{if(!pointerStartedPaused)return;requestAnimationFrame(()=>{if(video.paused)video.play().catch(()=>{});});});
  }else if(!video.autoplay)video.preload='none';
  else if(!video.getAttribute?.('preload'))video.preload='metadata';
  if(video.autoplay)return;
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
  if(isYouTubeFrame(element)){controlYouTube(element,'pauseVideo');return;}
  if(!element.isConnected||element.src==='about:blank')return;
  const original=element.src,button=document.createElement('button');button.type='button';button.className='reel-player reel-load-button';button.textContent='Play video';button.setAttribute('aria-label','Play video');
  element.src='about:blank';element.replaceWith(button);
  button.addEventListener('click',()=>{element.src=original;button.replaceWith(element);});
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const inView=entry.isIntersecting&&entry.intersectionRatio>=0.15;visible.set(entry.target,inView);if(!inView){manualPlayback.delete(entry.target);pause(entry.target);continue;}if(isYouTubeFrame(entry.target)){if(!document.hidden&&!dataSaverEnabled())controlYouTube(entry.target,'playVideo');continue;}if(entry.target.tagName!=='VIDEO'||document.hidden)continue;const feedVideo=isFeedVideo(entry.target);if(feedVideo&&dataSaverEnabled())continue;entry.target.preload=feedVideo?'auto':'metadata';if(entry.target.readyState===0)entry.target.load?.();if(feedVideo)entry.target.play().catch(()=>{});}}, {threshold:[0,0.15,0.6]});
 function track(element){if(!eligible(element)||tracked.has(element))return;tracked.add(element);observer.observe(element);if(element.tagName==='VIDEO'){element.muted=!soundEnabled();prepareVideoPreview(element);element.addEventListener('play',()=>{if(document.hidden||(visible.get(element)===false&&!manualPlayback.has(element)))element.pause();});}}
 function added(root){
  if(root?.tagName==='VIDEO')root.muted=!soundEnabled();
  root.querySelectorAll?.('video').forEach(video=>{video.muted=!soundEnabled();});
  if(eligible(root))track(root);root.querySelectorAll?.('video,iframe.reel-player').forEach(track);
  updateYouTubeSound(soundEnabled());
 }
 function removed(root){for(const media of [...tracked])if(media===root||root.contains?.(media)){if(media.tagName==='VIDEO')media.pause();observer.unobserve(media);tracked.delete(media);}}
 added(document.body);
 applySoundPreference(soundEnabled());
 new MutationObserver(records=>{for(const record of records){record.removedNodes.forEach(removed);record.addedNodes.forEach(added);}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const media of [...tracked])pause(media);});
})();
