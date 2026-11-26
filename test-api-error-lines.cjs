"use strict";
// LANG part 4 (owner 2026-11-25: "These people really don't understand English not a word"). An API error line with no
// translation yet is shown to a member reading another language as a plain line in their language, chosen by the
// reply's status. This pins: every language DanzStak offers has all seven lines, none of them is English or empty,
// session-guard.js notes the lines it sees, and i18n.js uses them only for lines that came from the API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"); // Windows checkouts use CRLF
const i18n = read("assets/i18n.js");
const guard = read("assets/session-guard.js");
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

// Part 4b: the server's most-seen error lines have their own words in it/fr/es. Every key is a line the server really
// sends (so a reworded server line can't silently fall back), and no translation is empty or English.
const tableStart = i18n.indexOf("const serverErrorLines={"), tableEnd = i18n.indexOf("\n };", tableStart);
assert.ok(tableStart > 0 && tableEnd > tableStart, "i18n.js keeps the server error lines table");
const table = vm.runInNewContext(`(${i18n.slice(tableStart + "const serverErrorLines=".length, tableEnd + 3)})`);
const serverText = ["infrastructure/call-signaling/template.yaml", ...fs.readdirSync("infrastructure/auth-api").filter(file => file.endsWith(".mjs")).map(file => `infrastructure/auth-api/${file}`)]
  .map(file => read(file).replace(/\\'/g, "'")).join("\n");
assert.ok(Object.keys(table).length >= 140, "the most-seen lines are all there");
for (const [line, translated] of Object.entries(table)) {
  assert.ok(serverText.includes(`"${line}"`) || serverText.includes(`'${line}'`), `"${line}" is not a line the server sends`);
  assert.equal(translated.length, 3, `"${line}": it, fr, es`);
  for (const text of translated) {
    assert.ok(text.trim().length > 3 && text !== line, `"${line}": a translation is missing`);
    assert.ok(!english.test(text), `"${line}": "${text}" reads as English`);
  }
}
assert.match(i18n, /for\(const \[english,lines\] of Object\.entries\(serverErrorLines\)\)\['it','fr','es'\]\.forEach\(\(code,index\)=>\{const dictionary=dictionaries\[code\]\|\|\(dictionaries\[code\]=\{\}\);if\(!dictionary\[english\]\)dictionary\[english\]=lines\[index\];\}\);/, "an existing translation is never replaced");
console.log("API error lines: every language has its plain lines; the most-seen server lines have their own words in it/fr/es.");
