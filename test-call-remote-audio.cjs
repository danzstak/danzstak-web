"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("messages.html", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const extract = name => chat.match(new RegExp(`(?:async )?function ${name}\\([^\\n]+`))[0];

const audioIndex = html.indexOf('id="remoteAudio"');
const gridIndex = html.indexOf('id="videoGrid"');
assert.ok(audioIndex > 0 && audioIndex < gridIndex, "phone audio must live outside the video-only grid");
assert.match(html, /id="resumeRemoteAudio"[^>]*hidden[^>]*>Hear call</, "autoplay recovery must be an explicit user action");
assert.match(chat, /return mode==="video"\?els\.remoteVideo:els\.remoteAudio/, "phone and video calls must use separate output elements");
assert.match(chat, /activePeer\.addEventListener\("track".*attachRemoteStream/, "remote tracks must enter the shared output coordinator");
assert.match(chat, /els\.remoteVideo\.pause\(\);els\.remoteAudio\.pause\(\)/, "switching and teardown must stop both outputs");
assert.match(chat, /els\.remoteVideo\.srcObject=els\.remoteAudio\.srcObject=null/, "teardown must detach every remote stream");
assert.doesNotMatch(chat, /remoteVideo\.srcObject=e\.streams\[0\]/, "audio-only calls must not be routed into a hidden video");

const status = { value: "" };
const state = vm.createContext({
  mode: "phone",
  t: value => value,
  setStatus(value) { status.value = value; },
  els: {
    remoteAudio: { srcObject: {}, play: async () => { throw new Error("autoplay blocked"); } },
    remoteVideo: { srcObject: null, play: async () => {} },
    resumeAudio: { hidden: true }
  }
});
vm.runInContext([extract("remoteMediaElement"), extract("playRemoteMedia")].join("\n"), state);

(async () => {
  await state.playRemoteMedia();
  assert.equal(state.els.resumeAudio.hidden, false, "blocked playback must expose Hear call");
  assert.match(status.value, /Tap Hear call/, "blocked playback must explain the recovery action");
  state.els.remoteAudio.play = async () => {};
  await state.playRemoteMedia();
  assert.equal(state.els.resumeAudio.hidden, true, "successful user playback must hide recovery");
  state.mode = "video";
  assert.equal(state.remoteMediaElement(), state.els.remoteVideo, "video calls must retain their visible video output");
  console.log("Remote call-audio checks passed: dedicated phone output, autoplay recovery, video routing, and cleanup.");
})().catch(error => { console.error(error); process.exitCode = 1; });
