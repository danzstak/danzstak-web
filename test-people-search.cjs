const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function element(){return {children:[],hidden:false,textContent:'',setAttribute(){},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(){this.children=[];}};}
let inputHandler;const input={value:'',addEventListener(_,fn){inputHandler=fn;}},section=element(),heading=element(),status=element(),list=element(),nodes=[section,heading,status,list];
const timers=new Map(),requests=[];let sequence=0;
const authors=[{href:'https://danzstak.com/profile.html?member=11111111-1111-1111-1111-111111111111',textContent:'Alice'}, {href:'https://evil.example/profile.html',textContent:'Alice evil'}];
const context=vm.createContext({document:{querySelector:()=>input,getElementById:()=>({insertAdjacentElement(){}}),createElement:()=>nodes.shift()||element(),querySelectorAll:()=>authors},window:{dispatchEvent(){},addEventListener(){}},CustomEvent:class{},URL,location:{origin:'https://danzstak.com',href:'https://danzstak.com/feed.html'},AbortController,Date,setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),fetch:()=>new Promise(resolve=>requests.push(resolve))});
vm.runInContext(fs.readFileSync('assets/people-search.js','utf8'),context);
async function runSearch(value){input.value=value;await inputHandler();const timer=[...timers.values()].find(t=>t.delay===250);timers.clear();return timer?.fn();}
(async()=>{
 const pending=runSearch('alice');await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);
 input.value='bob';await inputHandler();const next=[...timers.values()].find(t=>t.delay===250);timers.clear();const newer=next.fn();
 requests[0]({ok:true,json:async()=>({users:[{email:'bob@example.com',memberId:'22222222-2222-2222-2222-222222222222',name:'Bob',friendStatus:'friends'},{email:'hidden@example.com',memberId:'33333333-3333-3333-3333-333333333333',name:'Bob private',friendStatus:'none'}]})});await pending;await newer;
 assert.equal(list.children.length,1,'stale Alice response cannot replace Bob results');assert.equal(list.children[0].children[0].textContent,'Bob');assert.equal(list.children[0].href,'profile.html?member=22222222-2222-2222-2222-222222222222');assert.match(status.textContent,/1 matching user/);
 await runSearch('alice');assert.equal(list.children.length,1);assert.equal(list.children[0].children[0].textContent,'Alice','visible authors are searchable');assert.ok(!list.children.some(x=>x.href.includes('evil')));
 await runSearch('absent');assert.match(status.textContent,/No matching/);input.value='';await inputHandler();assert.equal(section.hidden,true);assert.equal(list.children.length,0);
 console.log('People search checks passed: contacts and visible authors, cached directory, stale response isolation, safe profile links, empty results, and clearing.');
})().catch(error=>{console.error(error);process.exitCode=1;});

