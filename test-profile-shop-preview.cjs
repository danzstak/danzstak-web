"use strict";
// Owner 2026-11-18 (Eroticon profile screenshot): "The big white space should be the user's shop with a preview."
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), css = fs.readFileSync("assets/profile-shop.css", "utf8");
const body = editor.match(/function renderProfileShopPreview[\s\S]*?\r?\n}\r?\n/)[0];
assert.match(editor, /renderProfileShopPreview\(profileShop, profile, moreTab\);/, "shown as soon as the member's shop loads");
assert.match(body, /\(shop\?\.products \|\| \[\]\)\.filter\(item => item\.available && item\.imageUrl\)\.slice\(0, 3\)/, "up to 3 items for sale, with photos");
assert.match(body, /preview\.type = "button"/);
assert.match(body, /tab\?\.click\(\);/, "tapping opens the Shop tab");
assert.match(body, /placeProfileBand\(preview\);/, "F4: the shop preview is the picture band under the name row");
assert.match(editor, /function placeProfileBand\(band\) \{[\s\S]*?row\.insertAdjacentElement\("beforebegin", band\)/, "F4: the band sits just above the action row");
assert.match(body, /title\.setAttribute\("data-no-translate", ""\)/);
assert.match(css, /\.profile-shop-preview\{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%;min-height:44px/, "F4: a full-width band, not a box beside the avatar");
assert.match(css, /\.profile-shop-preview-items\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, "F4: three items across the band");
console.log("profile shop preview ok");
{
  // No shop items: the member fills the space with a photo they pick ("a picture of their dog or something").
  const showcase = editor.match(/function renderProfileShowcase[\s\S]*?\r?\n}\r?\n/)[0];
  assert.match(body, /if \(!items\.length\) return renderProfileShowcase\(shop, profile\);/);
  assert.match(showcase, /if \(!avatar \|\| \(!photo && !owner\)\) return null;/, "visitors see the photo or nothing");
  assert.match(showcase, /const owner = profile\.isOwner === true && !viewingOtherProfile;/);
  assert.match(showcase, /Add a photo: your dog, your rig, anything/);
  assert.match(showcase, /or open your shop/);
  assert.match(showcase, /\/\^image\\\/\(jpeg\|png\|webp\|gif\)\$\/\.test\(file\.type\) \|\| file\.size > 15 \* 1024 \* 1024/);
  assert.match(showcase, /const mediaKey = await uploadCloudMedia\(file\); await save\(\{ showcaseKey: mediaKey \}\);/);
  assert.match(showcase, /save\(\{ showcaseKey: "" \}\)/, "the owner can remove it");
  assert.match(editor, /if \(!data\.shop\) \{ renderProfileShowcase\(null, profile\); return; \}/);
  // Server keeps the photo like the avatar and cover, and never cleans it up while it's in use.
  const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8"), auth = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(template, /mediaFields=\{avatarKey:'profileAvatarKey',coverKey:'profileCoverKey',showcaseKey:'profileShowcaseKey'\}/);
  assert.match(template, /showcase:profileMediaUrl\(item,'profileShowcaseKey'\)/);
  assert.match(template, /\['profileShowcaseKey','expectedShowcase'\]/);
  assert.match(template, /AND \(attribute_not_exists\(profileShowcaseKey\) OR profileShowcaseKey <> :candidate\)'/);
  assert.match(auth, /AND \(attribute_not_exists\(profileShowcaseKey\) OR profileShowcaseKey <> :candidate\)"/);
  assert.match(auth, /"profileShowcaseKey = :candidate"\]\.join\(" OR "\)/);
  assert.match(auth, /\["profileShowcaseKey", "showcase"\]/);
}
console.log("profile showcase checks ok");
{
  // Owner 2026-11-19: own profile had a shop button, a member's profile seen by a visitor didn't. Same icon for visitors.
  assert.match(editor, /if \(profile\.isOwner !== true && viewingOtherProfile\) \{[\s\S]{0,400}shopManagementLink\.href = "#shop";[\s\S]{0,200}shopManagementLink\.hidden = false;/);
  assert.match(editor, /event\.preventDefault\(\); \(moreTab \|\| tabs\.querySelector\('\[data-profile-tab="More"\]'\)\)\?\.click\(\);/, "it opens that member's Shop tab");
  assert.match(editor, /if \(row && moreWrap\) row\.insertBefore\(shopManagementLink, moreWrap\);/, "before ⋯, after Message");
  console.log("visitor shop button checks ok");
}
