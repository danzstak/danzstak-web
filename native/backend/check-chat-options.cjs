// Usage: node native/backend/check-chat-options.cjs /path/to/merged/index.js
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
function fn(name){const a=source.indexOf('async function '+name+'('),b=source.indexOf('async function ',a+20);return source.slice(a,b<0?undefined:b);}
const kind=name=>class {constructor(input){this.input=input;this.kind=name;}};
let writes=[],deleted=[],items=[],preference={muted:{BOOL:false},disappearingSeconds:{N:'86400'}},allowed=true;
const c=vm.createContext({Date,Math,Number,String,Boolean,Set,JSON,GetItemCommand:kind('get'),UpdateItemCommand:kind('update'),DeleteItemCommand:kind('delete'),PutItemCommand:kind('put'),QueryCommand:kind('query'),DeleteObjectCommand:kind('objectDelete'),process:{env:{CONVERSATIONS_TABLE:'conversations',MESSAGES_TABLE:'messages',MEDIA_BUCKET:'media',MESSAGE_REACTIONS_TABLE:'reactions'}},ownerPrefix:()=> 'a'.repeat(24),conversationId:()=> 'pair',randomUUID:()=> '33333333-3333-4333-a333-333333333333',json:(status,body)=>({status,body}),canContact:async()=>allowed,notifyMessage:async()=>{},queryAll:async arg=>arg.TableName==='messages'?items:[],mapLimit:async(list,limit,job)=>Promise.all(list.map(job)),signedMediaUrl:()=> 'https://media.invalid/file',db:{send:async cmd=>{if(cmd.kind==='get')return {Item:preference};if(cmd.kind==='query')return {Items:items};writes.push(cmd);return {}; }},s3:{send:async cmd=>{deleted.push(cmd.input.Key);return {};}}});
vm.runInContext(['chatSettings','removeExpiredMessages','deleteConversation','sendMessage','getMessages'].map(fn).join('\n'),c);
(async()=>{
 const me={email:'sender@example.com'},contact='receiver@example.com',key='messages/'+ 'a'.repeat(24)+'/33333333-3333-4333-a333-333333333333.mp4';
 let result=await c.chatSettings({contactEmail:contact,muted:true,disappearingSeconds:86400},me);assert.equal(result.status,200);assert.equal(writes.filter(x=>x.input.UpdateExpression.includes('disappearingSeconds')).length,2);
 writes=[];result=await c.chatSettings({contactEmail:contact,disappearingSeconds:1},me);assert.equal(result.status,400);assert.equal(writes.length,0);
 const row=(sender,mediaKey,expires)=>({conversationId:{S:'pair'},messageId:{S:'1'},senderEmail:{S:sender},recipientEmail:{S:sender===me.email?contact:me.email},createdAt:{S:'2026-01-01T00:00:00Z'},content:{S:''},mediaKey:{S:mediaKey},expiresAt:{N:String(expires||0)}});
 items=[row(me.email,key),row(contact,key),row(me.email,'users/other/image.jpg')];writes=[];deleted=[];
 result=await c.deleteConversation({queryStringParameters:{contact},body:JSON.stringify({removeSentMedia:true})},me);assert.equal(result.status,200);assert.deepEqual(deleted,[key]);assert.equal(writes.filter(x=>x.input.TableName==='messages').length,1);
 deleted=[];await c.deleteConversation({queryStringParameters:{contact},body:'{}'},me);assert.equal(deleted.length,0);
 const now=Math.floor(Date.now()/1000);items=[row(me.email,key,now-1),row(me.email,key.replace('.mp4','.jpg'),now+100)];writes=[];deleted=[];
 result=await c.getMessages({queryStringParameters:{contact}},me);assert.equal(result.body.messages.length,1);assert.equal(result.body.messages[0].expiresAt,now+100);assert.deepEqual(deleted,[key]);assert.equal(writes.filter(x=>x.kind==='delete').length,1);
 writes=[];await c.sendMessage({body:JSON.stringify({recipientEmail:contact,content:'Hello'})},me);assert.ok(Number(writes.find(x=>x.kind==='put').input.Item.expiresAt.N)>now);
 console.log('Backend checks passed: mirrored timers, validation, sender-only media cleanup, private chat hiding, expiry filtering/cleanup and new-message expiry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
