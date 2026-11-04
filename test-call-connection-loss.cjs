"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const failSource = chat.match(/async function failConnection\([^\n]+/)[0];
const source = chat.match(/async function handleConnectionState\([^\n]+/)[0];

assert.match(chat, /function handleConnectionState\(activePeer\)/, "calls should monitor the exact peer whose state changed");
assert.match(chat, /state==="disconnected".*Call connection interrupted\. Reconnecting….*setTimeout/, "a temporarily disconnected mobile call should get a recovery window");
assert.match(chat, /peer!==activePeer\|\|activePeer\.connectionState==="connected"/, "a recovered or replaced peer must not be ended by a stale timer");
assert.match(chat, /function failConnection\(activePeer\).*signal\("hangup",\{reason:"connection-failed"\}\).*await end\(false\)/, "a failed peer should tell the other device before releasing media");
assert.match(chat, /event\.payload\?\.reason==="connection-failed"/, "the other device should distinguish a network failure from a person hanging up");
assert.match(chat, /async function end\(notify=true\).*clearTimeout\(connectionLossTimer\);connectionLossTimer=null/, "manual and remote hangup should cancel pending connection-loss cleanup");
assert.match(chat, /activePeer\.addEventListener\("connectionstatechange",\(\)=>handleConnectionState\(activePeer\)\)/, "connection events should retain their peer identity");

function setup(state = "disconnected") {
  const activePeer = { connectionState: state };
  const context = vm.createContext({
    peer: activePeer, contact: "friend@example.com", callId: "call-1",
    mode: "video",
    connectionLossTimer: null,
    timerCallback: null,
    cleared: [],
    statuses: [],
    ended: [], signals: [],
    t: value => value,
    tf: value => value,
    stopRingback() {},
    setStatus(value) { context.statuses.push(value); },
    clearTimeout(value) { context.cleared.push(value); },
    setTimeout(callback) { context.timerCallback = callback; return 37; },
    async signal(type,payload) { context.signals.push({type,payload}); },
    async end(notify) { context.ended.push(notify); context.peer = null; }
  });
  vm.runInContext(failSource+"\n"+source, context);
  return { context, activePeer };
}

(async () => {
  const transient = setup();
  await transient.context.handleConnectionState(transient.activePeer);
  assert.equal(transient.context.connectionLossTimer, 37, "a disconnected call should schedule bounded cleanup");
  assert.match(transient.context.statuses.at(-1), /Reconnecting/, "the user should see recovery feedback");
  transient.activePeer.connectionState = "connected";
  await transient.context.handleConnectionState(transient.activePeer);
  assert.equal(transient.context.connectionLossTimer, null, "a recovered call should cancel pending cleanup");
  assert.ok(transient.context.cleared.includes(37), "the recovery timer should be cleared after reconnection");
  assert.equal(transient.context.ended.length, 0, "a recovered call must remain active");

  const lost = setup();
  await lost.context.handleConnectionState(lost.activePeer);
  await lost.context.timerCallback();
  assert.deepEqual([...lost.context.ended], [false], "a sustained disconnect should release the call after notifying the peer");
  assert.equal(lost.context.signals[0].type, "hangup", "a sustained disconnect should stop the other device from hanging indefinitely");
  assert.equal(lost.context.signals[0].payload.reason, "connection-failed");
  assert.match(lost.context.statuses.at(-1), /could not connect the audio/, "a sustained disconnect should explain that notification and media transport are separate");

  const failed = setup("failed");
  await failed.context.handleConnectionState(failed.activePeer);
  assert.deepEqual([...failed.context.ended], [false], "a failed peer should end immediately");
  assert.equal(failed.context.signals.length, 1, "an immediate failure should notify the other device once");

  const stale = setup();
  await stale.context.handleConnectionState(stale.activePeer);
  stale.context.peer = { connectionState: "connected" };
  await stale.context.timerCallback();
  assert.equal(stale.context.ended.length, 0, "a stale peer timer must not end a replacement call");

  console.log("Call connection-loss checks passed: interrupted calls recover briefly, then release media and controls cleanly.");
})().catch(error => { console.error(error); process.exitCode = 1; });
