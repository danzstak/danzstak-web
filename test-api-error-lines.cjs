"use strict";
// LANG part 4 (owner 2026-11-25: "These people really don't understand English not a word"). An API error line with no
// translation yet is shown to a member reading another language as a plain line in their language, chosen by the
// reply's status. This pins: every language DanzStak offers has all seven lines, none of them is English or empty,
// session-guard.js notes the lines it sees, and i18n.js uses them only for lines that came from the API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const guard = fs.readFileSync("assets/session-guard.js", "utf8");
const languages = JSON.parse(fs.readFileSync("assets/languages.js", "utf8").match(/window\.danzstakLanguages=(\[.*?\]\]);/)[1]).map(([code]) => code);

const start = i18n.indexOf("const apiErrorLines={"), end = i18n.indexOf("\n };", start);
assert.ok(start > 0 && end > start, "i18n.js keeps the table of plain API error lines");
const lines = vm.runInNewContext(`(${i18n.slice(start + "const apiErrorLines=".length, end + 3)})`);
const english = /\b(the|your|try|again|something|wrong|sign|too many|purchase|here)\b/i;
for (const code of languages.filter(code => code !== "en")) {
  assert.ok(Array.isArray(lines[code]), `${code}: plain API error lines are missing`);
  assert.equal(lines[code].length, 7, `${code}: wrong input, not allowed, gone, too many tries, purchase, our side, sign in`);
  for (const line of lines[code]) {
    assert.ok(typeof line === "string" && line.trim().length > 3, `${code}: an empty line`);
    if (code !== "fil") assert.ok(!english.test(line), `${code}: "${line}" reads as English`);
  }
  assert.equal(new Set(lines[code]).size, 7, `${code}: two statuses share a line`);
}

// Each status lands on its own line.
const pick = vm.runInNewContext(`${i18n.match(/function apiErrorLine\(language,status\)\{[^\n]+\}/)[0]};const apiErrorLines=${JSON.stringify({ it: lines.it })};apiErrorLine`);
assert.equal(pick("it", 400), lines.it[0]);
assert.equal(pick("it", 409), lines.it[0]);
assert.equal(pick("it", 403), lines.it[1]);
assert.equal(pick("it", 404), lines.it[2]);
assert.equal(pick("it", 429), lines.it[3]);
assert.equal(pick("it", 402), lines.it[4]);
assert.equal(pick("it", 500), lines.it[5]);
assert.equal(pick("it", 503), lines.it[5]);
assert.equal(pick("it", 401), lines.it[6]);
assert.equal(pick("en", 500), "", "English keeps the server's own words");

// Only lines that came from the API, only for other languages, and only when there's no translation (checked last).
assert.match(i18n, /if\(!result&&language!=='en'\)\{const status=window\.danzstakApiErrors\?\.get\?\.\(trimmed\);if\(status\)result=apiErrorLine\(language,status\);\}\n  if\(!result\)return source;/);
assert.match(guard, /window\.danzstakApiErrors \|\| \(window\.danzstakApiErrors = new Map\(\)\)/);
assert.match(guard, /const response = await guarded\(input, init\);\n    return apiPath\(input\) === null \? response : note\(response\);/, "only DanzStak's own API replies are noted");
assert.match(guard, /response\.status < 400/, "successful replies are never noted");
assert.match(guard, /response\.clone\(\)\.json\(\)/, "the page still reads the reply itself");
console.log("API error lines: every language has its plain lines; only untranslated API errors use them.");
