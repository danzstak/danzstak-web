const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const helper = source.slice(source.indexOf('const bookingWorkspaceId ='), source.indexOf('async function saveTourPlan(event)'));
let calls = [], authenticated = 'owner-a', stored, conflict = false;
class Command { constructor(input) { this.input = input; } }
class QueryCommand extends Command {}
class GetItemCommand extends Command {}
class PutItemCommand extends Command {}
const context = vm.createContext({
  Buffer, randomUUID: () => 'new-revision', toursTable:'tours',
  corsHeaders: () => ({}), allowedOrigins: new Set(['https://danzstak.com']),
  getAuthenticatedUser: async () => authenticated,
  parseJsonBody: event => event.body,
  GetItemCommand, PutItemCommand, QueryCommand,
  db: { send: async command => { calls.push(command.input); if (command instanceof QueryCommand) return {Items:sends}; if (conflict && command instanceof PutItemCommand) { const e = Error(); e.name = 'ConditionalCheckFailedException'; throw e; } return {Item:stored}; } }
});
let sends = [];
const request = (method, body, origin='https://danzstak.com') => context.bookingWorkspace({headers:{origin},body}, method);
(async () => {
  Object.assign(context, await import('./infrastructure/auth-api/booking-pipeline.mjs'));
  Object.assign(context, await import('./infrastructure/auth-api/booking-venue-signals.mjs'), { BatchGetItemCommand: class extends Command {}, UpdateItemCommand: class extends Command {}, TransactWriteItemsCommand: class extends Command {}, createHash: require('node:crypto').createHash });
  vm.runInContext(helper, context);
  assert.equal((await request('GET', null, 'https://evil.example')).statusCode,403);
  authenticated = '';
  assert.equal((await request('GET')).statusCode,401);
  assert.equal(calls.length,0, 'unauthorized requests must not touch storage');
  authenticated = 'owner-a';
  const empty = JSON.parse((await request('GET')).body);
  assert.deepEqual(empty.venues,[]); assert.deepEqual(empty.artist,{}); assert.equal(empty.revision,''); assert.equal(empty.estimate.bookingEmails,0);
  const reads = calls.filter(call => call.Key), opensQuery = calls.find(call => call.ExpressionAttributeValues?.[':prefix']?.S === 'EPK#OUTREACH#');
  assert.equal(reads.at(-1).Key.userId.S,'owner-a');
  assert.equal(reads.at(-1).ConsistentRead,true);
  assert.equal(opensQuery?.ExpressionAttributeValues[':userId'].S,'owner-a', 'EPK opens are read only for the signed-in artist');
  assert.deepEqual(empty.stats,{sent:0,delivered:0,bounced:0,opened:0,replied:0,booked:0,replyRate:null,bookedRate:null});
  assert.equal((await request('POST',{venues:Array(101).fill({name:'x'}),revision:''})).statusCode,400);
  const body = {revision:'old', artist:{name:'The Act',epk:'javascript:alert(1)'}, venues:[{name:'The Room',websites:['javascript:alert(1)','https://room.example'],booking:{stage:'made-up',showDate:'2026-02-31',notes:'x'.repeat(2500),outreachDraft:'d'.repeat(6000)}}]};
  assert.equal((await request('POST',body)).statusCode,200);
  const write = calls.at(-1), plan = JSON.parse(write.Item.plan.S);
  assert.equal(write.Item.userId.S,'owner-a');
  assert.equal(write.ConditionExpression,'revision = :revision');
  assert.equal(write.ExpressionAttributeValues[':revision'].S,'old');
  assert.equal(plan.artist.epk,'');
  assert.deepEqual(plan.venues[0].websites,['https://room.example']);
  assert.equal(plan.venues[0].booking.status,'Not contacted');
  assert.equal(plan.venues[0].booking.showDate,'');
  assert.equal(plan.venues[0].booking.notes.length,2000);
  assert.equal(plan.venues[0].booking.outreachDraft.length,5000);
  await request('POST',{venues:[],revision:''});
  assert.equal(calls.at(-1).ConditionExpression,'attribute_not_exists(userId)');
  conflict=true;
  assert.equal((await request('POST',body)).statusCode,409);
  conflict=false;
  stored={userId:{S:'owner-a'},tourId:{S:'booking-workspace-v1'},name:{S:'Booking workspace'},revision:{S:'old'},plan:{S:JSON.stringify({venues:[{name:'Keep Me'}],artist:{name:'Old Act',genre:'Punk',hometown:'Old City',pitch:'Keep pitch'},tour:{name:'Keep Tour'}})}};
  authenticated='owner-a';
  let identity=await context.bookingIdentity({headers:{origin:'https://danzstak.com'},body:{name:'New Act',hometown:'Portland, OR, United States',revision:'old'}});
  assert.equal(identity.statusCode,200);
  let identityWrite=calls.at(-1), identityPlan=JSON.parse(identityWrite.Item.plan.S);
  assert.deepEqual(identityPlan.venues,[{name:'Keep Me'}],'identity edits must preserve venue selections');
  assert.equal(identityPlan.artist.genre,'Punk'); assert.equal(identityPlan.artist.pitch,'Keep pitch');
  assert.equal(identityPlan.artist.name,'New Act'); assert.equal(identityPlan.artist.hometown,'Portland, OR, United States');
  assert.equal(identityPlan.tour.name,'Keep Tour','identity edits must preserve tour settings');
  assert.equal(identityWrite.ConditionExpression,'revision = :revision');
  assert.equal((await context.bookingIdentity({headers:{origin:'https://danzstak.com'},body:{name:'x',hometown:'',revision:'old'}})).statusCode,400);
  assert.equal((await context.bookingIdentity({headers:{origin:'https://danzstak.com'},body:{name:'x',hometown:'Portland',revision:'stale'}})).statusCode,409);
  conflict=true;
  identity=await context.bookingIdentity({headers:{origin:'https://danzstak.com'},body:{name:'New Act',hometown:'Portland',revision:'old'}});
  assert.equal(identity.statusCode,409,'concurrent identity saves must fail safely');
  conflict=false;
  authenticated='owner-b';
  await request('GET');
  assert.ok(calls.slice(-4).every(call => (call.Key?.userId ?? call.ExpressionAttributeValues?.[':userId'])?.S === 'owner-b'),'another account must use its own partition');
  // Pipeline stages follow real events: a sent pitch is at least pitched, a venue reply at least replied.
  authenticated='owner-a';
  const pitchedAt='2026-11-01T10:00:00.000Z';
  sends=[{tourId:{S:'TOUR_MANAGER#EMAIL_SEND#pitch000000000001'},venueKey:{S:'aaaaaaaaaaaaaaaaaaaa'},status:{S:'sent'},sentAt:{S:pitchedAt}}];
  stored={userId:{S:'owner-a'},tourId:{S:'booking-workspace-v1'},revision:{S:'r1'},plan:{S:JSON.stringify({venues:[{name:'Pitched Room',venueKey:'aaaaaaaaaaaaaaaaaaaa',booking:{status:'Not contacted'}}],artist:{},tour:{}})}};
  let loaded=JSON.parse((await request('GET')).body);
  assert.equal(loaded.venues[0].booking.status,'Email sent','a successful send moves the card to pitched');
  assert.equal(loaded.epk.ready,false,'the workspace reports the EPK gate'); assert.equal(loaded.epk.total,6); assert.ok(Array.isArray(loaded.epk.missing));
  assert.equal(loaded.venues[0].booking.pipeline.stage,'pitched');
  assert.equal(loaded.venues[0].booking.pipeline.threadId,'pitch000000000001');
  assert.equal(loaded.venues[0].booking.followUp,'2026-11-06','follow-up is due 5 days after the pitch');
  sends[0].status={S:'replied'}; sends[0].repliedAt={S:'2026-11-03T09:00:00.000Z'};
  loaded=JSON.parse((await request('GET')).body);
  assert.equal(loaded.venues[0].booking.status,'Reply received','an inbound reply moves the card to replied');
  assert.equal(loaded.venues[0].booking.pipeline.repliedAt,'2026-11-03T09:00:00.000Z');
  // A stale tab saving an older status cannot pull the card back below its events.
  let saved=await request('POST',{revision:'r1',venues:[{name:'Pitched Room',venueKey:'aaaaaaaaaaaaaaaaaaaa',booking:{status:'Email sent'}}]});
  assert.equal(saved.statusCode,200);
  assert.equal(JSON.parse(saved.body).statuses.aaaaaaaaaaaaaaaaaaaa.status,'Reply received');
  assert.equal(JSON.parse(calls.at(-1).Item.plan.S).venues[0].booking.status,'Reply received');
  assert.equal(JSON.parse(calls.at(-1).Item.plan.S).venues[0].booking.pipeline,undefined,'derived pipeline view is not stored');
  // Backward moves are refused.
  stored.plan.S=JSON.stringify({venues:[{name:'Booked Room',venueKey:'bbbbbbbbbbbbbbbbbbbb',booking:{status:'Confirmed',showDate:'2026-12-01',confirmationEvidence:'Yes'}}]});
  saved=await request('POST',{revision:'r1',venues:[{name:'Booked Room',venueKey:'bbbbbbbbbbbbbbbbbbbb',booking:{status:'Email prepared'}}]});
  assert.equal(saved.statusCode,409); assert.match(JSON.parse(saved.body).error,/can't move from Confirmed/);
  saved=await request('POST',{revision:'r1',venues:[{name:'Booked Room',venueKey:'bbbbbbbbbbbbbbbbbbbb',booking:{status:'Played',showDate:'2999-12-01',confirmationEvidence:'Yes'}}]});
  assert.equal(saved.statusCode,409,'played only after the show date'); assert.match(JSON.parse(saved.body).error,/after its show date/);
  saved=await request('POST',{revision:'r1',venues:[{name:'Booked Room',venueKey:'bbbbbbbbbbbbbbbbbbbb',booking:{status:'Played',showDate:'2026-01-01',confirmationEvidence:'Yes'}}]});
  assert.equal(saved.statusCode,200);
  sends=[];
  const exportCore = require('./assets/account-export-core.js');
  const workspace = { venues: [{name:'The Room',booking:{stage:'Contacted'}}], artist: {name:'The Act'} };
  const archive = exportCore.buildAccountArchive({bookingWorkspace:workspace}, {}, {});
  assert.deepEqual(archive.bookingWorkspace,workspace,'owned booking records must remain portable in the account export');
  console.log('Booking workspace API checks passed: pipeline stages from real events, no backward moves, account isolation, identity preservation, origins, validation, bounded records, and conflict protection.');
})().catch(error => {console.error(error);process.exitCode=1;});
