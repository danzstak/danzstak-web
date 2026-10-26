const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/feed-enhancements.js','utf8');
const a=source.indexOf('async function respondToNotificationRequest('),b=source.indexOf('function renderWorkspace(name)',a);
const buttons=[{},{}], requests=[], messages=[];let removed=false;
const row={querySelectorAll:()=>buttons,querySelector:()=>null,appendChild:node=>messages.push(node.textContent),remove:()=>removed=true};
const context=vm.createContext({row,document:{createElement:()=>({setAttribute(){}})},refreshNotificationCount:async()=>{throw Error('badge unavailable');},fetch:(_,options)=>new Promise((resolve,reject)=>requests.push({resolve,reject,body:JSON.parse(options.body)}))});
vm.runInContext(source.slice(a,b),context);
(async()=>{
  const first=vm.runInContext('respondToNotificationRequest(row,"friend@example.com",true)',context);
  assert.ok(buttons.every(button=>button.disabled));
  assert.equal(await vm.runInContext('respondToNotificationRequest(row,"friend@example.com",false)',context),false);assert.equal(requests.length,1,'contradictory responses cannot overlap');
  requests[0].reject(Error('network offline'));assert.equal(await first,false);assert.ok(buttons.every(button=>!button.disabled));assert.equal(removed,false);assert.equal(messages.length,1);
  const retry=vm.runInContext('respondToNotificationRequest(row,"friend@example.com",false)',context);requests[1].resolve({ok:true});assert.equal(await retry,true);assert.equal(requests[1].body.accept,false);assert.equal(removed,true,'confirmed response succeeds even if badge refresh fails');
  console.log('Friend response checks passed: overlap prevention, network failures, retry, and confirmed response handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
