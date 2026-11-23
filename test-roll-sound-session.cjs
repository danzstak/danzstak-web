"use strict";
// T0-A3 (owner 2026-11-19): "The Roll goes silent when it opens full screen." One sound choice is shared by the feed,
// The Roll strip and the full-screen Roll: it carries in and back, only the member changes it, a fresh visit is muted,
// and moving The Roll in the page (it moves itself to <body> for full screen) never re-mutes a playing video.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const documentEvents = {};
const queued = [];
let mutate = () => {};
function media(name, root) {
  let muted = true;
  const video = {
    name, root, tagName: "VIDEO", dataset: {}, style: { setProperty() {} }, videoWidth: 360, videoHeight: 640,
    readyState: 1, paused: true, isConnected: true, scrollTop: 0, classList: { contains: value => value === "reel-player" },
    get muted() { return muted; },
    set muted(value) { if (value !== muted) { muted = value; queued.push(video); } },
    matches(selector) { return String(selector).split(",").map(s => s.trim()).some(s => ["video", "iframe.reel-player", "video.reel-player"].includes(s)); },
    closest() { return null; }, getAttribute() { return ""; }, addEventListener() {},
    play() { if (this.failNext) { const name = this.failNext; this.failNext = null; return Promise.reject(Object.assign(new Error(name), { name })); } this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }, load() {}
  };
  return video;
}
function container(children) {
  return {
    children, scrollTop: 0, addEventListener() {}, removeEventListener() {},
    contains(node) { return children.includes(node); },
    querySelectorAll(selector) { return /video/.test(selector) ? children : []; }
  };
}
const flush = () => { while (queued.length) documentEvents.volumechange({ target: queued.shift() }); };
const a = media("a"), b = media("b"), roll = container([a, b]);
const document = {
  body: { querySelectorAll: () => [a, b] }, hidden: false,
  documentElement: { classList: { contains: () => false } },
  querySelectorAll(selector) { return selector === "video" ? [a, b] : []; },
  addEventListener(type, handler) { documentEvents[type] = handler; },
  createElement() { return { setAttribute() {}, addEventListener() {} }; }
};
let intersect;
const timers = [];
const runTimers = () => { while (timers.length) timers.shift()(); };
const context = {
  document, localStorage: { getItem: () => null, setItem() { throw new Error("the sound choice must stay in memory"); } },
  requestAnimationFrame: handler => handler(), cancelAnimationFrame() {}, CustomEvent: class {}, setTimeout: handler => timers.push(handler),
  IntersectionObserver: class { constructor(handler) { intersect = handler; } observe() {} unobserve() {} },
  MutationObserver: class { constructor(handler) { mutate = handler; } observe() {} }, addEventListener() {}, dispatchEvent() {}
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("assets/media-visibility.js", "utf8"), context);
flush();
const coordinator = context.danzstakMediaCoordinator, sound = context.danzstakMediaSound;
const view = (ra, rb) => { intersect([{ target: a, isIntersecting: ra > 0, intersectionRatio: ra }, { target: b, isIntersecting: rb > 0, intersectionRatio: rb }]); flush(); };

// A fresh visit: the strip autoplays muted, and opening full screen without a tap stays muted.
view(1, 0);
assert.equal(a.paused, false, "The Roll strip autoplays");
assert.equal(a.muted, true, "a fresh visit is muted");
assert.equal(coordinator.startSession(roll, a, { sound: true }), true);
flush();
assert.equal(a.muted, true, "opening full screen never turns sound on by itself");
coordinator.endSession(roll); flush();

// The member turns sound on in the strip, then opens full screen: The Roll moves to <body> (removed + added).
view(1, 0);
a.muted = false; flush();
assert.equal(sound.choice(), true, "the member's tap turns sound on");
assert.equal(coordinator.startSession(roll, a, { sound: true }), true);
flush();
mutate([{ removedNodes: [roll], addedNodes: [roll] }]);
flush();
assert.equal(a.muted, false, "moving The Roll into full screen must not re-mute the playing video");
assert.equal(sound.choice(), true, "the move must not count as the member muting it");

// The next full-screen video inherits sound on; only one plays and only one has sound.
b.paused = true;
intersect([{ target: a, isIntersecting: true, intersectionRatio: 0.2 }, { target: b, isIntersecting: true, intersectionRatio: 1 }]); flush();
assert.equal(b.paused, false, "the next full-screen video plays");
assert.equal(b.muted, false, "the next full-screen video inherits sound on");
assert.equal([a, b].filter(video => !video.paused).length, 1, "one Roll video plays at a time");

// Muting in full screen carries back to the strip.
b.muted = true; flush();
assert.equal(sound.choice(), false, "the member's mute in full screen changes the shared choice");
coordinator.endSession(roll); flush();
view(1, 0);
assert.equal(a.paused, false, "the strip plays again after full screen");
assert.equal(a.muted, true, "muting in full screen carries back to the strip");

// Data saver (or any session opened without sound) narrows the choice but does not change it.
a.muted = false; flush();
assert.equal(coordinator.startSession(roll, a, { sound: false }), true);
flush();
assert.equal(a.muted, true, "a session opened without sound stays silent");
assert.equal(sound.choice(), true, "a silent session does not erase the member's choice");
coordinator.endSession(roll); flush();

// A video that is new to the page still starts muted.
const c = media("c");
mutate([{ removedNodes: [], addedNodes: [c] }]);
assert.equal(c.muted, true, "new videos start muted");

// Owner 2026-11-20 (phone): "sound still goes off on the Roll videos after a couple of videos". A quick swipe cuts the next
// video's play() short (AbortError); that must not turn the member's sound off. Only the browser refusing sound without
// a tap (NotAllowedError) does.
(async () => {
  const settle = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); flush(); };
  assert.equal(coordinator.startSession(roll, a, { sound: true }), true); flush();
  view(1, 0); await settle();
  assert.equal(sound.choice(), true);
  assert.equal(a.muted, false, "the full-screen video has the member's sound");
  b.paused = true; b.failNext = "AbortError";
  intersect([{ target: a, isIntersecting: true, intersectionRatio: 0.2 }, { target: b, isIntersecting: true, intersectionRatio: 1 }]); flush();
  await settle(); runTimers(); await settle();
  assert.equal(sound.choice(), true, "an interrupted play() keeps the member's sound on");
  assert.equal(b.paused, false, "the interrupted video plays again");
  assert.equal(b.muted, false, "and keeps its sound");
  a.paused = true; a.failNext = "NotAllowedError";
  intersect([{ target: a, isIntersecting: true, intersectionRatio: 1 }, { target: b, isIntersecting: true, intersectionRatio: 0.2 }]); flush();
  await settle(); runTimers(); await settle();
  assert.equal(sound.choice(), false, "the browser refusing sound turns it off, so the member is asked to tap");
  assert.equal(a.muted, true, "and the video plays muted");
  assert.equal(a.paused, false);
  coordinator.endSession(roll); flush();
  console.log("Roll sound session checks passed: one shared choice carries into and out of full screen, a move never re-mutes, fresh visits and silent sessions stay muted, and an interrupted play keeps the sound.");
})().catch(error => { console.error(error); process.exitCode = 1; });
