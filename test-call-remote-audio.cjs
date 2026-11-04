const fs=require("fs");
const assert=require("assert");

const html=fs.readFileSync("messages.html","utf8");
const chat=fs.readFileSync("assets/chat.js","utf8");

const audioIndex=html.indexOf('id="remoteAudio"');
const gridIndex=html.indexOf('id="videoGrid"');
const gridEnd=html.indexOf('</div>',gridIndex);
assert(audioIndex>0&&audioIndex<gridIndex,"remote phone audio must live outside the hidden video grid");
assert(!(audioIndex>gridIndex&&audioIndex<gridEnd),"remote phone audio must not be hidden with video calls");
assert(html.includes('id="resumeRemoteAudio"'),"a user-gesture playback recovery control is required");
assert(chat.includes('return mode==="video"?els.remoteVideo:els.remoteAudio'),"phone calls must use the independent audio element");
assert(chat.includes('await mediaElement.play()'),"remote playback must be requested explicitly");
assert(chat.includes('Tap Hear call'),"blocked playback must provide an actionable status");
assert(chat.includes('els.remoteVideo.pause();els.remoteAudio.pause()'),"switching and cleanup must stop both remote players");
assert(chat.includes('els.remoteVideo.srcObject=els.remoteAudio.srcObject=null'),"teardown must detach remote streams");
assert(!/remoteVideo\.srcObject=e\.streams\[0\]/.test(chat),"phone audio must not be assigned unconditionally to hidden video");

const vm=require("vm");
const extract=name=>chat.match(new RegExp(`(?:async )?function ${name}\\([^\\n]+`))[0];
const statusBox={value:""};
const state=vm.createContext({
  mode:"phone",
  t:value=>value,
  setStatus(value){statusBox.value=value;},
  els:{
    remoteAudio:{srcObject:{},play:async()=>{throw new Error("blocked");}},
    remoteVideo:{srcObject:null,play:async()=>{}},
    resumeAudio:{hidden:true}
  }
});
vm.runInContext(extract("remoteMediaElement")+"\n"+extract("playRemoteMedia"),state);
(async()=>{
  await state.playRemoteMedia();
  assert.equal(state.els.resumeAudio.hidden,false,"blocked playback must expose the recovery button");
  assert.match(statusBox.value,/Tap Hear call/,"blocked playback must explain the recovery action");
  state.els.remoteAudio.play=async()=>{};
  await state.playRemoteMedia();
  assert.equal(state.els.resumeAudio.hidden,true,"successful playback must hide the recovery button");
  console.log("call remote-audio regression checks passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
