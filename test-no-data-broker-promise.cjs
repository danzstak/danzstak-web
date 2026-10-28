const fs = require("fs");
const assert = require("assert");

const privacy = fs.readFileSync("privacy.html", "utf8");
const landing = fs.readFileSync("index.html", "utf8");

assert.match(privacy, /DanzStak is not a data broker/i);
assert.match(privacy, /do not sell or rent personal information/i);
assert.match(privacy, /do not use advertising cookies or build profiles for targeted advertising/i);
assert.doesNotMatch(privacy, /Business transfers:/i, "privacy promise must not reserve a broad data-sale escape hatch");
assert.match(landing, /Your data is not the product/i);
assert.match(landing, /do not sell or rent personal information/i);

console.log("No-data-broker promise is explicit on the landing page and in the privacy policy.");
