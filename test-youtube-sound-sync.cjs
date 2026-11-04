const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

let messageHandler;
const stored = new Map();
const posted = [];
const playerWindow = { postMessage(message, origin) { posted.push({ message: JSON.parse(message), origin }); } };
const video = {
  tagName: "VIDEO", muted: true, autoplay: false, loop: false, preload: "", readyState: 0,
  dataset: {}, style: { setProperty() {} }, paused: true,
  matches: selector => selector === "video,iframe.reel-player" || selector === "video.post-media",
  closest: () => null, addEventListener() {}, pause() {}, play: () => Promise.resolve(), getAttribute: () => ""
};
const frame = {
  tagName: "IFRAME", src: "https://www.youtube-nocookie.com/embed/demo?autoplay=1&mute=1&enablejsapi=1",
  dataset: {}, contentWindow: playerWindow, isConnected: true,
  matches: selector => selector === "video,iframe.reel-player",
  closest: () => null, addEventListener(name, handler) { if (name === "load") this.onLoad = handler; }
};
const allMedia = [video, frame];
const document = {
  body: { querySelectorAll: () => allMedia }, hidden: false,
  documentElement: { classList: { contains: () => false } },
  querySelectorAll(selector) {
    if (selector === "video") return [video];
    if (selector.includes("youtube-nocookie.com")) return [frame];
    return [];
  },
  addEventListener() {}, createElement: () => ({ setAttribute() {}, addEventListener() {} })
};
const context = {
  document,
  localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  requestAnimationFrame: fn => fn(), CustomEvent: class {},
  IntersectionObserver: class { observe() {} unobserve() {} },
  MutationObserver: class { observe() {} },
  addEventListener(name, handler) { if (name === "message") messageHandler = handler; },
  dispatchEvent() {}
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("assets/media-visibility.js", "utf8"), context);

assert.ok(posted.some(item => item.message.event === "listening"), "DanzStak should subscribe to YouTube player updates");
assert.ok(posted.some(item => item.message.func === "mute"), "YouTube should begin muted for browser-safe autoplay");
messageHandler({
  origin: "https://www.youtube-nocookie.com", source: playerWindow,
  data: JSON.stringify({ event: "infoDelivery", info: { muted: false } })
});
assert.equal(stored.get("danzstak_video_sound"), "on", "unmuting YouTube should save sound on for the device");
assert.equal(video.muted, true, "unmuting YouTube must keep inactive native DanzStak videos muted");

messageHandler({
  origin: "https://malicious.example", source: playerWindow,
  data: JSON.stringify({ event: "infoDelivery", info: { muted: true } })
});
assert.equal(stored.get("danzstak_video_sound"), "on", "untrusted player messages must not change sound settings");
console.log("YouTube sound synchronization checks passed.");
