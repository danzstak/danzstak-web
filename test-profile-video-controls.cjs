const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/profile-editor.js','utf8');
const a=source.indexOf('let profileVideoControlsVersion = 0;');
const code=source.slice(a,source.indexOf('actions.insertAdjacentElement',a));
const requests=[];const context=vm.createContext({videoButton:{hidden:true},removeVideoButton:{hidden:true},profileApi:'/api',fetch:()=>new Promise(resolve=>requests.push(resolve))});
vm.runInContext(code,context);
(async()=>{
  const old=vm.runInContext('revealProfileVideoControls()',context);
  vm.runInContext('setProfileVideoControls("new-video")',context);
  requests[0]({ok:true,json:async()=>({mediaKey:''})});await old;
  assert.equal(context.removeVideoButton.hidden,false,'old empty lookup cannot hide the newly uploaded video control');
  const pending=vm.runInContext('revealProfileVideoControls()',context);
  vm.runInContext('setProfileVideoControls("")',context);
  requests[1]({ok:true,json:async()=>({mediaKey:'old-video'})});await pending;
  assert.equal(context.removeVideoButton.hidden,true,'old video lookup cannot restore removal control after deletion');
  assert.equal(context.videoButton.hidden,false);
  console.log('Profile video controls checks passed: immediate updates and stale lookup protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
