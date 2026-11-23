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

function setup(state = "disconnected", { role = "", connected = false } = {}) {
  const activePeer = { connectionState: state };
  const context = vm.createContext({
    peer: activePeer, contact: "friend@example.com", callId: "call-1",
    mode: "video",
    callRole: role, everConnected: connected, restartPending: false, restartCount: 0,
    restarts: [],
    restartIce(target) { context.restarts.push(target); },
    connectionLossTimer: null,
    timerCallback: null,
    timers: [],
    cleared: [],
    statuses: [],
    ended: [], signals: [],
    t: value => value,
    tf: value => value,
    stopRingback() {},
    callLinkState() {},
    setStatus(value) { context.statuses.push(value); },
    clearTimeout(value) { context.cleared.push(value); },
    setTimeout(callback, ms) { context.timers.push({ callback, ms }); if (callback.toString().includes("failConnection")) { context.timerCallback = callback; return 37; } return 38; },
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

  // Owner 2026-11-23 ("Glitched out and stopped working"): once a call has connected, a dropped network gets an ICE
  // restart from the caller and 25 s to come back before the call is ended; before it ever connected the 10 s rule stays.
  assert.equal(lost.context.timers.find(timer => timer.callback === lost.context.timerCallback).ms, 10000, "before the call ever connected: 10 s");
  const caller = setup("disconnected", { role: "caller", connected: true });
  await caller.context.handleConnectionState(caller.activePeer);
  assert.equal(caller.context.timers.find(timer => timer.callback === caller.context.timerCallback).ms, 25000, "a connected call gets 25 s to come back");
  assert.equal(caller.context.restartPending, true, "the page checks for the restart's answer quickly");
  const restartTimer = caller.context.timers.find(timer => timer.callback !== caller.context.timerCallback);
  assert.equal(restartTimer?.ms, 2000, "the caller tries an ICE restart 2 s into the drop");
  restartTimer.callback();
  assert.deepEqual(caller.context.restarts, [caller.activePeer], "the caller restarts ICE on the same call");
  const callerFailed = setup("failed", { role: "caller", connected: true });
  await callerFailed.context.handleConnectionState(callerFailed.activePeer);
  assert.equal(callerFailed.context.ended.length, 0, "a connected call whose ICE failed is not ended at once");
  assert.equal(callerFailed.context.timers.find(timer => timer.callback !== callerFailed.context.timerCallback)?.ms, 0, "a failed connection restarts at once");
  const callee = setup("disconnected", { role: "callee", connected: true });
  await callee.context.handleConnectionState(callee.activePeer);
  assert.equal(callee.context.timers.filter(timer => timer.callback !== callee.context.timerCallback).length, 0, "the person who answered waits for the caller's restart (no crossed offers)");
  assert.equal(callee.context.timers.find(timer => timer.callback === callee.context.timerCallback).ms, 25000);
  await callee.context.timerCallback();
  assert.match(callee.context.statuses.at(-1), /The call dropped\. Call again to keep talking\./, "a call that dropped for good says so (not the could-not-connect message)");
  const again = setup("disconnected", { role: "caller", connected: true });
  await again.context.handleConnectionState(again.activePeer);
  await again.context.handleConnectionState(again.activePeer);
  assert.equal(again.context.timers.filter(timer => timer.callback === again.context.timerCallback).length, 1, "a second 'disconnected' doesn't push the 25 s back");
  assert.match(chat, /async function restartIce\(activePeer\)\{if\(peer!==activePeer\|\|callRole!=="caller"\|\|restartCount>=3/, "only the caller restarts, at most three times");
  assert.match(chat, /createOffer\(\{iceRestart:true\}\)[\s\S]*?signal\("restart",activePeer\.localDescription\)/, "the restart offer goes over call-signaling's restart signal");
  assert.match(chat, /if\(event\.signalType==="restart"\)\{[\s\S]*?createAnswer\(\)[\s\S]*?signal\("restart-answer",peer\.localDescription\)/, "the other side answers a restart");

  console.log("Call connection-loss checks passed: interrupted calls recover briefly, then release media and controls cleanly; a connected call gets an ICE restart from the caller and 25 s before it ends, and says the call dropped.");
})().catch(error => { console.error(error); process.exitCode = 1; });
