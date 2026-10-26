const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/chat.js','utf8');
const extract=name=>source.match(new RegExp('(?:async )?function '+name+'\\([^\\n]+'))[0];
function setup(){
 const state=vm.createContext({document:{hidden:false},autoAnswer:false,pending:{eventId:'old-offer',callId:'old-call'},peer:null,channel:null,stream:null,callId:'old-call',contact:'caller@example.com',callTimer:null,polling:false,clearTimeout(){},stopRing(){},setCallMode(){},disableChat(){},signal:async()=>{},setStatus(value){state.status=value;},els:{localVideo:{srcObject:{}},remoteVideo:{srcObject:{}},videoGrid:{},mediaControls:{},receiverHangup:{}},events:[],request:async()=>({events:state.events}),handleEvent:async()=>false});
 vm.runInContext(extract('end')+'\n'+extract('poll'),state);return state;
}
(async()=>{
 const ended=setup();await ended.end(false);assert.equal(ended.pending,null,'hangup must release the pending offer');assert.equal(ended.callId,'');assert.equal(ended.els.localVideo.srcObject,null);assert.equal(ended.els.receiverHangup.hidden,true);
 const expired=setup();await expired.poll();assert.equal(expired.pending,null,'expired or answered-elsewhere offer must not block new calls');assert.match(expired.status,/no longer available/);
 const active=setup();active.events=[{signalType:'offer',callId:'old-call'}];await active.poll();assert.notEqual(active.pending,null,'an unanswered live offer remains available');
 const failed=setup();failed.request=async()=>{throw Error('Offline');};await failed.poll();assert.notEqual(failed.pending,null,'network failure cannot dismiss an otherwise valid call');assert.equal(failed.polling,false);
 console.log('Call cleanup checks passed: hangup, expired offers, active offers, and network-failure recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
