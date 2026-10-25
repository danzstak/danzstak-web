const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/feed-enhancements.js','utf8');
const start=source.indexOf('let internalReelsVersion = 0;');
const code=source.slice(start,source.indexOf('function reelPlatform(',start));
const requests=[],rendered=[];
const context=vm.createContext({hiddenPostIds:new Set(['hidden']),internalReels:[],
  fetch:()=>new Promise(resolve=>requests.push(resolve)),renderPlayableReels:()=>rendered.push(true),placeReelsRail:()=>{}
});vm.runInContext(code,context);
const video=(id,mediaUrl='')=>({postId:id,reel:true,mediaType:'video',mediaKey:id,mediaUrl,content:id});
(async()=>{
  context.posts=[video('old')];const old=vm.runInContext('loadInternalReels(posts)',context);
  context.posts=[video('current','https://example.com/current.mp4'),video('hidden','https://example.com/hidden.mp4')];
  await vm.runInContext('loadInternalReels(posts)',context);
  assert.equal(context.internalReels.length,1);assert.equal(context.internalReels[0].postId,'current');
  requests[0]({ok:true,json:async()=>({mediaUrl:'https://example.com/old.mp4'})});await old;
  assert.equal(context.internalReels[0].postId,'current','delayed list cannot restore a removed Reel');
  context.posts=[video('bad'),video('good','https://example.com/good.mp4')];
  const malformed=vm.runInContext('loadInternalReels(posts)',context);
  requests[1]({ok:true,json:async()=>{throw Error('invalid JSON');}});await malformed;
  assert.equal(context.internalReels.length,1);assert.equal(context.internalReels[0].postId,'good');
  const cacheStart=source.indexOf('function updateLoadedPost(postId, changes)');
  const cacheCode=source.slice(cacheStart,source.indexOf('function addPostDeleteButton(',cacheStart));
  const events=[];const cache=vm.createContext({window:{danzstakLoadedPosts:[video('one'),video('two')],dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(name,options){this.detail=options.detail;}}});
  vm.runInContext(cacheCode,cache);vm.runInContext('updateLoadedPost("one",{content:"Edited title",audience:"private"})',cache);
  assert.equal(cache.window.danzstakLoadedPosts[0].content,'Edited title');
  assert.equal(cache.window.danzstakLoadedPosts[1].content,'two');assert.equal(events.length,1);
  assert.equal(events[0].detail.posts[0].audience,'private');
  console.log('Reel refresh checks passed: stale responses, hidden posts, malformed media, and edited post cache.');
})().catch(error=>{console.error(error);process.exitCode=1;});
