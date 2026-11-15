"use strict";
const assert=require("node:assert/strict");
(async()=>{
  const{createTicketing}=await import("./infrastructure/auth-api/ticketing.mjs");
  class Command{constructor(input){this.input=input;}}class GetItemCommand extends Command{}class PutItemCommand extends Command{}class QueryCommand extends Command{}class TransactWriteItemsCommand extends Command{}
  const records=new Map(),key=item=>`${item.pk.S}|${item.sk.S}`;
  const put=input=>{const current=records.get(key(input.Item));if(input.ConditionExpression==="attribute_not_exists(pk)"&&current){const error=new Error("exists");error.name="ConditionalCheckFailedException";throw error;}if(input.ConditionExpression==="revision = :revision"&&current?.revision?.N!==input.ExpressionAttributeValues[":revision"].N){const error=new Error("stale");error.name="TransactionCanceledException";throw error;}if(input.ConditionExpression==="ticketAllocated = :allocated"&&current?.ticketAllocated?.N!==input.ExpressionAttributeValues[":allocated"].N){const error=new Error("capacity changed");error.name="TransactionCanceledException";throw error;}records.set(key(input.Item),structuredClone(input.Item));};
  const db={async send(command){if(command instanceof GetItemCommand)return{Item:records.get(key(command.input.Key))};if(command instanceof PutItemCommand){put(command.input);return{};}if(command instanceof QueryCommand){const pk=command.input.ExpressionAttributeValues[":pk"].S,prefix=command.input.ExpressionAttributeValues[":tier"]?.S||command.input.ExpressionAttributeValues[":event"]?.S||"";return{Items:[...records.values()].filter(item=>item.pk.S===pk&&item.sk.S.startsWith(prefix))};}if(command instanceof TransactWriteItemsCommand){const snapshot=new Map(records);try{for(const action of command.input.TransactItems)put(action.Put);}catch(error){records.clear();for(const [k,v]of snapshot)records.set(k,v);throw error;}return{};}throw new Error(command.constructor.name);}};
  let user="artist_12345678";const service=createTicketing({db,commands:{GetItemCommand,PutItemCommand,QueryCommand,TransactWriteItemsCommand},authenticate:async()=>user,corsHeaders:origin=>origin==="https://danzstak.com"?{"access-control-allow-origin":origin}:{},tableName:"Marketplace",clock:()=>Date.parse("2026-11-09T12:00:00Z"),mediaOwnerPrefix:async id=>id==="artist_12345678"?"a".repeat(24):"b".repeat(24),signMedia:key=>`https://media.example/${key}?sig=1`});
  const call=(method,path,body,origin="https://danzstak.com")=>service({requestContext:{http:{method}},rawPath:path,headers:{origin},body:JSON.stringify(body||{})}),bodyOf=result=>JSON.parse(result.body);
  const base={title:"Basement Show",description:"",venueName:"The Pit",venueAddress:"Oakland",startsAt:"2027-01-05T03:00:00.000Z",timezone:"America/Los_Angeles",capacity:100,status:"published"};
  const flyer=`users/${"a".repeat(24)}/11111111-1111-4111-8111-111111111111.jpg`, video=`users/${"a".repeat(24)}/22222222-2222-4222-8222-222222222222.mp4`;
  // Flyer image is accepted and signed in the response.
  let r=await call("POST","/marketplace/events",{...base,mediaKey:flyer,mediaType:"image"});assert.equal(r.statusCode,201);assert.equal(bodyOf(r).event.mediaType,"image");assert.match(bodyOf(r).event.mediaUrl,/media\.example/);
  // A video over 15 seconds is refused; 15 seconds is fine.
  assert.equal((await call("POST","/marketplace/events",{...base,title:"Long",mediaKey:video,mediaType:"video",mediaSeconds:16})).statusCode,400);
  assert.equal((await call("POST","/marketplace/events",{...base,title:"Clip",mediaKey:video,mediaType:"video",mediaSeconds:15})).statusCode,201);
  // Someone else's media is refused; a type mismatch is refused.
  assert.equal((await call("POST","/marketplace/events",{...base,title:"Stolen",mediaKey:`users/${"b".repeat(24)}/33333333-3333-4333-8333-333333333333.jpg`,mediaType:"image"})).statusCode,403);
  assert.equal((await call("POST","/marketplace/events",{...base,title:"Mismatch",mediaKey:flyer,mediaType:"video",mediaSeconds:5})).statusCode,400);
  // Drafts and past events stay out of the public Events list.
  await call("POST","/marketplace/events",{...base,title:"Draft",status:"draft",mediaKey:flyer,mediaType:"image"});
  await call("POST","/marketplace/events",{...base,title:"Last year",startsAt:"2026-01-01T03:00:00.000Z",mediaKey:flyer,mediaType:"image"});
  await call("POST","/marketplace/events",{...base,title:"Sooner",startsAt:"2026-12-01T03:00:00.000Z",mediaKey:flyer,mediaType:"image"});
  user="viewer_12345678";const list=bodyOf(await call("GET","/marketplace/events/upcoming"));
  assert.deepEqual(list.events.map(e=>e.title),["Sooner","Basement Show","Clip"]);assert.equal(list.events[0].organizerId,"");assert.match(list.events[0].mediaUrl,/media\.example/);
  // Outside ticket services (owner, 2026-11-15): https links only.
  user="artist_12345678";
  r=await call("POST","/marketplace/events",{...base,title:"Eventbrite show",mediaKey:flyer,mediaType:"image",ticketUrl:"https://www.eventbrite.com/e/basement-show-123"});assert.equal(r.statusCode,201);assert.equal(bodyOf(r).event.ticketUrl,"https://www.eventbrite.com/e/basement-show-123");
  for(const bad of ["javascript:alert(1)","http://tickets.example/x","https://user:pass@tickets.example/x","not a link"])assert.equal((await call("POST","/marketplace/events",{...base,title:"Bad link",mediaKey:flyer,mediaType:"image",ticketUrl:bad})).statusCode,400,bad);
  // Named tickets default ON; promoter may turn off (owner, 2026-11-16).
  r=await call("POST","/marketplace/events",{...base,title:"Named default",mediaKey:flyer,mediaType:"image"});assert.equal(bodyOf(r).event.namedTickets,true);
  r=await call("POST","/marketplace/events",{...base,title:"Punk night",mediaKey:flyer,mediaType:"image",namedTickets:false});assert.equal(bodyOf(r).event.namedTickets,false);
  console.log("Event flyer checks passed (with outside ticket links): flyer or 15-second video, media ownership, public upcoming list without drafts or past events.");
})().catch(error=>{console.error(error);process.exit(1);});
