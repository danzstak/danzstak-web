const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/profile-editor.js','utf8');
const a=source.indexOf('async function persistCoverPosition('),b=source.indexOf('mediaTools.appendChild(repositionButton);',a);
const handlers={}, writes=[], alerts=[];let storageError=true, saveError=false;
const context=vm.createContext({window:{danzstakCurrentProfile:{cloudProfile:true}},profileMediaKey:'media',
  saveCloudProfile:async position=>{if(saveError)throw Error('Server rejected save');writes.push({...position});},
  localStorage:{getItem:()=>'{"avatar":"keep"}',setItem:()=>{if(storageError)throw Error('quota');}},
  coverElement:{style:{},dataset:{coverX:'0',coverY:'80'},addEventListener:(name,fn)=>handlers[name]=fn},
  dragStart:{coverX:50,coverY:50},coverPositionSaving:false,alert:message=>alerts.push(message)
});vm.runInContext(source.slice(a,b),context);
(async()=>{
  await handlers.pointerup();assert.equal(writes[0].coverX,0,'zero coordinates are preserved');assert.equal(writes[0].coverY,80);assert.equal(alerts.length,0,'cache failure does not block cloud save');assert.equal(context.dragStart,null);
  saveError=true;context.dragStart={coverX:20,coverY:30};context.coverElement.dataset={coverX:'90',coverY:'95'};
  await handlers.pointerup();assert.equal(context.coverElement.style.backgroundPosition,'20% 30%');assert.equal(alerts.length,1);assert.equal(context.coverPositionSaving,false);
  context.dragStart={coverX:10,coverY:15};handlers.pointercancel();assert.equal(context.coverElement.style.backgroundPosition,'10% 15%');assert.equal(context.dragStart,null);
  context.window.danzstakCurrentProfile.cloudProfile=false;context.dragStart={coverX:30,coverY:40};context.coverElement.dataset={coverX:'70',coverY:'80'};
  await handlers.pointerup();assert.equal(context.coverElement.style.backgroundPosition,'30% 40%','failed local save restores the prior preview');
  console.log('Cover position checks passed: zero coordinates, cloud save with full cache, failure rollback, and canceled drags.');
})().catch(error=>{console.error(error);process.exitCode=1;});
