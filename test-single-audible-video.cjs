"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let intersect;
let mutate;
const documentEvents = {};

function feedVideo(name) {
  const handlers = new Map();
  return {
    name,
    tagName: "VIDEO",
    dataset: {},
    style: { setProperty() {} },
    videoWidth: 1280,
    videoHeight: 720,
    readyState: 1,
    paused: true,
    muted: true,
    plays: 0,
    pauses: 0,
    matches(selector) { return selector === "video,iframe.reel-player" || selector === "video.post-media"; },
    closest() { return null; },
    getAttribute() { return ""; },
    addEventListener(type, handler) {
      const list = handlers.get(type) || [];
      list.push(handler);
      handlers.set(type, list);
    },
    emit(type) { for (const handler of handlers.get(type) || []) handler({ target: this }); },
    play() {
      this.plays += 1;
      this.paused = false;
      this.emit("play");
      return Promise.resolve();
    },
    pause() { this.pauses += 1; this.paused = true; },
    load() {}
  };
}

const first = feedVideo("first");
const second = feedVideo("second");
const videos = [first, second];
const document = {
  body: { querySelectorAll: () => videos },
  hidden: false,
  documentElement: { classList: { contains: () => false } },
  querySelectorAll(selector) {
    if (selector === "video") return videos;
    return [];
  },
  addEventListener(type, handler) { documentEvents[type] = handler; },
  createElement() { return { setAttribute() {}, addEventListener() {} }; }
};

const context = {
  document,
  localStorage: { getItem: key => key === "danzstak_video_sound" ? "on" : null, setItem() {} },
  requestAnimationFrame: handler => handler(),
  CustomEvent: class {},
  IntersectionObserver: class {
    constructor(handler) { intersect = handler; }
    observe() {}
    unobserve() {}
  },
  MutationObserver: class { constructor(handler) { mutate = handler; } observe() {} },
  addEventListener() {},
  dispatchEvent() {}
};
context.globalThis = context;

vm.runInNewContext(fs.readFileSync("assets/media-visibility.js", "utf8"), context);

assert.equal(first.muted, true, "videos begin muted until the coordinator selects an active source");
assert.equal(second.muted, true, "inactive videos begin muted even when sound preference is on");

const inserted = feedVideo("inserted");
inserted.querySelectorAll = () => [];
mutate([{ removedNodes: [], addedNodes: [inserted] }]);
assert.equal(inserted.muted, true, "a newly inserted video must remain silent before any autoplay observer can start it");

intersect([
  { target: first, isIntersecting: true, intersectionRatio: 0.8 },
  { target: second, isIntersecting: true, intersectionRatio: 0.2 }
]);
assert.equal(first.plays, 1, "the substantially visible first video starts");
assert.equal(first.muted, true, "automatic playback remains muted until the user explicitly enables audio");
assert.equal(second.plays, 0, "the barely visible next video does not start");
assert.equal(second.muted, true, "the next video remains inaudible");

first.muted = false;
documentEvents.volumechange({ target: first });
assert.equal(first.muted, false, "explicit user unmute grants audio to the active video");

intersect([
  { target: first, isIntersecting: true, intersectionRatio: 0.7 },
  { target: second, isIntersecting: true, intersectionRatio: 0.8 }
]);
assert.equal(second.plays, 0, "the next video cannot steal playback while the current video remains at least half visible");
assert.equal(first.muted, false, "the current in-frame video keeps audio during overlap");

intersect([
  { target: first, isIntersecting: true, intersectionRatio: 0.4 },
  { target: second, isIntersecting: true, intersectionRatio: 0.8 }
]);
assert.equal(second.plays, 1, "playback transfers once the previous video leaves the active frame");
assert.equal(first.paused, true, "the previous video is paused before the next video plays");
assert.equal(first.muted, true, "the previous video is muted after handoff");
assert.equal(second.muted, true, "automatic handoff never restarts audio without user interaction");

first.emit("pointerdown");
first.play();
assert.equal(second.paused, true, "a direct user play pauses the previous active video");
assert.equal(first.muted, true, "manual playback transfers playback ownership but remains muted until explicitly unmuted");
assert.equal(second.muted, true, "manual playback leaves every other video muted");

first.muted = false;
documentEvents.volumechange({ target: first });
assert.equal(first.muted, false, "the selected video can be explicitly unmuted again");

document.hidden = true;
documentEvents.visibilitychange();
assert.equal(first.paused, true, "backgrounding the app pauses the active video");
assert.equal(second.paused, true, "backgrounding the app leaves no other video playing");

console.log("Single-audible-video checks passed: overlap hysteresis, scroll handoff, manual transfer, and background pause prevent competing audio.");
