const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

async function verify(file,startText,endText,expression,message){
 const source=readFileSync(file,'utf8'),start=source.indexOf(startText),end=source.indexOf(endText,start);assert.ok(start>=0&&end>start,`missing ${startText}`);
 let timer,cleared=false;class AbortController{constructor(){const listeners=[];this.signal={addEventListener:(name,fn)=>{if(name==='abort')listeners.push(fn);}};this.abort=()=>listeners.forEach(fn=>fn());}}
 const context=vm.createContext({api:'https://api.danzstak.com',AbortController,setTimeout:fn=>{timer=fn;return 5;},clearTimeout:id=>{assert.equal(id,5);cleared=true;},fetch:(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const error=Error('aborted');error.name='AbortError';reject(error);} ))});
 vm.runInContext(source.slice(start,end),context);const pending=vm.runInContext(expression,context).catch(error=>error);timer();const error=await pending;assert.match(error.message,message);assert.equal(cleared,true);return source;
}
(async()=>{
 const home=await verify('assets/home.js','async function homeFetch','legalAgreement.addEventListener','homeFetch("/auth/session")',/took too long/);assert.match(home,/homeFetch\("\/auth\/legal-acceptance"/);assert.match(home,/homeFetch\("\/auth\/logout"/);
 const profile=await verify('assets/profile.js','async function profileFetch','function firstString','profileFetch("/profiles")',/Profile loading took too long/);assert.match(profile,/await profileFetch\("\/profiles"/);
 const logout=await verify('assets/logout.js','async function logoutFetch','document.addEventListener','logoutFetch()',/Logout took too long/);assert.match(logout,/await logoutFetch\(/);
 console.log('Account network checks passed: session, legal, profile, and logout requests recover from stalls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
