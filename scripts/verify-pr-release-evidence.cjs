"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const eventPath = process.env.GITHUB_EVENT_PATH;
assert.ok(eventPath && fs.existsSync(eventPath), "GITHUB_EVENT_PATH must name the pull-request event payload");
const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pull = event.pull_request;
assert.ok(pull, "This release-evidence gate only runs for pull requests");

const body = String(pull.body || "");
const sections = new Map();
const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gmi)];
for (const [index, match] of headings.entries()) {
  const start = match.index + match[0].length;
  const end = headings[index + 1]?.index ?? body.length;
  const value = body.slice(start, end).replace(/<!--[\s\S]*?-->/g, "").trim();
  sections.set(match[1].trim().toLowerCase(), value);
}
const required = [
  ["Source SHA", value => new RegExp(`^${pull.head.sha}$`, "i").test(value)],
  ["Preview / staging", value => /^https:\/\/\S+$/im.test(value) && !/danzstak\.com\/?$/i.test(value)],
  ["Functional tests", value => value.length >= 20 && /(pass|fail|run|test)/i.test(value)],
  ["Responsive / accessibility evidence", value => [320, 360, 390, 430].every(width => new RegExp(`${width}\\s*px`, "i").test(value))],
  ["Security / privacy review", value => value.length >= 20],
  ["UX review", value => /Facebook-familiar/i.test(value) && /DANZSTAK/i.test(value)],
  ["Deployment state", value => /^(not deployed|staging only)/i.test(value)],
  ["Rollback", value => value.length >= 20]
];

const missing = required.filter(([label, valid]) => !valid(sections.get(label.toLowerCase()) || "")).map(([label]) => label);
assert.deepEqual(missing, [], `PR release evidence is missing or incomplete: ${missing.join(", ")}`);
assert.equal(pull.draft, false, "Draft pull requests are not eligible for release review");

console.log(`PR release evidence gate passed for ${pull.head.sha}. Human approval and protected-environment approval remain separate required controls.`);
