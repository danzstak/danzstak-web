"use strict";

const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

let intersect;
let mutations;
const events = {};
const seen = [];
const unseen = [];

function media(tag = "VIDEO", call = false, post = false) {
  return {
    tagName: tag, src: "https://example.com/video", isConnected: true, handlers: {}, dataset: {},
    style: { setProperty(name, value) { this[name] = value; } }, videoWidth: 1280, videoHeight: 720,
    pauses: 0, plays: 0, loads: 0, readyState: 0, paused: true, muted: true,
    getAttribute: () => "", matches: selector => selector === "video.post-media" ? post : true,
    closest: () => call ? {} : null,
    addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); },
    emit(name) { for (const handler of this.handlers[name] || []) handler({ target: this }); },
    pause() { this.pauses += 1; this.paused = true; },
    play() { this.plays += 1; this.paused = false; return Promise.resolve(); },
    load() { this.loads += 1; },
    replaceWith(next) { this.replacement = next; this.isConnected = false; }
  };
}

const video = media("VIDEO", false, true);
const chatVideo = media("VIDEO");
const call = media("VIDEO", true);
const frame = media("IFRAME");
const document = {
  body: { querySelectorAll: () => [video, chatVideo, call, frame] }, hidden: false,
  documentElement: { classList: { contains: () => false } },
  addEventListener: (name, handler) => { events[name] = handler; },
  querySelectorAll: selector => selector === "video" ? [video, chatVideo, call] : [],
  createElement: () => ({ handlers: {}, dataset: {}, setAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; }, replaceWith(next) { this.replacement = next; next.isConnected = true; } })
};
const context = {
  document, localStorage: { getItem: () => null }, requestAnimationFrame: handler => handler(),
  IntersectionObserver: class { constructor(handler) { intersect = handler; } observe(item) { seen.push(item); } unobserve(item) { unseen.push(item); } },
  MutationObserver: class { constructor(handler) { mutations = handler; } observe() {} },
  addEventListener() {}, dispatchEvent() {}
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("assets/media-visibility.js", "utf8"), context);

assert.equal(seen.includes(call), false, "live call media must never be paused by scrolling");
assert.equal(video.autoplay, false, "feed videos must never autoplay when DanzStak opens");
assert.equal(video.muted, true, "every video begins muted");
assert.equal(video.preload, "none", "off-screen videos must not compete for bandwidth");
assert.equal(chatVideo.preload, "none", "older chat videos stay dormant until scrolled into view");

intersect([{ target: chatVideo, isIntersecting: true, intersectionRatio: 0.8 }]);
assert.equal(chatVideo.preload, "metadata");
assert.equal(chatVideo.loads, 1, "a visible chat video loads only its metadata");
assert.equal(chatVideo.plays, 0, "chat videos never autoplay");

video.emit("loadedmetadata");
assert.equal(video.dataset.videoLayout, "landscape");
assert.equal(video.style["--video-aspect"], "16 / 9");
video.videoWidth = 720; video.videoHeight = 1280; video.emit("loadedmetadata");
assert.equal(video.dataset.videoLayout, "portrait");
assert.equal(video.style["--video-aspect"], "9 / 16");

intersect([{ target: video, isIntersecting: false, intersectionRatio: 0 }]);
assert.equal(video.pauses, 1);
intersect([{ target: video, isIntersecting: true, intersectionRatio: 0.8 }]);
assert.equal(video.preload, "auto");
assert.equal(video.loads, 1, "only a sufficiently visible feed video begins loading");
assert.equal(video.plays, 0, "visibility alone must not start playback");

video.paused = false; video.emit("pointerdown"); video.emit("play");
assert.equal(video.pauses, 1, "an explicit play at 60% visibility or greater is allowed");
intersect([{ target: video, isIntersecting: true, intersectionRatio: 0.59 }]);
assert.equal(video.pauses, 2, "a playing video pauses as soon as it falls below 60% visibility");

intersect([{ target: video, isIntersecting: true, intersectionRatio: 0.8 }]);
video.paused = true;
const playsBeforeClick = video.plays;
video.emit("pointerdown"); video.emit("click");
assert.equal(video.plays, playsBeforeClick + 1, "a visible stalled native-control click is completed programmatically");

document.hidden = true;
events.visibilitychange();
assert.ok(video.pauses >= 3, "backgrounding the app pauses feed media");
assert.equal(context.danzstakMediaSound.enabled(), false, "backgrounding clears audio focus");

assert.equal(frame.src, "about:blank");
assert.equal(frame.replacement.textContent, "Play video");
frame.replacement.handlers.click();
assert.equal(frame.src, "https://example.com/video");
video.isConnected = false;
mutations([{ removedNodes: [video], addedNodes: [] }]);
assert.equal(unseen.includes(video), true);

console.log("Media visibility checks passed: no startup autoplay, 60% eligibility, explicit playback, viewport pause, single focus, navigation/background pause, embeds, and cleanup.");
