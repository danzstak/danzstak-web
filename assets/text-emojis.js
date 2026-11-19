"use strict";
(() => {
 let target=null,palette=null,timer=null,origin=null;
 const selector='#postText,#messageInput,.comments input,.post-inline-editor textarea,.edit-profile-panel textarea';
 const canUse=element=>element?.matches?.(selector)&&!element.disabled&&!element.readOnly;
 function cancel(){clearTimeout(timer);timer=null;origin=null;}
 function hide(){if(palette)palette.hidden=true;}
 function show(element){
  if(!canUse(element))return;target=element;
  if(!palette){palette=document.createElement('div');palette.className='text-emoji-palette';palette.setAttribute('role','group');palette.setAttribute('aria-label','Insert emoji');palette.hidden=true;
   for(const emoji of ['😀','😂','😍','❤️','👍','🔥','🎉','😢','😮','🙏','👏','🎵','🤘','🎤','🎧','💯']){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label','Insert '+emoji);button.addEventListener('click',()=>{if(!canUse(target)){hide();return;}const start=target.selectionStart??target.value.length,end=target.selectionEnd??start,max=target.maxLength;if(max>0&&target.value.length-(end-start)+emoji.length>max)return;target.setRangeText(emoji,start,end,'end');target.dispatchEvent(new Event('input',{bubbles:true}));hide();target.focus();});palette.appendChild(button);}document.body.appendChild(palette);}
  const rect=element.getBoundingClientRect();palette.hidden=false;const width=Math.min(288,document.documentElement.clientWidth-24);palette.style.width=width+'px';palette.style.left=Math.max(12,Math.min(rect.left,document.documentElement.clientWidth-width-12))+'px';palette.style.top=Math.max(12,Math.min(rect.top-palette.offsetHeight-8,innerHeight-palette.offsetHeight-12))+'px';palette.querySelector('button')?.focus();
 }
 document.addEventListener('pointerdown',event=>{cancel();if(palette?.contains(event.target))return;hide();if(!canUse(event.target)||event.button>0)return;const field=event.target;origin={x:event.clientX,y:event.clientY};timer=setTimeout(()=>{timer=null;show(field);},550);});
 document.addEventListener('pointermove',event=>{if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>10)cancel();},{passive:true});
 for(const name of ['pointerup','pointercancel','scroll'])document.addEventListener(name,cancel,{passive:true,capture:true});
 document.addEventListener('contextmenu',event=>{if(canUse(event.target)){event.preventDefault();cancel();show(event.target);}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){hide();cancel();target?.focus();}else if((event.shiftKey&&event.key==='F10')&&canUse(event.target)){event.preventDefault();cancel();show(event.target);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){hide();cancel();}});
})();
