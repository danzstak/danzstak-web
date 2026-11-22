// The site speaks the phone's FIRST language, not the first non-English one (owner 2026-11-21: "why is my profile
// in Italian" on a phone set to English with Italian second). A saved choice still wins.
const fs = require("fs");
const assert = require("assert");
const src = fs.readFileSync(__dirname + "/assets/i18n.js", "utf8");
assert.ok(!/find\(code=>code!=='en'\)/.test(src), "i18n.js must not skip English to pick a later phone language");
assert.ok(/navigator\.languages&&navigator\.languages\[0\]/.test(src), "i18n.js uses the phone's first language");
assert.ok(/language=saved\|\|regional\|\|language/.test(src), "a saved language still wins over the phone's");
console.log("language first choice ok");
