"use strict";
// Owner 2026-11-17: "With sound on the next video should start with sound on" and
// "with sound off the next video starts with sound off". Feed autoplay on.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let intersect;
const documentEvents = {};
const queued = [];
function feedVideo(name) {
  const handlers = new Map();
  let muted = true;
  const video = {
    name, tagName: "VIDEO", dataset: {}, style: { setProperty() {} }, videoWidth: 1280, videoHeight: 720,
    readyState: 1, paused: true, plays: 0,
    get muted() { return muted; },
    // Real browsers fire volumechange asynchronously, after the coordinator's guard is released.
    set muted(value) { if (value !== muted) { muted = value; queued.push(video); } },
    matches(selector) { return String(selector).split(",").map(s => s.trim()).some(s => ["video", "iframe.reel-player", "video.post-media"].includes(s)); },
    closest() { return null; }, getAttribute() { return ""; },
    addEventListener(type, handler) { const list = handlers.get(type) || []; list.push(handler); handlers.set(type, list); },
    emit(type) { for (const handler of handlers.get(type) || []) handler({ target: this }); },
    play() { this.plays += 1; this.paused = false; this.emit("play"); return Promise.resolve(); },
    pause() { this.paused = true; }, load() {}
  };
  return video;
}
const flush = () => { while (queued.length) documentEvents.volumechange({ target: queued.shift() }); };
const [a, b, c] = [feedVideo("a"), feedVideo("b"), feedVideo("c")];
const videos = [a, b, c];
const document = {
  body: { querySelectorAll: () => videos }, hidden: false,
  documentElement: { classList: { contains: () => false } },
  querySelectorAll(selector) { return selector === "video" ? videos : []; },
  addEventListener(type, handler) { documentEvents[type] = handler; },
  createElement() { return { setAttribute() {}, addEventListener() {} }; }
};
const context = {
  document, localStorage: { getItem: () => null, setItem() { throw new Error("sound choice must stay in memory"); } },
  requestAnimationFrame: handler => handler(), cancelAnimationFrame() {}, CustomEvent: class {},
  IntersectionObserver: class { constructor(handler) { intersect = handler; } observe() {} unobserve() {} },
  MutationObserver: class { observe() {} }, addEventListener() {}, dispatchEvent() {}
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("assets/media-visibility.js", "utf8"), context);
flush();
const view = (ra, rb, rc) => { intersect([
  { target: a, isIntersecting: ra > 0, intersectionRatio: ra },
  { target: b, isIntersecting: rb > 0, intersectionRatio: rb },
  { target: c, isIntersecting: rc > 0, intersectionRatio: rc }]); flush(); };

view(1, 0, 0);
assert.equal(a.paused, false, "the first visible video autoplays");
assert.equal(a.muted, true, "a fresh visit starts muted");

a.muted = false; flush();
assert.equal(a.muted, false, "the member turns sound on");

view(0.3, 1, 0);
assert.equal(a.paused, true, "the previous video stops when it leaves the frame");
assert.equal(a.muted, true, "the previous video is silent");
assert.equal(b.paused, false, "the next video autoplays");
assert.equal(b.muted, false, "with sound on, the next video starts with sound on");

b.muted = true; flush();
view(0, 0.3, 1);
assert.equal(c.paused, false, "the following video autoplays");
assert.equal(c.muted, true, "with sound off, the next video starts with sound off");
assert.equal(b.muted, true);

c.muted = false; flush();
view(1, 0, 0.2);
assert.equal(a.muted, false, "scrolling back up keeps the sound-on choice");
assert.equal([a, b, c].filter(v => !v.muted).length, 1, "only one video ever has sound");
assert.equal([a, b, c].filter(v => !v.paused).length, 1, "only one video ever plays");

console.log("Video sound carry-over checks passed: sound on stays on and sound off stays off for the next video, one audible player, memory only.");
