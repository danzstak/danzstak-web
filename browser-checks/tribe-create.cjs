"use strict";
// Design 29a step 1 (owner 2026-11-18): Tribe create screen: full screen above the app bars, name checks + counter,
// live preview, category chips, optional description, Create opens the new Tribe.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/tribe-create.cjs
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const { chromium } = require("playwright");(async()=>{const b=await chromium.launch();
for (const w of [320,360,390,430]){const c=await b.newContext({viewport:{width:w,height:844},isMobile:true,hasTouch:true});const p=await c.newPage();p.on("pageerror",e=>console.log("ERR",e.message));
const cors={"access-control-allow-origin":new URL(baseUrl).origin,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS"};
let posted=null;
await p.route("https://api.danzstak.com/**",r=>{const q=r.request();if(q.method()==="OPTIONS")return r.fulfill({status:204,headers:cors});const u=new URL(q.url()).pathname;let body={},st=200;if(u==="/auth/session")body={authenticated:true,user:{sub:"me",email:"me@x.invalid",name:"Eroticon"}};
if(u==="/groups"&&q.method()==="GET")body={groups:[]};if(u==="/groups"&&q.method()==="POST"){posted=JSON.parse(q.postData());st=201;body={group:{id:"55555555-5555-4555-8555-555555555555",name:posted.name,category:posted.category,description:posted.description,memberCount:1,joined:true,isOwner:true,isElder:true}};}
return r.fulfill({status:st,contentType:"application/json",headers:cors,body:JSON.stringify(body)})});
await p.goto(baseUrl+"/feed.html#groups");await p.waitForTimeout(2500);
await p.locator(".groups-create-toggle").first().click();await p.waitForTimeout(300);
await p.locator(".tribe-create-screen input").first().fill("Bologna Night Shift");await p.locator(".tribe-create-chip",{hasText:"DJs"}).click();
await p.locator(".tribe-create-desc textarea").fill("Techno and electro nights in Bologna.");
await p.waitForTimeout(300);if(w===390)await p.screenshot({path:"docs/screenshots/tribe-create-390.png"});
assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=w,`${w}px no sideways scroll`);assert.match(await p.locator(".tribe-create-note").textContent(),/Looks good/);assert.equal(await p.locator(".tribe-create-preview-name").textContent(),"Bologna Night Shift","live preview");assert.equal(await p.evaluate(()=>document.querySelector(".tribe-create-chip[aria-checked=true]").textContent),"DJs & Producers");const top=await p.evaluate(()=>{const f=document.querySelector(".tribe-create-footer button").getBoundingClientRect();return document.elementFromPoint(f.left+f.width/2,f.top+f.height/2)?.closest(".tribe-create-footer")!==null});assert.ok(top,`${w}px Create is on top of the app bars`);
await p.locator(".tribe-create-screen .group-standards-agreement input").check();await p.locator(".tribe-create-footer button").click();await p.waitForTimeout(1200);
assert.equal(posted.name,"Bologna Night Shift");assert.equal(posted.description,"Techno and electro nights in Bologna.");assert.match(await p.evaluate(()=>document.querySelector(".tribe-hero")?.textContent||""),/Bologna Night Shift/,`${w}px the new Tribe opens`);
await c.close();}
console.log("Tribe create checks passed at 320/360/390/430px: full screen, name checks, live preview, chips, Create opens the new Tribe.");await b.close()})().catch(e=>{console.error(e);process.exitCode=1;})
