const fs = require("node:fs");
const assert = require("node:assert/strict");

const media = fs.readFileSync("assets/media-visibility.js", "utf8");
const people = fs.readFileSync("assets/people-search.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/responsive-media.css", "utf8");
const icons = fs.readFileSync("assets/icon-buttons.js", "utf8");

assert.match(people, /placeholder = "Example: Sigmund"/, "friend search should show Sigmund as the example");
assert.doesNotMatch(media, /localStorage\.setItem\([^)]*danzstak_video_sound/, "audio must not silently persist across videos or visits");
assert.match(media, /document\.addEventListener\('volumechange'/, "native video sound changes should update the shared choice");
assert.match(media, /document\.querySelectorAll\?\.\('video'\)/, "the shared choice should update every native video");
assert.match(media, /youtube-nocookie\.com\/embed\//, "YouTube players should participate in shared sound state");
assert.match(media, /controlYouTube\(frame,frame===audibleMedia\?'unMute':'mute'\)/, "only the explicitly audible YouTube player should receive sound without reloading");
assert.match(media, /video\.muted=video!==audibleMedia/, "every native video except the explicitly audible player must remain muted");
assert.match(media, /className='danzstak-audio-toggle'/, "supported players receive a shared visible audio control");
assert.match(media, /const label=enabled\?'Mute video':'Unmute video'/, "the audio control exposes its actual state accessibly");
assert.match(css, /\.danzstak-audio-toggle\{[^}]*right:12px;bottom:12px[^}]*width:44px;height:44px[^}]*border-radius:50%/, "the audio control must be a bottom-right circular mobile touch target");
assert.match(icons, /"volume-2"/, "the icon system must provide an enabled-audio speaker");
assert.match(icons, /"volume-x"/, "the icon system must provide a muted speaker");
assert.match(media, /currentRatio>=0\.5/, "the current video must retain playback while it remains substantially in frame");
assert.match(media, /let best=null,bestRatio=0\.6/, "automatic handoff must require the next video to be substantially visible");
assert.match(media, /event\.origin!==['"]https:\/\/www\.youtube-nocookie\.com['"]/, "only trusted YouTube player messages may change sound state");
assert.match(media, /payload\?\.event!==['"]infoDelivery['"]/, "YouTube sound-control changes should update the shared choice");
assert.match(media, /saveSoundPreference\(!payload\.info\.muted,frame\)/, "unmuting a YouTube video should unmute later DanzStak videos");
assert.match(feed, /youtube-nocookie\.com\/embed\/[\s\S]*autoplay=1/, "YouTube embeds should request autoplay");
assert.match(feed, /enablejsapi=1/, "YouTube embeds should expose playback controls to the visibility manager");
assert.match(feed, /loop=1&playlist=/, "YouTube embeds should continue playing in The Roll");
assert.match(media, /controlYouTube\(candidate,'playVideo'\)/, "the selected visible YouTube embed should start automatically");
assert.match(media, /frame===audibleMedia\?'unMute':'mute'/, "loading an inactive YouTube player must not make it audible");
assert.match(media, /controlYouTube\(element,'pauseVideo'\)/, "off-screen YouTube embeds should pause without being replaced");

console.log("Video sound checks passed: visible controls, explicit audio focus, muted autoplay, visibility hysteresis, and YouTube synchronization.");
