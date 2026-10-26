const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const source=fs.readFileSync('infrastructure/auth-api/index.mjs','utf8');
const currentLegalVersion=source.match(/const legalVersion = "([^"]+)"/)[1];
assert.equal(fs.readFileSync('assets/home.js','utf8').match(/const legalVersion = "([^"]+)"/)[1],currentLegalVersion,'signup and API must accept the same policy version');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'test-key',use:'sig',alg:'RS256'};
const context=vm.createContext({Buffer,createPublicKey:crypto.createPublicKey,verify:crypto.verify,AbortSignal,
  issuer:'https://issuer.test',clientId:'test-app',now:()=>1000,
  fetch:async()=>({ok:true,json:async()=>({keys:[jwk]})})});
vm.runInContext(between('async function verifyIdToken(', '// START SECURE COGNITO'),context);
const claims={iss:'https://issuer.test',aud:'test-app',token_use:'id',nonce:'test-nonce',sub:'owner-1',iat:900,exp:2000};
function token(changes={},header={alg:'RS256',kid:'test-key'}){
 const head=Buffer.from(JSON.stringify(header)).toString('base64url'),body=Buffer.from(JSON.stringify({...claims,...changes})).toString('base64url');
 return head+'.'+body+'.'+crypto.sign('RSA-SHA256',Buffer.from(head+'.'+body),pair.privateKey).toString('base64url');
}
const verify=async value=>{context.value=value;return vm.runInContext('verifyIdToken(value,"test-nonce","owner-1")',context);};
(async()=>{
 assert.equal((await verify(token())).sub,'owner-1');
 for(const changed of [{iss:'https://evil.test'},{aud:'other-app'},{token_use:'access'},{nonce:'wrong'},{sub:'another-user'},{exp:1000},{iat:1061},{exp:'2000'}]) await assert.rejects(verify(token(changed)));
 await assert.rejects(verify(token({}, {alg:'none',kid:'test-key'})));
 const forged=token().split('.');forged[1]=Buffer.from(JSON.stringify({...claims,sub:'forged-user'})).toString('base64url');await assert.rejects(verify(forged.join('.')));
 let item,reads=0;const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 const sessions=vm.createContext({sessionCookieName:'__Host-danzstak_session',tableName:'sessions',now:()=>1000,sha256:digest,
  GetItemCommand:class{constructor(input){this.input=input;}},db:{send:async command=>{reads++;assert.equal(command.input.ConsistentRead,true);assert.equal(command.input.Key.sessionId.S,digest('a'.repeat(64)));return {Item:item};}}});
 vm.runInContext(between('function getCookie(', 'function secureCookie(')+between('async function getAuthenticatedUser(', 'const groupCategories'),sessions);
 const session=async cookie=>{sessions.event={cookies:cookie?[`__Host-danzstak_session=${cookie}`]:[]};return vm.runInContext('getAuthenticatedUser(event)',sessions);};
 assert.equal(await session(),null);assert.equal(await session('malformed'),null);assert.equal(reads,0);
 const valid={type:{S:'user_session'},userId:{S:'owner-1'},expiresAt:{N:'2000'}};
 for(const invalid of [undefined,{...valid,type:{S:'oauth_pending'}},{...valid,userId:undefined},{...valid,expiresAt:{N:'1000'}},{...valid,expiresAt:{N:'NaN'}}]){item=invalid;assert.equal(await session('a'.repeat(64)),null);}
 item=valid;assert.equal(await session('a'.repeat(64)),'owner-1');
 let acceptance,writes=0,started=0;
 const legal=vm.createContext({legalVersion:currentLegalVersion,legalCookieName:'legal',siteUrl:'https://danzstak.com',tableName:'sessions',allowedOrigins:new Set(['https://danzstak.com']),now:()=>1000,sha256:digest,
  randomValue:()=> 'b'.repeat(64),corsHeaders:()=>({}),secureCookie:()=> 'secure-test-cookie',clearCookie:()=> 'clear-test-cookie',
  errorResponse:(statusCode,error)=>({statusCode,error}),redirect:(url,cookies)=>({statusCode:302,url,cookies}),
  startLogin:async(mode,id)=>{started++;return {statusCode:302,mode,id};},GetItemCommand:class{},PutItemCommand:class{constructor(input){this.input=input;}},
  db:{send:async command=>{if(command.input){writes++;assert.equal(command.input.Item.type.S,'legal_pending');}return {Item:acceptance};}}
 });
 vm.runInContext(between('function getCookie(', 'function secureCookie(')+between('async function acceptLegalTerms(', '// COMPLETE SECURE LOGIN'),legal);
 const accept=async body=>{legal.event={headers:{origin:'https://danzstak.com'},body:JSON.stringify(body)};return vm.runInContext('acceptLegalTerms(event)',legal);};
 assert.equal((await accept({})).statusCode,400);assert.equal((await accept({version:'old',termsAccepted:true,privacyAcknowledged:true})).statusCode,400);assert.equal(writes,0);
 assert.equal((await accept({version:currentLegalVersion,termsAccepted:true,privacyAcknowledged:true})).statusCode,201);assert.equal(writes,1);
 legal.event={cookies:[]};assert.match((await vm.runInContext('startSignup(event)',legal)).url,/legal=required/);
 legal.event={cookies:['legal='+ 'b'.repeat(64)]};acceptance={type:{S:'legal_pending'},legalVersion:{S:currentLegalVersion},expiresAt:{N:'999'}};
 assert.match((await vm.runInContext('startSignup(event)',legal)).url,/legal=required/);assert.equal(started,0);
 acceptance.expiresAt.N='2000';assert.equal((await vm.runInContext('startSignup(event)',legal)).mode,'signup');assert.equal(started,1);
 let useCookie=true,failRevocation=false;const revoked=[];
 const signout=vm.createContext({allowedOrigins:new Set(['https://danzstak.com']),corsHeaders:()=>({}),getSessionId:()=>useCookie?'a'.repeat(64):null,
  getAuthenticatedUser:async()=>useCookie?'owner-1':null,accountForSub:async()=> 'owner@example.com',sha256:digest,tableName:'sessions',presenceTable:'presence',sessionCookieName:'session',clearCookie:()=> 'cleared',console:{error(){}},
  DeleteItemCommand:class{constructor(input){this.input=input;}},db:{send:async command=>{if(command.input.TableName==='sessions'){assert.equal(command.input.ExpressionAttributeValues[':userSession'].S,'user_session');if(failRevocation)throw Error('revocation unavailable');}revoked.push(command.input);return {};}}
 });
 vm.runInContext(between('async function logout(event)', '// API GATEWAY ROUTES'),signout);
 signout.event={headers:{origin:'https://untrusted.example','content-type':'application/json'}};assert.equal((await vm.runInContext('logout(event)',signout)).statusCode,403);assert.equal(revoked.length,0);
 signout.event={headers:{origin:'https://danzstak.com'}};assert.equal((await vm.runInContext('logout(event)',signout)).statusCode,415);assert.equal(revoked.length,0);
 signout.event={headers:{origin:'https://danzstak.com','content-type':'application/json'}};
 let signedOut=await vm.runInContext('logout(event)',signout);assert.equal(signedOut.statusCode,200);assert.equal(signedOut.cookies[0],'cleared');assert.equal(revoked.length,2);
 assert.equal(revoked[0].Key.sessionId.S,digest('a'.repeat(64)));assert.equal(revoked[1].TableName,'presence');
 failRevocation=true;await assert.rejects(vm.runInContext('logout(event)',signout));failRevocation=false;useCookie=false;revoked.length=0;
 signedOut=await vm.runInContext('logout(event)',signout);assert.equal(signedOut.statusCode,200);assert.equal(revoked.length,0,'signing out twice remains safe and idempotent');
 console.log('Authentication checks passed: real RSA signatures, token claims, opaque sessions, expiration, signup consent gates, and session revocation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
