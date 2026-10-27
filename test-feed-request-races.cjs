const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('feed.html','utf8');
const newsCode = source.slice(source.indexOf('let newsLoadVersion = 0;'), source.indexOf('document.getElementById("newsInterest")?.addEventListener'));
const requests=[];
const select={value:'music'};
const container={children:[],_html:'',replaceChildren(){this.children=[];this._html='';},appendChild(node){this.children.push(node);},set innerHTML(value){this._html=value;this.children=[];},get innerHTML(){return this._html;}};
const document={
  getElementById:id=>id==='newsInterest'?select:id==='interestNews'?container:null,
  createElement:tag=>({tag,children:[],append(...nodes){this.children.push(...nodes);}})
};
const newsContext=vm.createContext({document,localStorage:{getItem:()=>null},encodeURIComponent,fetchWithDeadline:url=>new Promise(resolve=>requests.push({url,resolve}))});
vm.runInContext(newsCode,newsContext);
const tick=()=>new Promise(resolve=>setImmediate(resolve));

const friendCode=source.slice(source.indexOf('async function updateFeedFriend('),source.indexOf('async function loadFriends()'));
let alertMessage='';
const friendContext=vm.createContext({
  button:{textContent:'Add Friend',disabled:false,isConnected:true},
  fetchWithDeadline:async()=>{throw new Error('Connection failed');},
  loadOnlineUsers:async()=>{},loadFriends:async()=>{},alert:message=>{alertMessage=message;},Promise,JSON
});
vm.runInContext(friendCode,friendContext);

(async()=>{
  const old=vm.runInContext('loadInterestNews()',newsContext);
  select.value='sports';const current=vm.runInContext('loadInterestNews()',newsContext);
  requests[1].resolve({ok:true,json:async()=>({items:[{title:'Current sports',source:'Sports',url:'https://example.test/sports'}]})});await current;
  requests[0].resolve({ok:true,json:async()=>({items:[{title:'Old music',source:'Music',url:'https://example.test/music'}]})});await old;await tick();
  assert.equal(container.children.length,1);assert.equal(container.children[0].children[0].textContent,'Current sports','older news must not overwrite the current interest');

  await vm.runInContext('updateFeedFriend("/friends/request", {email:"friend@example.test"}, button)',friendContext);
  assert.equal(friendContext.button.disabled,false);assert.equal(friendContext.button.textContent,'Add Friend');assert.match(alertMessage,/Connection failed/);
  console.log('Feed request race checks passed: current news wins and failed friend actions restore retry controls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
