"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");

(async () => {
  Object.assign(process.env, { MEDIA_BUCKET:"example-private-media", AWS_REGION:"us-west-1", AWS_ACCESS_KEY_ID:"AKIAEXAMPLE", AWS_SECRET_ACCESS_KEY:"test-secret", AWS_SESSION_TOKEN:"test-token" });
  const { cleanEpk, epkForViewer } = await import("./infrastructure/auth-api/index.mjs");
  const html = fs.readFileSync("epk.html", "utf8"), client = fs.readFileSync("assets/epk.js", "utf8"), productionClient = fs.readFileSync("assets/epk-production.js", "utf8"), productionCss = fs.readFileSync("assets/epk-production.css", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(html, /id="actType"[\s\S]*value="band"[\s\S]*value="dj"[\s\S]*value="electronic"[\s\S]*value="solo"/);
  assert.match(html, /id="plotKind"[\s\S]*id="plotPosition"[\s\S]*id="addPlotItem"/);
  assert.match(html, /id="inputSource"[\s\S]*id="inputConnection"[\s\S]*id="inputStand"[\s\S]*id="inputPhantom"[\s\S]*id="addInputItem"/);
  assert.match(client, /production:window\.danzstakEpkProduction\?\.getData/);
  assert.match(client, /renderPublic\?\.\(kit\.production, kit\.actType\)/);
  assert.match(productionClient, /plotItems\.slice\(0,24\)/);
  assert.match(productionClient, /inputs\.slice\(0,48\)/);
  assert.match(productionClient, /textContent=value/);
  assert.match(productionCss, /min-height:44px/);
assert.match(worker, /danzstak-shell-v797/);
  for (const asset of ["epk-production.css", "epk-production.js"]) assert.match(worker, new RegExp(`/assets/${asset.replace(".", "\\.")}`));

  const kit = cleanEpk({
    artistName:"Production Test", actType:"electronic", publicDetails:{technical:true},
    production:{
      plotItems:[{id:"deck-a",kind:"dj-mixer",label:"Artist mixer",position:"front-center"},{id:"bad",kind:"laser",label:"Unsafe enum",position:"front-left"}],
      inputs:[{id:"left",source:"Playback left",connection:"di",stand:"none",phantom:false,notes:"Artist interface"},{id:"bad",source:"Bad",connection:"socket",stand:"none"}]
    }
  });
  assert.equal(kit.actType, "electronic");
  assert.deepEqual(kit.production.plotItems, [{id:"deck-a",kind:"dj-mixer",label:"Artist mixer",position:"front-center"}], "unknown plot equipment must not persist");
  assert.deepEqual(kit.production.inputs, [{id:"left",source:"Playback left",connection:"di",stand:"none",phantom:false,notes:"Artist interface"}], "unknown input connections must not persist");
  assert.equal(cleanEpk({artistName:"Fallback",actType:"comedian"}).actType, "band", "unknown act types must fall back safely");
  const publicKit = epkForViewer(kit, true);
  assert.equal(publicKit.production.plotItems.length, 1, "artist-approved production data should appear publicly");
  const privateTechnical = epkForViewer(cleanEpk({...kit, publicDetails:{technical:false}}), true);
  assert.deepEqual(privateTechnical.production, {plotItems:[],inputs:[]}, "private production data must not leave the owner response");
  assert.equal("publicDetails" in publicKit, false, "publication choices must remain internal");
  console.log("EPK production checks passed: act-specific stage or booth plots, bounded input lists, safe rendering, mobile targets, privacy, and PWA caching.");
})().catch(error => { console.error(error); process.exitCode = 1; });
