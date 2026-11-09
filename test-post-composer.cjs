const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const feed=fs.readFileSync('feed.html','utf8');
const code=feed.slice(feed.indexOf('publishBtn.addEventListener("click", async () => {'),feed.indexOf('// LIKE AND COMMENT BUTTONS'));
let handler,resolveSave;
const checkbox={checked:true};
const context=vm.createContext({
  publishBtn:{addEventListener:(_,fn)=>handler=fn},postText:{value:'First post'},postAudience:{value:'public'},
  shareToStory:{checked:false,dataset:{}},shareToReels:{checked:false},document:{getElementById:()=>checkbox},
  window:{danzstakSelectedMedia:null,dispatchEvent:()=>{}},CustomEvent:class {},API_URL:'/secure-posts',
  fetchWithDeadline:()=>new Promise(resolve=>resolveSave=resolve),feed:{prepend:()=>{}},createPostElement:()=>({}),
  feedStatus:{},console:{log:()=>{},error:()=>{}},alert:()=>{},discardUploadedMedia:async()=>{}
});
vm.runInContext(code,context);
(async()=>{
  const pending=handler();context.postText.value='Next draft';
  resolveSave({ok:true,status:200,json:async()=>({postId:'one',content:'First post'})});await pending;
  assert.equal(context.postText.value,'Next draft','pending save cannot erase new typing');
  const second=handler();resolveSave({ok:true,status:200,json:async()=>({postId:'two'})});await second;
  assert.equal(context.postText.value,'');assert.equal(checkbox.checked,false,'new posts need fresh certification');
  const enhancements=fs.readFileSync('assets/feed-enhancements.js','utf8');
  const enhancementCss=fs.readFileSync('assets/feed-enhancements.css','utf8');
  const start=enhancements.indexOf('  window.addEventListener("danzstak:post-published", event => {');
  const cleanup=enhancements.slice(start,enhancements.indexOf('\n  if (isLocalHost()) {',start));
  let cleanupHandler,cleared=0;const mediaContext=vm.createContext({
    window:{addEventListener:(_,fn)=>cleanupHandler=fn,danzstakSelectedMedia:{url:'new-draft'}},
    selectedMedia:{url:'new-draft'},isLocalHost:()=>false,preview:{replaceChildren:()=>cleared++},collapseComposer:()=>{},
    document:{getElementById:()=>({dataset:{}})}
  });
  vm.runInContext(cleanup,mediaContext);
  cleanupHandler({detail:{mediaUrl:'old-upload'}});assert.equal(cleared,0,'older post cannot clear newly selected media');
  cleanupHandler({detail:{mediaUrl:'new-draft'}});assert.equal(cleared,1);assert.equal(mediaContext.window.danzstakSelectedMedia,null);
  assert.match(enhancements,/function hydratePostComposerAvatar\(\)/,'the composer hydrates the signed-in member avatar');
  assert.match(enhancements,/image\.onload = \(\) =>/,'profile photos replace initials only after loading successfully');
  assert.match(enhancements,/avatar\.style\.backgroundImage = `url\("\$\{picture\}"\)`/,'the authenticated profile photo appears in the composer');
  assert.match(enhancements,/profile\.picture \|\| media\.avatar/,'a profile photo saved on this device remains available in Mix');
  assert.match(enhancements,/post\?\.isOwner === true && String\(post\.authorPicture/,'legacy accounts recover their signed-in profile photo from an owned post');
  assert.match(feed,/\.composer-avatar \{[^}]*center\/cover no-repeat/,'composer photos remain circular and correctly cropped');
  assert.match(feed,/class="panel post-composer" id="postComposer"/,'the feed exposes one stable compact composer container');
  assert.match(enhancements,/composerText\?\.addEventListener\("focus", expandComposer\)/,'focusing the post prompt expands every publishing control');
  assert.match(enhancements,/button\.addEventListener\("click", \(\) => \{ expandComposer\(\); input\.click\(\); \}\)/,'photo and video shortcuts expand the composer before selection');
  assert.match(enhancementCss,/@media\(max-width:700px\)\{[\s\S]*\.post-composer:not\(\.is-expanded\) \.composer-actions\{display:none!important\}/,'phone composer keeps advanced controls out of the initial viewport');
  assert.match(enhancementCss,/\.post-composer:not\(\.is-expanded\) #postText\{min-height:54px/,'collapsed phone composer keeps a familiar compact prompt');
  console.log('Post composer checks passed: compact mobile intent state, pending drafts, fresh certification, and matching-media cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
