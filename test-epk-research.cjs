"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");

(async () => {
  const { cleanArtistIdentity, selectMusicBrainzCandidate, parseDraft, buildDraftPrompt, createEpkResearch } = await import("./infrastructure/auth-api/epk-research.mjs");
  const identity = cleanArtistIdentity({ artistName:"Codex Band", hometown:"Tacoma", website:"https://codex.band", spotify:"javascript:alert(1)" });
  assert.equal(identity.artistName, "Codex Band"); assert.equal(identity.links.website, "https://codex.band/"); assert.equal(identity.links.spotify, undefined, "unsafe links must be removed");
  const ambiguous = selectMusicBrainzCandidate([{id:"11111111-1111-4111-a111-111111111111",name:"Same",score:95},{id:"22222222-2222-4222-a222-222222222222",name:"Same",score:92}], cleanArtistIdentity({artistName:"Same"}));
  assert.equal(ambiguous.needsClarification, true, "similar names without context need artist clarification");
  const chosen = selectMusicBrainzCandidate(ambiguous.candidates, cleanArtistIdentity({artistName:"Same",musicbrainzId:"22222222-2222-4222-a222-222222222222"}));
  assert.equal(chosen.selected.id, "22222222-2222-4222-a222-222222222222");
  const parsed = parseDraft(JSON.stringify({ shortBio:{text:"A sourced band.",sourceIds:["S1","S99"]},mediumBio:"Medium",fullBio:"Full",genres:[{text:"Punk",sourceIds:["S1"]}],releases:[{title:"Record",date:"2026",url:"javascript:bad",sourceIds:["S1"]}],notableShows:[],achievements:[],pressCoverage:[],links:[] }), new Set(["S1"]));
  assert.deepEqual(parsed.shortBio.sourceIds,["S1"]); assert.equal(parsed.releases[0].url,"", "AI URLs must be revalidated");
  assert.match(buildDraftPrompt(identity,{},[{id:"S1",title:"Source",url:"https://source.example/",description:"Evidence"}],"Professional"), /MUSIC ARTISTS ONLY/);

  const items = new Map(), keyOf = item => `${item.userId.S}|${item.tourId.S}`;
  class PutItemCommand { constructor(input){ this.input=input; } } class GetItemCommand { constructor(input){ this.input=input; } } class QueryCommand { constructor(input){ this.input=input; } }
  const db = { send: async command => {
    if (command instanceof PutItemCommand) { items.set(keyOf(command.input.Item),command.input.Item); return {}; }
    if (command instanceof GetItemCommand) return { Item:items.get(`${command.input.Key.userId.S}|${command.input.Key.tourId.S}`) };
    if (command instanceof QueryCommand) return { Items:[...items.values()].filter(item => item.userId.S === command.input.ExpressionAttributeValues[":userId"].S && item.tourId.S.startsWith(command.input.ExpressionAttributeValues[":prefix"].S)).sort((a,b) => b.tourId.S.localeCompare(a.tourId.S)) };
    throw new Error("unexpected command");
  }};
  const fetchImpl = async url => {
    const href = String(url);
    if (href.includes("musicbrainz.org/ws/2/artist?") || href.includes("musicbrainz.org/ws/2/artist?")) return {ok:true,json:async()=>({artists:[{id:"11111111-1111-4111-a111-111111111111",name:"Codex Band",score:100,area:{name:"Tacoma"}}]})};
    if (href.includes("musicbrainz.org/ws/2/artist/")) return {ok:true,json:async()=>({id:"11111111-1111-4111-a111-111111111111",name:"Codex Band",type:"Group","release-groups":[{id:"33333333-3333-4333-a333-333333333333",title:"First Record","first-release-date":"2025-01-01","primary-type":"Album"}],relations:[]})};
    if (href.includes("api.search.brave.com")) return {ok:true,json:async()=>({web:{results:[{title:"Codex Band interview",url:"https://music.example/codex-band",description:"A documented interview."}]}})};
    throw new Error(`unexpected URL ${href}`);
  };
  let modelCalls = 0;
  const bedrock = { send:async command => { modelCalls += 1; assert.equal(command.input.inferenceConfig.maxTokens,2800,"Bedrock output must be capped"); return { output:{message:{content:[{text:JSON.stringify({shortBio:{text:"Codex Band is documented by the supplied sources.",sourceIds:["S1"]},mediumBio:{text:"Medium sourced biography.",sourceIds:["S1"]},fullBio:{text:"Full sourced biography.",sourceIds:["S1"]},genres:[{text:"Punk",sourceIds:["S1"]}],releases:[{title:"First Record",date:"2025-01-01",sourceIds:["S2"]}],notableShows:[],achievements:[],pressCoverage:[],links:[]})}]}} , usage:{inputTokens:100,outputTokens:80} }; } };
  const handler = createEpkResearch({ db, commands:{GetItemCommand,PutItemCommand,QueryCommand}, authenticate:async()=>"artist-1", corsHeaders:()=>({}), tableName:"Tours", bedrock, fetchImpl, env:{BRAVE_SEARCH_API_KEY:"configured",EPK_RESEARCH_MODEL_ID:"amazon.nova-lite-v1:0",EPK_RESEARCH_DAILY_LIMIT:"3"}, now:()=>new Date("2026-11-03T12:00:00Z") });
  const event = { headers:{origin:"https://danzstak.com"}, body:JSON.stringify({identity:{artistName:"Codex Band",hometown:"Tacoma",website:"https://codex.band"},style:"Underground / Independent"}) };
  const first = await handler(event,"research"), firstBody = JSON.parse(first.body); assert.equal(first.statusCode,200); assert.equal(firstBody.sources.length >= 3,true); assert.equal(firstBody.draft.shortBio.text.includes("documented"),true); assert.equal(firstBody.approvals && Object.keys(firstBody.approvals).length,0);
  const cached = await handler(event,"research"); assert.equal(JSON.parse(cached.body).cached,true); assert.equal(modelCalls,1,"duplicate research should use the seven-day cache");
  const approval = await handler({headers:event.headers,body:JSON.stringify({researchId:firstBody.researchId,section:"shortBio",decision:"edited",value:"Artist-approved correction."})},"approval"); assert.equal(approval.statusCode,200); assert.equal(JSON.parse(approval.body).approvals.shortBio.decision,"edited");
  const history = await handler({headers:event.headers},"history"); assert.equal(JSON.parse(history.body).history.length,1);

  const html = fs.readFileSync("epk.html","utf8"), client = fs.readFileSync("assets/epk-research.js","utf8"), api = fs.readFileSync("infrastructure/auth-api/index.mjs","utf8"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1","utf8");
  for (const label of ["Research Again","Save Approved EPK","Refresh My EPK"]) assert.match(html,new RegExp(label),`${label} control missing`);
  for (const label of ["Approve","Edit","Rewrite","Reject"]) assert.match(client,new RegExp(`"${label}"`),`${label} section action missing`);
  assert.match(html,/Music artists only/i); assert.doesNotMatch(html,/comedian/i,"this task must remain music-artist only");
  assert.match(html,/Nothing below enters your EPK until/); assert.match(client,/byId\("saveDraft"\)\.click\(\)/,"approved work should save privately, not auto-publish");
  assert.match(api,/GET" && path === "\/epk\/versions/); assert.match(api,/epkVersionPrefix/); assert.match(deploy,/bedrock:InvokeModel/); assert.match(deploy,/POST \/epk\/research\/approval/);
  console.log("EPK research tests passed: sourced music-only research, ambiguity handling, caching, capped AI drafting, approval persistence, private save, and version history.");
})().catch(error => { console.error(error); process.exitCode=1; });
