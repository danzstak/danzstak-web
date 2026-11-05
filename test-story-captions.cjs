const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("feed.html", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const start = source.indexOf("function storyDisplayCaption");
const end = source.indexOf("\nasync function refreshStoryMedia", start);
assert.ok(start >= 0 && end > start, "story caption formatter must exist");

const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);

assert.equal(context.storyDisplayCaption({ content: "1000029161.png", mediaType: "image" }), "Photo Daily");
assert.equal(context.storyDisplayCaption({ content: "clip-2026.mp4", mediaType: "video" }), "Video Daily");
assert.equal(context.storyDisplayCaption({ content: "Backstage in Tacoma", mediaType: "image" }), "Backstage in Tacoma");
assert.equal(context.storyDisplayCaption({ content: "", mediaType: "image" }), "Photo Daily");
assert.match(source, /item\.title = storyDisplayCaption\(story\)/);
assert.match(source, /story-viewer-caption"\)\.textContent = storyDisplayCaption\(story\)/);
assert.match(source, /feed-enhancements\.css\?v=498/, "the live feed should load the compact empty-Daily treatment");
assert.match(styles, /\.stories \.story-empty\{position:absolute!important;width:1px!important;height:1px!important/, "the empty-state announcement should remain accessible without rendering a second empty card");

console.log("Daily caption checks passed: uploaded filenames are hidden while user captions remain intact.");
