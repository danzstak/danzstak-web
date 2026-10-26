const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/incoming-calls.js','utf8');
const controls=()=>({handlers:{},hidden:true,setAttribute(){},focus(){this.focuses=(this.focuses||0)+1;},addEventListener(name,fn){this.handlers[name]=fn;}});
const popup=controls(),answer=controls(),decline=controls(),label={};
popup.querySelector=selector=>selector==='[data-answer]'?answer:selector==='[data-decline]'?decline:label;
const first={eventId:'offer-1',callId:'11111111-1111-1111-1111-111111111111',signalType:'offer',senderEmail:'caller@example.com',mode:'phone'};
let events=[first],poll,notifications=0,fetches=0;const drawers=[];
class Notification {constructor(){notifications++;}}Notification.permission='granted';
const context=vm.createContext({document:{hidden:false,addEventListener(){},activeElement:null,createElement:()=>popup,body:{appendChild(){}}},HTMLElement:class {},window:{Notification,openMessageDrawer:(...args)=>drawers.push(args)},Notification,
 navigator:{vibrate(){},serviceWorker:{ready:Promise.resolve({showNotification:async()=>notifications++})}},setInterval:fn=>{poll=fn;},URL,location:{href:'https://danzstak.com/feed.html'},
 fetch:async()=>{fetches++;return {ok:true,json:async()=>({events})};}});
vm.runInContext(source,context);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));assert.equal(popup.hidden,false);assert.equal(answer.focuses,1);assert.equal(notifications,0,'page polling must not duplicate service-worker background alerts');
 answer.handlers.click();assert.equal(popup.hidden,true);assert.equal(drawers.length,1);assert.equal(drawers[0][2],first.callId,'answer targets the selected call');await poll();assert.equal(popup.hidden,true,'answer handoff cannot immediately re-display the unacknowledged offer');
 events=[{...first,eventId:'offer-2',callId:'22222222-2222-2222-2222-222222222222'}];await poll();assert.equal(popup.hidden,false,'a distinct call still appears');await decline.handlers.click();assert.equal(popup.hidden,true);await poll();assert.equal(popup.hidden,true,'declined call stays dismissed while its old offer expires');
 events=[{...first,eventId:'offer-3',callId:'33333333-3333-3333-3333-333333333333'}];await poll();assert.equal(popup.hidden,false);
 const expired=events[0];events=[];await poll();assert.equal(popup.hidden,true,'expired or answered elsewhere offers close the popup');events=[expired];await poll();assert.equal(popup.hidden,true,'a stale expired offer cannot reopen the popup');
 const beforeHidden=fetches;context.document.hidden=true;await poll();assert.equal(fetches,beforeHidden,"hidden pages rely on push rather than duplicate polling");context.document.hidden=false;await poll();assert.ok(fetches>beforeHidden);
 const handlers={},pushes=[];const worker={location:{origin:'https://danzstak.com'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>pushes.push({title,options})}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self:worker,URL});let pending;
 handlers.push({data:{json:()=>({type:'call',tag:'call-'+first.callId,url:'/messages.html?contact=caller%40example.com'})},waitUntil:value=>pending=value});await pending;
 assert.equal(pushes[0].options.data.callId,first.callId);
 assert.equal(pushes.length,1);assert.equal(pushes[0].options.tag,'call-'+first.callId);assert.equal(pushes[0].options.actions.length,2);assert.equal(pushes[0].options.badge,'/assets/notification-badge.png');
 const chat=fs.readFileSync('assets/chat.js','utf8');const handle=chat.match(/async function handleEvent\(event\)\{[^\n]+/)[0];let accepted=0;
 const state=vm.createContext({pending:null,peer:null,autoAnswer:true,autoAnswerDeadline:Date.now()+60000,requestedCallId:first.callId,requestedContact:first.senderEmail,Date,els:{email:{},incomingLabel:{}},accept:async()=>accepted++,ring(){throw Error('Unexpected ring');}});
 vm.runInContext(handle,state);await state.handleEvent({...first,callId:'unrelated'});assert.equal(accepted,0);assert.equal(state.pending,null);await state.handleEvent({...first,senderEmail:'another@example.com'});assert.equal(accepted,0);await state.handleEvent(first);assert.equal(accepted,1,'only the tapped call is automatically answered');
 console.log('Call notification checks passed: one background notifier, answer/decline handoffs, distinct calls, and branded call actions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
