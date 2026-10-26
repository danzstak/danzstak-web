const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const line = fs.readFileSync('infrastructure/call-signaling/template.yaml', 'utf8')
  .split('\n').find(value => value.includes('async function getStories('));
const current = 200000;
const iso = seconds => new Date(seconds * 1000).toISOString();
const story = (id, email, audience, ageSeconds, expiresAt) => ({
  storyId:{S:id}, userEmail:{S:email}, audience:{S:audience},
  mediaKey:{S:`stories/${id}.png`}, mediaType:{S:'image'},
  createdAt:{S:iso(current-ageSeconds)},
  ...(expiresAt === undefined ? {} : {expiresAt:{N:String(expiresAt)}})
});
const reel = {storyId:{S:'reel'},userEmail:{S:'me@example.com'},kind:{S:'reel'},content:{S:'https://example.test/reel.mp4'},createdAt:{S:iso(current-172800)}};
const items = [
  story('own','me@example.com','private',60,current+86340),
  story('public','someone@example.com','public',120,current+86280),
  story('friend','friend@example.com','friends',300,current+86100),
  story('stranger','stranger@example.com','friends',300,current+86100),
  story('private','other@example.com','private',300,current+86100),
  story('expired-ttl','someone@example.com','public',90000,current-3600),
  story('expired-legacy','someone@example.com','public',90000),
  reel
];
const deletedRecords = [], deletedMedia = [];
class DeleteItemCommand { constructor(input) { this.input=input; } }
class DeleteObjectCommand { constructor(input) { this.input=input; } }
class ListUsersCommand { constructor(input) { this.input=input; } }
const ctx = vm.createContext({
  process:{env:{STORIES_TABLE:'stories',FRIENDS_TABLE:'friends',MEDIA_BUCKET:'media',USER_POOL_ID:'pool'}}, now:()=>current,
  scanAll:async input=>{assert.equal(input.TableName,'stories');assert.ok(!input.FilterExpression);return items;},
  queryAll:async()=>[{status:{S:'friends'},friendEmail:{S:'friend@example.com'}}],
  db:{send:async command=>{deletedRecords.push(command.input.Key.storyId.S);}},
  s3:{send:async command=>{deletedMedia.push(command.input.Key);}}, DeleteItemCommand, DeleteObjectCommand,
  ListUsersCommand,
  cognito:{send:async command=>{const email=command.input.Filter.match(/"(.*)"/)[1];return {Users:[{Attributes:[{Name:'email',Value:email},{Name:'sub',Value:`member-${email}`},{Name:'name',Value:email==='someone@example.com'?'Public Story Author':email==='friend@example.com'?'Friend Story Author':'Current Member'}]}]};}},
  publicProfile:async(email,account)=>({memberId:account.Attributes.find(value=>value.Name==='sub').Value,name:account.Attributes.find(value=>value.Name==='name').Value}),
  mapLimit:async(values,_limit,task)=>Promise.all(values.map(task)),
  console:{warn(){}}, signedMediaUrl:(_,key)=>'https://media.test/'+key, json:(_,payload)=>payload
});
vm.runInContext(line.trim(),ctx);
(async()=>{
  const result=await ctx.getStories({email:'me@example.com'});
  assert.deepEqual(Array.from(result.stories,value=>value.storyId),['own','public','friend']);
  assert.deepEqual(Array.from(result.reels,value=>value.id),['reel'],'Reels remain until owner deletion');
  assert.deepEqual(deletedRecords.sort(),['expired-legacy','expired-ttl']);
  assert.deepEqual(deletedMedia.sort(),['stories/expired-legacy.png','stories/expired-ttl.png']);
  assert.equal(result.stories[1].isOwner,false);
  assert.equal(result.stories.find(value=>value.storyId==='public').displayName,'Public Story Author');
  assert.equal(result.stories.find(value=>value.storyId==='friend').displayName,'Friend Story Author');
  assert.equal(result.stories.find(value=>value.storyId==='public').memberId,'member-someone@example.com');
  assert.equal(result.reels[0].displayName,'Current Member');
  console.log('Story visibility checks passed: 24h expiry, legacy cleanup, durable Reels, audience privacy, and public display names.');
})().catch(error=>{console.error(error);process.exitCode=1;});
