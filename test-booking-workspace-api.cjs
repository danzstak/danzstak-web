const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const helper = source.slice(source.indexOf('const bookingWorkspaceId ='), source.indexOf('async function saveTourPlan(event)'));
let calls = [], authenticated = 'owner-a', stored, conflict = false;
class Command { constructor(input) { this.input = input; } }
const context = vm.createContext({
  Buffer, randomUUID: () => 'new-revision', toursTable:'tours',
  corsHeaders: () => ({}), allowedOrigins: new Set(['https://danzstak.com']),
  getAuthenticatedUser: async () => authenticated,
  parseJsonBody: event => event.body,
  GetItemCommand: class extends Command {}, PutItemCommand: class extends Command {},
  db: { send: async command => { calls.push(command.input); if (conflict) { const e = Error(); e.name = 'ConditionalCheckFailedException'; throw e; } return {Item:stored}; } }
});
vm.runInContext(helper, context);
const request = (method, body, origin='https://danzstak.com') => context.bookingWorkspace({headers:{origin},body}, method);
(async () => {
  assert.equal((await request('GET', null, 'https://evil.example')).statusCode,403);
  authenticated = '';
  assert.equal((await request('GET')).statusCode,401);
  assert.equal(calls.length,0, 'unauthorized requests must not touch storage');
  authenticated = 'owner-a';
  assert.deepEqual(JSON.parse((await request('GET')).body), {venues:[],artist:{},revision:''});
  assert.equal(calls.at(-1).Key.userId.S,'owner-a');
  assert.equal(calls.at(-1).ConsistentRead,true);
  assert.equal((await request('POST',{venues:Array(101).fill({name:'x'}),revision:''})).statusCode,400);
  const body = {revision:'old', artist:{name:'The Act',epk:'javascript:alert(1)'}, venues:[{name:'The Room',websites:['javascript:alert(1)','https://room.example'],booking:{stage:'made-up',showDate:'2026-02-31',notes:'x'.repeat(2500),outreachDraft:'d'.repeat(6000)}}]};
  assert.equal((await request('POST',body)).statusCode,200);
  const write = calls.at(-1), plan = JSON.parse(write.Item.plan.S);
  assert.equal(write.Item.userId.S,'owner-a');
  assert.equal(write.ConditionExpression,'revision = :revision');
  assert.equal(write.ExpressionAttributeValues[':revision'].S,'old');
  assert.equal(plan.artist.epk,'');
  assert.deepEqual(plan.venues[0].websites,['https://room.example']);
  assert.equal(plan.venues[0].booking.stage,'Research');
  assert.equal(plan.venues[0].booking.showDate,'');
  assert.equal(plan.venues[0].booking.notes.length,2000);
  assert.equal(plan.venues[0].booking.outreachDraft.length,5000);
  await request('POST',{venues:[],revision:''});
  assert.equal(calls.at(-1).ConditionExpression,'attribute_not_exists(userId)');
  conflict=true;
  assert.equal((await request('POST',body)).statusCode,409);
  conflict=false;
  authenticated='owner-b';
  await request('GET');
  assert.equal(calls.at(-1).Key.userId.S,'owner-b','another account must use its own partition');
  const exportCore = require('./assets/account-export-core.js');
  const workspace = { venues: [{name:'The Room',booking:{stage:'Contacted'}}], artist: {name:'The Act'} };
  const archive = exportCore.buildAccountArchive({bookingWorkspace:workspace}, {}, {});
  assert.deepEqual(archive.bookingWorkspace,workspace,'owned booking records must remain portable in the account export');
  console.log('Booking workspace API checks passed: account isolation, origins, validation, bounded records, and conflict protection.');
})().catch(error => {console.error(error);process.exitCode=1;});
