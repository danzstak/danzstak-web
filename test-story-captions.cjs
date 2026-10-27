const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("feed.html", "utf8");
const start = source.indexOf("function storyDisplayCaption");
const end = source.indexOf("\nfunction openStoryViewer", start);
assert.ok(start >= 0 && end > start, "story caption formatter must exist");

const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);

assert.equal(context.storyDisplayCaption({ content: "1000029161.png", mediaType: "image" }), "Photo Story");
assert.equal(context.storyDisplayCaption({ content: "clip-2026.mp4", mediaType: "video" }), "Video Story");
assert.equal(context.storyDisplayCaption({ content: "Backstage in Tacoma", mediaType: "image" }), "Backstage in Tacoma");
assert.equal(context.storyDisplayCaption({ content: "", mediaType: "image" }), "Photo Story");
assert.match(source, /item\.title = storyDisplayCaption\(story\)/);
assert.match(source, /story-viewer-caption"\)\.textContent = storyDisplayCaption\(story\)/);

console.log("Story caption checks passed: uploaded filenames are hidden while user captions remain intact.");
