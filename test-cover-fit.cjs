const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync('assets/profile-editor.js','utf8');
const code=source.slice(source.indexOf('async function toggleCoverFit()'),source.indexOf('fitCoverButton.addEventListener("click", toggleCoverFit)'));
let saved={coverFit:false}, fail=false, storageFailure=false;
const alerts=[],writes=[];
const context=vm.createContext({
  window:{danzstakCurrentProfile:{cloudProfile:true,coverFit:true}},
  coverElement:{classList:{contains:()=>true},style:{backgroundSize:'contain'}},
  fitCoverButton:{classList:{toggle:()=>{}},disabled:false,textContent:'Fill Cover Box'},
  profileMediaKey:'media',localStorage:{getItem:()=>JSON.stringify(saved),setItem:(_,s)=>{if(storageFailure)throw Error('quota');saved=JSON.parse(s);}},
  alert:message=>alerts.push(message),saveCloudProfile:async changes=>{writes.push(changes);if(fail)throw Error('Save failed');context.window.danzstakCurrentProfile={cloudProfile:true,...changes};}
});
vm.runInContext(code,context);
(async()=>{
  await vm.runInContext('toggleCoverFit()',context);
  assert.equal(writes[0].coverFit,false,'toggle uses saved cloud value instead of stale local draft');
  assert.equal(context.coverElement.style.backgroundSize,'cover');
  fail=true;await vm.runInContext('toggleCoverFit()',context);
  assert.equal(context.coverElement.style.backgroundSize,'cover','failed save preserves confirmed display');
  assert.equal(saved.coverFit,false);assert.equal(alerts.length,1);assert.equal(context.fitCoverButton.disabled,false);
  fail=false;storageFailure=true;await vm.runInContext('toggleCoverFit()',context);
  assert.equal(context.coverElement.style.backgroundSize,'contain','browser quota does not undo cloud success');
  console.log('Cover fit checks passed: cloud state, failed saves, and local storage errors.');
})().catch(error=>{console.error(error);process.exitCode=1;});
