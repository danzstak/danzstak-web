// Directive F12 (owner 2026-11-19): "on all pictures I should be able to move them around to fit them in the box."
// Unit checks for the shared component (assets/image-position.js) and the server fields that keep a position.
// The sheet itself (drag, zoom, Save, the crop) is checked in a real browser: browser-checks/image-position.cjs.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const component = fs.readFileSync("assets/image-position.js", "utf8");
const storage = new Map();
const window = {};
const context = vm.createContext({
  window, location: { href: "https://danzstak.com/profile.html", origin: "https://danzstak.com" }, URL,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
  getComputedStyle: () => ({ backgroundImage: "" }), Image: class {}, ResizeObserver: class { observe() {} unobserve() {} }, Blob: class {}
});
vm.runInContext(component, context);
const fit = window.danzstakImagePosition;

assert.deepEqual({ ...fit.normalize({ x: -5, y: 140, zoom: 9 }) }, { x: 0, y: 100, zoom: 3 }, "positions are clamped (x/y 0-100, zoom 1-3)");
assert.deepEqual({ ...fit.normalize({ x: 0, y: 0, zoom: 0.5 }) }, { x: 0, y: 0, zoom: 1 }, "zero stays zero; never smaller than the box");
assert.deepEqual({ ...fit.normalize(null) }, { x: 50, y: 50, zoom: 1 }, "no position = centred");
assert.deepEqual({ ...fit.normalize({ x: "33.3333", y: "nope" }) }, { x: 33.33, y: 50, zoom: 1 });

// The same picture matches through the bucket and the CDN (signatures differ); phone-only files are never kept.
fit.remember("https://bucket.s3.amazonaws.com/users/abc/cover.jpg?X-Amz-Signature=1", { x: 10, y: 20, zoom: 2 });
assert.deepEqual({ ...fit.recall("https://dk7.cloudfront.net/users/abc/cover.jpg?Signature=2") }, { x: 10, y: 20, zoom: 2 });
fit.remember("blob:https://danzstak.com/123", { x: 1, y: 1 });
assert.equal(fit.recall("blob:https://danzstak.com/123"), null);
for (let i = 0; i < 60; i++) fit.remember(`https://cdn.example/users/abc/${i}.jpg`, { x: i });
assert.ok(Object.keys(JSON.parse(storage.get("danzstak_picture_positions"))).length <= 40, "the phone keeps a bounded list");

// An <img> is placed with object-position and zooms around the chosen point; a background without zoom stays "cover".
const image = { tagName: "IMG", style: {} };
fit.apply(image, { x: 20, y: 70, zoom: 1.5 });
assert.deepEqual({ ...image.style }, { objectFit: "cover", objectPosition: "20% 70%", transformOrigin: "20% 70%", transform: "scale(1.5)" });
fit.apply(image, { x: 20, y: 70, zoom: 1 });
assert.equal(image.style.transform, "", "no zoom, no transform");
const cover = { tagName: "DIV", style: {} };
fit.apply(cover, { x: 0, y: 100 });
assert.deepEqual({ ...cover.style }, { backgroundPosition: "0% 100%", backgroundRepeat: "no-repeat", backgroundSize: "cover" });

// The sheet: the picture follows the finger as far as it overflows; Save, Cancel, Escape; 44px controls; translated.
assert.match(component, /from\.x - \(dx \/ overflowX\) \* 100/, "a drag moves the picture with the finger");
assert.match(component, /setZoom\(pinch\.zoom \* \(Math\.hypot\(a\.x - b\.x, a\.y - b\.y\) \/ pinch\.distance\)\)/, "two fingers pinch to zoom");
assert.match(component, /sheet\.addEventListener\("cancel", event => \{ event\.preventDefault\(\); finish\(null\); \}\)/, "Escape / Back cancels");
assert.match(component, /const t = text => \(typeof window\.danzstakTranslate === "function"/, "every word goes through the translation layer");
const css = fs.readFileSync("assets/image-position.css", "utf8");
assert.match(css, /\.ds-fit-cancel,\.ds-fit-save\{min-width:44px;min-height:44px;/);
assert.match(css, /\.ds-fit-step\{display:grid;place-items:center;width:44px;height:44px;/);
assert.match(css, /\.ds-fit-save\{justify-self:end;background:var\(--fit-go\);color:#fff\}/, "Save is a green go button");
assert.match(css, /z-index:2147483000/, "the sheet sits above every floating control");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");
for (const word of ["Move to fit", "Drag to move. Pinch or slide to zoom.", "Zoom in", "Zoom out", "Tribe picture", "Saved on this phone. Everyone else sees it after DanzStak's next update."]) {
  assert.equal(people.split(JSON.stringify(word) + ":").length - 1, 3, `"${word}" is translated in it, fr and es`);
}

// Server: call-signaling keeps the cover and photo positions (a new picture without one starts centred) and lets a re-crop
// of the profile picture replace it instead of adding a past picture; the Auth API keeps the Tribe cover's.
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
assert.match(signaling, /coverZoom:Number\(item\?\.profileCoverZoom\?\.N\|\|1\),showcaseX:Number\(item\?\.profileShowcaseX\?\.N\|\|50\),showcaseY:Number\(item\?\.profileShowcaseY\?\.N\|\|50\),showcaseZoom:Number\(item\?\.profileShowcaseZoom\?\.N\|\|1\)/);
assert.match(signaling, /\['coverZoom','profileCoverZoom',1,3,1,'coverKey'\]/);
assert.match(signaling, /\['showcaseX','profileShowcaseX',0,100,50,'showcaseKey'\],\['showcaseY','profileShowcaseY',0,100,50,'showcaseKey'\],\['showcaseZoom','profileShowcaseZoom',1,3,1,'showcaseKey'\]/);
assert.match(signaling, /replaced=Object\.prototype\.hasOwnProperty\.call\(body,picture\)&&String\(body\[picture\]\|\|''\)!==\(current\.Item\?\.\[mediaFields\[picture\]\]\?\.S\|\|''\);if\(!given&&!replaced\)continue;const raw=given\?Number\(body\[field\]\):start/, "a new picture without a position starts centred");
assert.match(signaling, /stored==='profileAvatarKey'&&value&&body\.avatarRecrop!==true&&/, "a re-crop doesn't become a past picture");
const auth = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
assert.match(auth, /coverPosition: groupCoverPosition\(item\)/);
assert.match(auth, /UpdateExpression: "SET coverX = :x, coverY = :y, coverZoom = :zoom, updatedAt = :updated",\n\s+ConditionExpression: "attribute_exists\(userEmail\) AND attribute_not_exists\(deletionState\) AND coverKey = :cover"/, "moving the cover is tied to the cover it was placed on");
console.log("Image position checks passed: clamped positions, CDN/bucket match on this phone, img and background drawing, finger-following drag, pinch, Cancel, 44px green Save, translations, and the server fields for the profile and Tribe covers.");
