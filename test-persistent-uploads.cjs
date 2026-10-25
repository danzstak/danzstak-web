const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const template = fs.readFileSync('infrastructure/call-signaling/template.yaml', 'utf8');
const extract = name => template.match(new RegExp('          async function '+name+'[^\\n]+'))[0].trim();
let deleted = 0;
const context = vm.createContext({
  json: (statusCode, body) => ({statusCode, body}), ownerPrefix: () => 'owner', randomUUID: () => 'upload',
  mediaTypes: {'image/png':['image','png'], 'video/mp4':['video','mp4']}, signedMediaUrl: (_, key) => key,
  db: {send: async () => ({Item:{profileAvatarKey:{S:'users/owner/old.png'}}})},
  GetItemCommand: class {}, UpdateItemCommand: class {}, DeleteObjectCommand: class {},
  s3: {send: async () => { deleted++; throw new Error('cleanup unavailable'); }},
  process: {env:{}}, console: {error:()=>{}}, getProfile: async () => ({statusCode:200}),
});
vm.runInContext(extract('mediaUpload')+'\n'+extract('updateProfile'), context);
async function upload(purpose) {
  context.event={body:JSON.stringify({contentType:'image/png', ...(purpose ? {purpose}: {})})};
  return vm.runInContext('mediaUpload(event,{email:"owner@example.com"})', context);
}
(async()=>{
  assert.equal((await upload()).body.mediaKey,'stories/owner/upload.png');
  for(const purpose of ['post','profile']) assert.equal((await upload(purpose)).body.mediaKey,'users/owner/upload.png');
  assert.equal((await upload('../other')).statusCode,400);
  context.event={body:JSON.stringify({avatarKey:'users/owner/new.png'})};
  assert.equal((await vm.runInContext('updateProfile(event,{email:"owner@example.com"})',context)).statusCode,200);
  assert.equal(deleted,1,'cleanup failure does not undo a committed profile');
  context.event={body:JSON.stringify({avatarKey:'users/another/new.png'})};
  assert.equal((await vm.runInContext('updateProfile(event,{email:"owner@example.com"})',context)).statusCode,403);
  const auth = fs.readFileSync('infrastructure/auth-api/index.mjs','utf8');
  const videoCode = auth.slice(auth.indexOf('async function setProfileVideo(event)'), auth.indexOf('// CHECK SESSION'));
  const videoContext = vm.createContext({
    corsHeaders:()=>({}), allowedOrigins:new Set(['https://danzstak.com']),
    getAuthenticatedUser:async()=> 'user-id', accountForSub:async()=> 'owner@example.com', sha256:()=> 'a'.repeat(24),
    settingsTable:'settings', process:{env:{}}, console:{error:()=>{}},
    GetItemCommand:class {}, UpdateItemCommand:class {}, DeleteObjectCommand:class {},
    db:{send:async()=>({Item:{profileVideoKey:{S:'users/'+ 'a'.repeat(24)+'/old.mp4'}}})},
    s3:{send:async()=>{throw new Error('cleanup unavailable');}},
    event:{headers:{origin:'https://danzstak.com'},body:JSON.stringify({mediaKey:'users/'+ 'a'.repeat(24)+'/11111111-1111-1111-1111-111111111111.mp4'})}
  });
  vm.runInContext(videoCode,videoContext);
  assert.equal((await vm.runInContext('setProfileVideo(event)',videoContext)).statusCode,200,'video save survives old-file cleanup failure');
  const editor=fs.readFileSync('assets/profile-editor.js','utf8');
  assert.ok(editor.includes('purpose: "profile"'));
  assert.ok(!editor.includes('await discardCloudMedia('),'ambiguous saves cannot delete newly committed media');
  const feed=fs.readFileSync('feed.html','utf8');
  assert.equal((feed.match(/purpose: "post"/g)||[]).length,1,'post ticket uses permanent storage; Story tickets stay temporary');
  console.log('Persistent upload checks passed: ticket purposes, ownership, and cleanup failures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
