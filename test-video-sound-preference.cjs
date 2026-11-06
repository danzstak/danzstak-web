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
assert.match(media, /if\(element\.tagName==='VIDEO'\)shell\.classList\.add\('danzstak-native-video-shell'\)/, "native players must be distinguishable from provider embeds so custom audio does not cover browser controls");
assert.match(media, /const label=enabled\?'Mute video':'Unmute video'/, "the audio control exposes its actual state accessibly");
assert.match(css, /\.danzstak-audio-toggle\{[^}]*right:12px;bottom:12px[^}]*width:44px;height:44px[^}]*border-radius:50%/, "the audio control must be a bottom-right circular mobile touch target");
assert.match(css, /\.danzstak-native-video-shell>\.danzstak-audio-toggle\{bottom:54px\}/, "native-video audio controls must clear the browser's own control strip");
assert.match(icons, /"volume-2"/, "the icon system must provide an enabled-audio speaker");
assert.match(icons, /"volume-x"/, "the icon system must provide a muted speaker");
assert.match(media, /currentRatio>=0\.5/, "the current video must retain playback while it remains substantially in frame");
assert.match(media, /const minimum=sessionRoot\?0\.5:0\.6/, "ordinary feed handoff must require 60% visibility while The Roll uses its exact 50% boundary");
assert.match(media, /event\.origin!==['"]https:\/\/www\.youtube-nocookie\.com['"]/, "only trusted YouTube player messages may change sound state");
assert.match(media, /payload\?\.event!==['"]infoDelivery['"]/, "YouTube sound-control changes should update the shared choice");
assert.match(media, /saveSoundPreference\(!payload\.info\.muted,frame\)/, "unmuting a YouTube video should unmute later DanzStak videos");
assert.match(feed, /youtube-nocookie\.com\/embed\/[\s\S]*autoplay=0/, "YouTube embeds must not request autoplay");
assert.doesNotMatch(feed, /[?&]autoplay=(?:1|true)/, "no supported external provider may request startup autoplay");
assert.match(feed, /enablejsapi=1/, "YouTube embeds should expose playback controls to the visibility manager");
assert.match(feed, /enablejsapi=1&loop=0/, "YouTube embeds should end naturally so The Roll can advance");
assert.match(media, /mutedAutoplayEnabled\(\)/, "muted viewport autoplay must be opt-in and disabled by default");
assert.match(media, /inView=ratio>=thresholdFor\(entry\.target\)/, "visibility eligibility must use the shared feed or Roll threshold");
assert.match(media, /globalThis\.danzstakMediaCoordinator=\{pauseAll,autoplayEnabled:mutedAutoplayEnabled,startSession,endSession,reconcile:reconcilePlayback\}/, "all navigation surfaces and The Roll must share one playback coordinator");
assert.match(media, /frame===audibleMedia\?'unMute':'mute'/, "loading an inactive YouTube player must not make it audible");
assert.match(media, /controlYouTube\(element,'pauseVideo'\)/, "off-screen YouTube embeds should pause without being replaced");

console.log("Video sound checks passed: visible controls, explicit audio focus, muted autoplay, visibility hysteresis, and YouTube synchronization.");
