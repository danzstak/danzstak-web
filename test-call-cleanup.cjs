const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/chat.js','utf8');
const extract=name=>source.match(new RegExp('(?:async )?function '+name+'\\([^\\n]+'))[0];
function setup(){
 const state=vm.createContext({document:{hidden:false},autoAnswer:false,pending:{eventId:'old-offer',callId:'old-call'},peer:null,channel:null,stream:null,callId:'old-call',contact:'caller@example.com',callTimer:null,polling:false,pollFailures:0,pollRetryVisible:false,clearTimeout(){},stopRing(){},setCallMode(){},disableChat(){},signal:async()=>{},setStatus(value){state.status=value;},els:{localVideo:{srcObject:{}},remoteVideo:{srcObject:{}},videoGrid:{},mediaControls:{},receiverHangup:{}},events:[],request:async()=>({events:state.events}),handleEvent:async()=>false});
 vm.runInContext(extract('end')+'\n'+extract('poll'),state);return state;
}
(async()=>{
 const ended=setup();await ended.end(false);assert.equal(ended.pending,null,'hangup must release the pending offer');assert.equal(ended.callId,'');assert.equal(ended.els.localVideo.srcObject,null);assert.equal(ended.els.receiverHangup.hidden,true);
 const expired=setup();await expired.poll();assert.equal(expired.pending,null,'expired or answered-elsewhere offer must not block new calls');assert.match(expired.status,/no longer available/);
 const active=setup();active.events=[{signalType:'offer',callId:'old-call'}];await active.poll();assert.notEqual(active.pending,null,'an unanswered live offer remains available');
 const failed=setup();failed.pending=null;failed.request=async()=>{throw Error('Offline');};await failed.poll();assert.equal(failed.status,undefined,'one background poll failure stays quiet');await failed.poll();assert.match(failed.status,/reconnecting automatically/);assert.equal(failed.pollRetryVisible,true);failed.request=async()=>({events:[]});await failed.poll();assert.match(failed.status,/Ready to start/);assert.equal(failed.pollFailures,0);assert.equal(failed.pollRetryVisible,false);assert.equal(failed.polling,false);
 const activeFailure=setup();activeFailure.request=async()=>{throw Error('Offline');};await activeFailure.poll();assert.equal(activeFailure.status,'Offline','an active incoming call still exposes connection failure');assert.notEqual(activeFailure.pending,null,'network failure cannot dismiss an otherwise valid call');
 console.log('Call cleanup checks passed: hangup, expired offers, active offers, and quiet background retry recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
