const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/profile.js", "utf8");
const start = source.indexOf("function loadProfileImage(");
const end = source.indexOf("async function loadProfile()", start);
assert.ok(start >= 0 && end > start, "profile image preloader must exist");

const images = [];
class Image {
  constructor() { images.push(this); }
  set src(value) { this._src = value; }
  get src() { return this._src; }
}
const context = vm.createContext({ Image });
vm.runInContext(source.slice(start, end), context);

function target() {
  const classes = new Set(["has-photo"]);
  return {
    dataset: {}, style: { backgroundImage: "old" },
    classList: { add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); } }
  };
}

const avatar = target();
let ready = false;
vm.runInContext("loadProfileImage", context)(avatar, "https://example.test/avatar.jpg", () => { ready = true; });
assert.equal(avatar.classList.contains("has-photo"), false, "old photo styling clears while the new image loads");
assert.equal(avatar.style.backgroundImage, "old", "the visible placeholder is not blanked before the image is ready");
images[0].onload();
assert.equal(ready, true);
assert.equal(avatar.classList.contains("has-photo"), true);
assert.match(avatar.style.backgroundImage, /avatar\.jpg/);

const stale = target();
vm.runInContext("loadProfileImage", context)(stale, "https://example.test/first.jpg");
vm.runInContext("loadProfileImage", context)(stale, "https://example.test/second.jpg");
images[1].onload();
assert.doesNotMatch(stale.style.backgroundImage, /first\.jpg/, "a late image cannot overwrite the current profile photo");
images[2].onload();
assert.match(stale.style.backgroundImage, /second\.jpg/);

const failed = target();
vm.runInContext("loadProfileImage", context)(failed, "https://example.test/broken.jpg");
images[3].onerror();
assert.equal(failed.style.backgroundImage, "");
assert.equal(failed.classList.contains("has-photo"), false);

console.log("Profile image loading checks passed: placeholders stay visible, stale loads are ignored, and failures recover cleanly.");
