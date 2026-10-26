const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('infrastructure/auth-api/index.mjs','utf8');
const a=source.indexOf('async function createGroup(event)'),b=source.indexOf('async function canViewProfileMedia(',a);
let authenticated=true,owner='owner',existing=true;const writes=[];
class Get {constructor(input){this.input=input;}}class Put {constructor(input){this.input=input;}}class Delete {constructor(input){this.input=input;}}
const context=vm.createContext({corsHeaders:()=>({}),allowedOrigins:new Set(['https://danzstak.com']),getAuthenticatedUser:async()=>authenticated?'owner':null,groupCategories:new Set(['Artists']),groupsTable:'groups',randomUUID:()=> '11111111-1111-1111-1111-111111111111',accountForSub:async()=> 'owner@example.com',
 GetItemCommand:Get,PutItemCommand:Put,DeleteItemCommand:Delete,scanAll:async()=>[],db:{send:async command=>{if(command instanceof Get)return {Item:existing?{ownerId:{S:owner}}:undefined};writes.push(command.input);return {};}}
});vm.runInContext(source.slice(a,b),context);
async function call(name,body,origin='https://danzstak.com') {context.event={headers:{origin},body:JSON.stringify(body),pathParameters:{groupId:'11111111-1111-1111-1111-111111111111'}};return vm.runInContext(name+'(event)',context);}
(async()=>{
 const body={name:'Test group',category:'Artists',communityStandards:true};
 assert.equal((await call('createGroup',body,'https://untrusted.example')).statusCode,403);
 assert.equal((await call('deleteGroup',{},'https://untrusted.example')).statusCode,403);assert.equal(writes.length,0);
 authenticated=false;assert.equal((await call('createGroup',body)).statusCode,401);assert.equal((await call('deleteGroup',{})).statusCode,401);authenticated=true;
 assert.equal((await call('createGroup',{...body,communityStandards:false})).statusCode,400);
 owner='another-user';assert.equal((await call('deleteGroup',{})).statusCode,403);assert.equal(writes.length,0,'nonowners never reach a write');
 owner='owner';existing=false;assert.equal((await call('deleteGroup',{})).statusCode,404);existing=true;
 assert.equal((await call('createGroup',body)).statusCode,201);assert.equal(writes.length,2,'new group stores metadata and owner membership');
 assert.equal((await call('deleteGroup',{})).statusCode,200);
 console.log('Group authorization checks passed: origins, sessions, community standards, ownership, and missing groups.');
})().catch(error=>{console.error(error);process.exitCode=1;});
