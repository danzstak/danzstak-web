const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/home.js','utf8');
async function setup({authenticated=false,agreementOk=true}={}){
 const nodes={},posts=[],assigned=[],replaced=[];
 for(const id of ['loginBtn','logoutBtn','feedBtn','sessionStatus','signupBtn','publicExploreBtn','legalConsent','legalAgreement']) nodes[id]={handlers:{},dataset:{signupUrl:'https://api.danzstak.com/auth/signup'},addEventListener(name,fn){this.handlers[name]=fn;},focus(){this.focused=true;}};
 const context=vm.createContext({document:{getElementById:id=>nodes[id]},window:{location:{assign:url=>assigned.push(url),replace:url=>replaced.push(url)}},location:{search:''},URLSearchParams,
  localStorage:{setItem(){throw Error('storage full');}},sessionStorage:{removeItem(){throw Error('storage blocked');}},
  fetch:async(url,options)=>{if(url.endsWith('/auth/session'))return {status:authenticated?200:401,json:async()=>({authenticated})};posts.push(JSON.parse(options.body));return {ok:agreementOk};},confirm:()=>true});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));return {nodes,posts,assigned,replaced};
}
(async()=>{
 const first=await setup();await first.nodes.signupBtn.handlers.click();assert.equal(first.posts.length,0,'unchecked agreement cannot reach the API');assert.equal(first.nodes.legalAgreement.focused,true);
 first.nodes.legalAgreement.checked=true;await first.nodes.signupBtn.handlers.click();assert.equal(first.assigned.length,1,'confirmed server acceptance redirects despite a full local cache');assert.equal(first.posts[0].termsAccepted,true);assert.equal(first.posts[0].privacyAcknowledged,true);
 const failed=await setup({agreementOk:false});failed.nodes.legalAgreement.checked=true;await failed.nodes.signupBtn.handlers.click();assert.equal(failed.assigned.length,0);assert.equal(failed.nodes.signupBtn.disabled,false,'failed agreement save remains retryable');
 const signedIn=await setup({authenticated:true});assert.deepEqual(signedIn.replaced,['feed.html'],'blocked optional session storage cannot prevent a verified login');
 console.log('Signup UI checks passed: explicit agreement, failed saves, full cache, and signed-in redirect with blocked storage.');
})().catch(error=>{console.error(error);process.exitCode=1;});
