const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/profile-editor.js','utf8');
const code=source.slice(source.indexOf('async function removeProfileImage('),source.indexOf('function addRemoveImageButton('));
let failSave=false,failStorage=false,applied;
const target={style:{backgroundImage:'old'},classList:{remove(){}},textContent:''};
const context=vm.createContext({window:{danzstakCurrentProfile:{cloudProfile:true}},profileMediaKey:'media',
  localStorage:{getItem:()=>'{"avatar":"old"}',setItem:()=>{if(failStorage)throw Error('quota');}},
  saveCloudProfile:async()=>{if(failSave)throw Error('server unavailable');return {name:'DanzStak',picture:'fallback'};},
  applyProfile:profile=>applied=profile,document:{getElementById:()=>({textContent:'DanzStak'})},target
});vm.runInContext(code,context);
(async()=>{
  failSave=true;await assert.rejects(vm.runInContext('removeProfileImage("avatar",target)',context));assert.equal(applied,undefined);assert.equal(target.style.backgroundImage,'old');
  failSave=false;failStorage=true;await vm.runInContext('removeProfileImage("avatar",target)',context);assert.equal(applied.picture,'fallback','cloud result survives cache failure and retains server fallback');
  context.window.danzstakCurrentProfile.cloudProfile=false;
  await assert.rejects(vm.runInContext('removeProfileImage("avatar",target)',context));assert.equal(target.style.backgroundImage,'old');
  failStorage=false;await vm.runInContext('removeProfileImage("avatar",target)',context);assert.equal(target.style.backgroundImage,'');assert.equal(target.textContent,'D');
  console.log('Profile photo removal checks passed: server errors, cache failures, fallback pictures, and initials.');
})().catch(error=>{console.error(error);process.exitCode=1;});
