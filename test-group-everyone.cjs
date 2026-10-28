const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('infrastructure/auth-api/index.mjs','utf8');
const start=source.indexOf('async function broadcastGroup(event)'),end=source.indexOf('async function canViewProfileMedia(',start);
let authenticated=true,owner='owner';const writes=[];
class Get {constructor(input){this.input=input;}} class Put {constructor(input){this.input=input;}}
const context=vm.createContext({corsHeaders:()=>({}),allowedOrigins:new Set(['https://danzstak.com']),getAuthenticatedUser:async()=>authenticated?'owner':null,parseJsonBody:event=>JSON.parse(event.body),groupsTable:'groups',engagementNotificationsTable:'notices',accountForSub:async()=> 'owner@example.com',randomUUID:()=> '22222222-2222-2222-2222-222222222222',now:()=>1000,GetItemCommand:Get,PutItemCommand:Put,scanAll:async()=>[{userEmail:{S:'owner@example.com'}},{userEmail:{S:'member@example.com'}},{userEmail:{S:'GROUP#metadata'}}],db:{send:async command=>{if(command instanceof Get)return {Item:{ownerId:{S:owner},name:{S:'Road Crew'}}};writes.push(command.input);return {};}}});
vm.runInContext(source.slice(start,end),context);
const event=(message='Load-in moved to 6 PM',origin='https://danzstak.com')=>({headers:{origin},body:JSON.stringify({message}),pathParameters:{groupId:'11111111-1111-1111-1111-111111111111'}});
(async()=>{
 context.event=event('hello','https://evil.example');assert.equal((await vm.runInContext('broadcastGroup(event)',context)).statusCode,403);
 authenticated=false;context.event=event();assert.equal((await vm.runInContext('broadcastGroup(event)',context)).statusCode,401);authenticated=true;
 owner='other';assert.equal((await vm.runInContext('broadcastGroup(event)',context)).statusCode,403);assert.equal(writes.length,0);owner='owner';
 assert.equal((await vm.runInContext('broadcastGroup(event)',context)).statusCode,200);assert.equal(writes.length,1,'only the other current member is notified');
 assert.equal(writes[0].Item.type.S,'group_everyone');assert.equal(writes[0].Item.userEmail.S,'member@example.com');assert.equal(writes[0].Item.preview.S,'Load-in moved to 6 PM');
 const client=fs.readFileSync('assets/feed-enhancements.js','utf8');assert.match(client,/Notify @everyone/);assert.match(client,/notice\.type === "group_everyone"/);assert.doesNotMatch(client,/result\.members/,'client must not receive a member-address list');
 console.log('Tribe @everyone checks passed: creator-only fanout, current members, durable notices, and no client member-address exposure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
