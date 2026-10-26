const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/feed-enhancements.js','utf8');
const code=source.slice(source.indexOf('function addShareButton('),source.indexOf('function postPermalink('));
async function scenario({share,clipboard,audience='public'}={}){
 const copied=[],alerts=[],opened=[],nodes=[];let click,status;
 const document={createElement(tag){const node={tag,children:[],setAttribute(){},addEventListener(_,fn){click=fn;},appendChild(n){this.children.push(n);}};nodes.push(node);return node;}};
 const actions={querySelector:()=>null,appendChild(){},after(n){status=n;}};
 const post={dataset:{audience},querySelector(selector){return selector==='.post-actions'?actions:selector==='.post-content'?{textContent:'Original post'}:status;}};
 const navigator={clipboard:{writeText:async text=>{if(clipboard==='blocked')throw Error('denied');copied.push(text);}}};if(share)navigator.share=share;
 const context=vm.createContext({document,navigator,alert:s=>alerts.push(s),window:{open:u=>opened.push(u)},postPermalink:()=> 'https://danzstak.com/feed.html#post-one'});
 vm.runInContext(code,context);context.addShareButton(post);await click();return {copied,alerts,opened,status,button:nodes[0]};
}
(async()=>{
 let result=await scenario();assert.deepEqual(result.copied,['https://danzstak.com/feed.html#post-one']);assert.match(result.status.textContent,/Link copied/);assert.equal(result.button.disabled,false);assert.deepEqual(result.opened,[]);
 result=await scenario({clipboard:'blocked'});assert.equal(result.status.children[0].href,'https://danzstak.com/feed.html#post-one');assert.equal(result.button.disabled,false);
 result=await scenario({share:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'});}});assert.equal(result.copied.length,0);assert.equal(result.button.disabled,false);
 result=await scenario({share:async()=>{throw Error('unsupported');}});assert.equal(result.copied.length,1);
 result=await scenario({audience:'private'});assert.equal(result.alerts.length,1);assert.equal(result.copied.length,0);
 assert.ok(!code.includes('facebook.com/sharer'));console.log('Sharing checks passed: native share, cancellation, clipboard fallback, manual link fallback, and private-post guard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
