const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('infrastructure/call-signaling/template.yaml','utf8');
const a=source.indexOf('exports.handler=async event=>'), b=source.indexOf('\n',a);
let identityReads=0,refreshes=0;
const context=vm.createContext({exports:{},console:{error(){}},json:(statusCode,body)=>({statusCode,body}),identity:async()=>{identityReads++;return null;},refreshSession:async()=>{refreshes++;return {statusCode:200};}});
vm.runInContext(source.slice(a,b),context);
const call=(method,path,origin)=>context.exports.handler({requestContext:{http:{method}},rawPath:path,headers:origin?{origin}:{}});
(async()=>{
 for(const method of ['POST','PATCH','DELETE','PUT']){assert.equal((await call(method,'/profiles','https://untrusted.example')).statusCode,403);assert.equal((await call(method,'/profiles')).statusCode,403);}
 assert.equal(identityReads,0,'blocked mutation origins cannot reach identity or side effects');
 assert.equal((await call('POST','/auth/refresh','https://untrusted.example')).statusCode,403);assert.equal(refreshes,0);
 assert.equal((await call('POST','/calls/signal','https://danzstak.com')).statusCode,401);assert.equal(identityReads,1);
 assert.equal((await call('GET','/profiles')).statusCode,401,'read routes retain normal session authentication');
 assert.equal((await call('POST','/auth/refresh','https://danzstak.com')).statusCode,200);assert.equal(refreshes,1);
 console.log('Social API origin checks passed: blocked mutations, refresh protection, trusted clients, and authenticated reads.');
})().catch(error=>{console.error(error);process.exitCode=1;});
