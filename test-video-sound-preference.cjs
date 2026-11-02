const fs = require("node:fs");
const assert = require("node:assert/strict");

const media = fs.readFileSync("assets/media-visibility.js", "utf8");
const people = fs.readFileSync("assets/people-search.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(people, /placeholder = "Example: Sigmund"/, "friend search should show Sigmund as the example");
assert.match(media, /soundPreferenceKey='danzstak_video_sound'/, "video sound choice should persist on the device");
assert.match(media, /document\.addEventListener\('volumechange'/, "native video sound changes should update the shared choice");
assert.match(media, /document\.querySelectorAll\?\.\('video'\)/, "the shared choice should update every native video");
assert.match(media, /youtube-nocookie\.com\/embed\//, "YouTube players should participate in shared sound state");
assert.match(media, /url\.searchParams\.set\('mute',next\)/, "YouTube mute state should follow the shared choice");
assert.match(feed, /youtube-nocookie\.com\/embed\/[\s\S]*autoplay=1/, "YouTube embeds should request autoplay");

console.log("Video sound checks passed: Sigmund search hint, persistent site-wide sound, and YouTube autoplay synchronization.");
