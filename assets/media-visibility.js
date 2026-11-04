"use strict";
(() => {
 const tracked=new Set(),visible=new WeakMap(),ratios=new WeakMap(),manualPlayback=new WeakSet();
 let activeMedia=null,audibleMedia=null;
 const soundEnabled=()=>Boolean(audibleMedia);
 const mutedAutoplayEnabled=()=>{try{return localStorage.getItem('danzstak_muted_autoplay')==='on';}catch{return false;}};
 let applyingSound=false;
 const isYouTubeFrame=element=>element?.tagName==='IFRAME'&&element.src?.includes('youtube-nocookie.com/embed/');
 function controlYouTube(frame,command){
  if(!isYouTubeFrame(frame)||!frame.contentWindow)return;
  try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func:command,args:[]}), 'https://www.youtube-nocookie.com');}catch{}
 }
 function audioButton(element){return element?.closest?.('.danzstak-media-shell')?.querySelector?.('.danzstak-audio-toggle');}
 function syncAudioButton(element){
  const button=audioButton(element);if(!button)return;
  const enabled=element===audibleMedia;
  const label=enabled?'Mute video':'Unmute video';
  const icon=enabled?'volume-2':'volume-x',replaceIcon=button.dataset.icon!==icon||!button.firstElementChild?.classList?.contains('ds-action-icon');
  button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(enabled));button.dataset.icon=icon;
  if(replaceIcon&&globalThis.danzstakIcons?.create)button.replaceChildren(globalThis.danzstakIcons.create(icon));
 }
 function updateYouTubeSound(){
  document.querySelectorAll?.('iframe.reel-player[src*="youtube-nocookie.com/embed/"]').forEach(frame=>{
   controlYouTube(frame,frame===audibleMedia?'unMute':'mute');syncAudioButton(frame);
  });
 }
 function applySoundPreference(){
  applyingSound=true;
  document.querySelectorAll?.('video').forEach(video=>{if(eligible(video)){video.muted=video!==audibleMedia;syncAudioButton(video);}});
  applyingSound=false;
  updateYouTubeSound();
  if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('danzstak-video-sound-change',{detail:{enabled:soundEnabled()}}));
 }
 function saveSoundPreference(enabled,source){
  if(enabled&&eligible(source)){claimPlayback(source,true);audibleMedia=source;}
  else if(!source||source===audibleMedia)audibleMedia=null;
  applySoundPreference();
 }
 globalThis.danzstakMediaSound={enabled:soundEnabled,apply:applySoundPreference};
 document.addEventListener('volumechange',event=>{
  const video=event.target;if(applyingSound||video?.tagName!=='VIDEO')return;
  saveSoundPreference(!video.muted,video);
 },true);
 const eligible=element=>element?.matches?.('video,iframe.reel-player')&&!element.closest('.video-grid');
 const supportsAudioButton=element=>element?.tagName==='VIDEO'||isYouTubeFrame(element);
 function ensureAudioControl(element){
  if(!supportsAudioButton(element)||element.closest?.('.danzstak-media-shell'))return;
  const parent=element.parentNode;if(!parent)return;
  const shell=document.createElement('div');shell.className='danzstak-media-shell';
  if(element.classList?.contains?.('reel-player'))shell.classList.add('danzstak-reel-shell');
  parent.insertBefore(shell,element);shell.append(element);
  const button=document.createElement('button');button.type='button';button.className='danzstak-audio-toggle';button.dataset.icon='volume-x';
  button.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   const enabling=audibleMedia!==element;
   if(enabling&&(ratios.get(element)||0)<0.6)return;
   saveSoundPreference(enabling,element);
   if(enabling){if(element.tagName==='VIDEO')element.play().catch(()=>{});else controlYouTube(element,'playVideo');}
  });
  shell.append(button);globalThis.danzstakIcons?.upgrade?.(button);syncAudioButton(element);
 }
 function listenToYouTube(frame){
  if(!isYouTubeFrame(frame)||frame.dataset?.soundSync==='1')return;
  if(frame.dataset)frame.dataset.soundSync='1';
  const connect=()=>{
   try{frame.contentWindow?.postMessage(JSON.stringify({event:'listening',id:'danzstak-sound'}),'https://www.youtube-nocookie.com');}catch{}
   controlYouTube(frame,frame===audibleMedia?'unMute':'mute');
  };
  frame.addEventListener?.('load',connect);
  connect();
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
   // Every newly discovered player starts silent. The playback owner is the
   // only code path allowed to restore the saved sound preference. This avoids
   // an audible frame when another autoplay observer calls play() before the
   // play event reaches the ownership guard on mobile browsers.
   video.preload='none';video.muted=true;video.autoplay=false;video.loop=true;
   let pointerStartedPaused=false;
   video.addEventListener('pointerdown',()=>{pointerStartedPaused=video.paused;if(pointerStartedPaused)manualPlayback.add(video);else manualPlayback.delete(video);},{passive:true});
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
 function clearActive(element){if(activeMedia!==element&&audibleMedia!==element)return;if(activeMedia===element)activeMedia=null;if(audibleMedia===element)audibleMedia=null;applySoundPreference();}
 function claimPlayback(element,manual=false){
  if(!eligible(element))return true;
  const currentRatio=ratios.get(activeMedia)||0;
  if(!manual&&activeMedia&&activeMedia!==element&&visible.get(activeMedia)!==false&&currentRatio>=0.5)return false;
  for(const media of tracked){if(media===element)continue;if(media.tagName==='VIDEO')media.pause();else if(isYouTubeFrame(media))controlYouTube(media,'pauseVideo');}
  if(audibleMedia&&audibleMedia!==element)audibleMedia=null;
  activeMedia=element;
  applySoundPreference();
  return true;
 }
 function bestAutomaticCandidate(){
  let best=null,bestRatio=0.6;
  for(const media of tracked){const ratio=ratios.get(media)||0;if(ratio<bestRatio)continue;if(!(isFeedVideo(media)||media?.classList?.contains?.('reel-player')||isYouTubeFrame(media)))continue;best=media;bestRatio=ratio;}
  return best;
 }
 function reconcilePlayback(){
  if(document.hidden||!mutedAutoplayEnabled())return;
  if(activeMedia&&visible.get(activeMedia)!==false&&(ratios.get(activeMedia)||0)>=0.5)return;
  const candidate=bestAutomaticCandidate();
  if(!candidate)return;
  if(!claimPlayback(candidate))return;
  if(isYouTubeFrame(candidate)){if(!dataSaverEnabled())controlYouTube(candidate,'playVideo');return;}
  if(!dataSaverEnabled())candidate.play().catch(()=>{});
 }
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){const ratio=entry.isIntersecting?entry.intersectionRatio:0,inView=ratio>=0.6;ratios.set(entry.target,ratio);visible.set(entry.target,inView);if(!inView){manualPlayback.delete(entry.target);pause(entry.target);clearActive(entry.target);continue;}if(entry.target.tagName!=='VIDEO'||document.hidden)continue;const feedVideo=isFeedVideo(entry.target);if(feedVideo&&dataSaverEnabled())continue;entry.target.preload=feedVideo?'auto':'metadata';if(entry.target.readyState===0)entry.target.load?.();}
  reconcilePlayback();
 }, {threshold:[0,0.15,0.5,0.6,1]});
 function track(element){if(!eligible(element)||tracked.has(element))return;ensureAudioControl(element);tracked.add(element);observer.observe(element);if(isYouTubeFrame(element))listenToYouTube(element);if(element.tagName==='VIDEO'){element.muted=true;if(element.dataset?.visibilityPrepared!=='1'){if(element.dataset)element.dataset.visibilityPrepared='1';prepareVideoPreview(element);element.addEventListener('play',()=>{const manual=manualPlayback.has(element);manualPlayback.delete(element);if(document.hidden||(ratios.get(element)||0)<0.6){element.pause();clearActive(element);return;}if(!claimPlayback(element,manual))element.pause();});}}}
 function added(root){
  if(root?.tagName==='VIDEO'&&eligible(root))root.muted=true;
  root.querySelectorAll?.('video').forEach(video=>{if(eligible(video))video.muted=true;});
  if(eligible(root))track(root);root.querySelectorAll?.('video,iframe.reel-player').forEach(track);
  updateYouTubeSound();
 }
 function removed(root){for(const media of [...tracked])if((media===root||root.contains?.(media))&&!media.isConnected){if(media.tagName==='VIDEO')media.pause();observer.unobserve(media);tracked.delete(media);clearActive(media);}}
 added(document.body);
 applySoundPreference();
 new MutationObserver(records=>{for(const record of records){record.removedNodes.forEach(removed);record.addedNodes.forEach(added);}}).observe(document.body,{childList:true,subtree:true});
 globalThis.addEventListener?.('message',event=>{
  if(event.origin!=='https://www.youtube-nocookie.com'&&event.origin!=='https://www.youtube.com')return;
  const frame=[...tracked].find(item=>isYouTubeFrame(item)&&item.contentWindow===event.source);
  if(!frame)return;
  let payload=event.data;try{if(typeof payload==='string')payload=JSON.parse(payload);}catch{return;}
  if(payload?.event!=='infoDelivery'||typeof payload.info?.muted!=='boolean'||applyingSound)return;
  if(payload.info.muted===(frame!==audibleMedia))return;
  saveSoundPreference(!payload.info.muted,frame);
 });
 function pauseAll(){for(const media of [...tracked])pause(media);activeMedia=null;audibleMedia=null;applySoundPreference();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();});
 globalThis.addEventListener?.('pagehide',pauseAll);
 globalThis.addEventListener?.('blur',pauseAll);
 globalThis.addEventListener?.('danzstak:message-drawer',event=>{if(event.detail?.open)pauseAll();});
 globalThis.addEventListener?.('danzstak:notification-drawer',event=>{if(event.detail?.open)pauseAll();});
 document.addEventListener('click',event=>{if(event.target?.closest?.('[data-feature],#messagesNav,.mobile-menu-control'))pauseAll();},true);
 globalThis.danzstakMediaCoordinator={pauseAll,autoplayEnabled:mutedAutoplayEnabled};
})();
