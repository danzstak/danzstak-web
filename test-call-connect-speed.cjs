"use strict";
// Owner 2026-11-19: "it takes a long time to connect to user" / "When I click accept it opens sync but it's way too late".
// chat.js sends each offer and answer with its ICE candidates, and used to wait for gathering to finish: up to 5 s on each
// side (the other phone only rang after the caller's wait). This drives waitIce() with simulated candidates and times it:
// a relay candidate sends 250 ms later, a public one 1 s later, nothing at all at most 2 s; plus the wiring for fetching
// relay servers before a call and the caller's half-second check for the answer.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("assets/chat.js", "utf8");
const start = source.indexOf("function waitIce(target=peer){"), end = source.indexOf("\n", start);
assert.ok(start > 0 && end > start, "waitIce(target) is in chat.js");
const waitIce = new Function("peer", `${source.slice(start, end)}; return waitIce;`)(null);

class FakePeer extends EventTarget {
  constructor() { super(); this.iceGatheringState = "gathering"; }
  candidate(type, at) { setTimeout(() => this.dispatchEvent(Object.assign(new Event("icecandidate"), { candidate: { type, candidate: `candidate:1 1 udp 1 192.0.2.1 50000 typ ${type}` } })), at); }
  done(at) { setTimeout(() => { this.iceGatheringState = "complete"; this.dispatchEvent(new Event("icegatheringstatechange")); }, at); }
}
const timed = async (setup, label) => { const peer = new FakePeer(); setup(peer); const t0 = Date.now(); await waitIce(peer); return Date.now() - t0; };
const near = (ms, want, label) => assert.ok(ms >= want - 30 && ms <= want + 150, `${label}: ${ms} ms, expected about ${want} ms`);

(async () => {
  near(await timed(peer => { peer.candidate("host", 10); peer.candidate("srflx", 100); peer.candidate("relay", 300); }), 550, "relay at 300 ms → sent 250 ms later");
  near(await timed(peer => { peer.candidate("host", 10); peer.candidate("srflx", 100); }), 1100, "public candidate only → 1 s later");
  near(await timed(peer => { peer.candidate("host", 10); }), 2000, "no public or relay candidate → never later than 2 s");
  near(await timed(peer => { peer.candidate("host", 10); peer.done(400); }), 400, "gathering finished → sent at once");
  const finished = new FakePeer(); finished.iceGatheringState = "complete"; const t0 = Date.now(); await waitIce(finished); assert.ok(Date.now() - t0 < 20, "already complete → no wait");
  assert.doesNotMatch(source, /setTimeout\(resolve,5000\)/, "no 5-second wait");
  assert.match(source, /async function accept\(\)\{[^]*?await waitIce\(\);[^]*?await signal\("answer"/, "the answer goes out after the short wait");
  assert.match(source, /prefetchIce\(\);registrationRetryAt=0;/, "relay servers are fetched as soon as SYNC is ready");
  assert.match(source, /if\(iceServers\.length\)iceServerCache=\{iceServers,/, "a prefetch keeps only real relay servers, never the fallback");
  assert.match(source, /setInterval\(\(\)=>\{if\(peer&&!pending&&!peer\.remoteDescription&&mode!=="text"\)poll\(\);\},500\);/, "the caller checks for the answer every half second");
  console.log("Call connect speed checks passed: ICE wait 250 ms after a relay, 1 s after a public candidate, 2 s at most (was 5 s on each side); relay servers fetched before the call; the caller checks for the answer every 0.5 s.");
})().catch(error => { console.error(error); process.exitCode = 1; });
