"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const sectionMap = body => {
  const sections = new Map();
  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gmi)];
  for (const [index, match] of headings.entries()) {
    const start = match.index + match[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    sections.set(match[1].trim().toLowerCase(), body.slice(start, end).replace(/<!--[\s\S]*?-->/g, "").trim());
  }
  return sections;
};

const main = async () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  assert.ok(eventPath && fs.existsSync(eventPath), "GITHUB_EVENT_PATH must name the pull-request event payload");
  const pull = JSON.parse(fs.readFileSync(eventPath, "utf8")).pull_request;
  assert.ok(pull, "This release-evidence gate only runs for pull requests");
  assert.equal(pull.draft, false, "Draft pull requests are not eligible for release review");

  const body = String(pull.body || "");
  const sections = sectionMap(body);
  const head = String(pull.head?.sha || "");
  const branch = String(pull.head?.ref || "");
  const previewText = sections.get("preview / staging") || "";
  const previewMatch = previewText.match(/https:\/\/[^\s)]+/i);
  const expectedHost = `${branch.replaceAll("/", "-")}.d31oovi2mos5iz.amplifyapp.com`.toLowerCase();
  const preview = previewMatch ? new URL(previewMatch[0]) : null;

  const required = [
    ["Source SHA", value => new RegExp(`^${head}$`, "i").test(value)],
    ["Preview / staging", value => preview && preview.protocol === "https:" && preview.hostname.toLowerCase() === expectedHost && /AWS Amplify/i.test(value) && /job\s+\d+/i.test(value) && value.includes(branch)],
    ["Functional tests", value => value.length >= 40 && /(pass|fail|run|test)/i.test(value)],
    ["Responsive / accessibility evidence", value => [320, 390, 430, 1366].every(width => new RegExp(`${width}\\s*px`, "i").test(value)) && /keyboard|focus/i.test(value)],
    ["Security / privacy review", value => value.length >= 40],
    ["UX review", value => /Facebook-familiar/i.test(value) && /DANZSTAK/i.test(value)],
    ["Deployment state", value => /^(not deployed|staging only)/i.test(value)],
    ["Rollback", value => value.length >= 40],
    ["Independent reviewer verdict", value => /^(unverified|pass|changes requested)/i.test(value)],
    ["Owner production decision", value => /^(authorized|not authorized)/i.test(value)]
  ];
  const missing = required.filter(([label, valid]) => !valid(sections.get(label.toLowerCase()) || "")).map(([label]) => label);
  assert.deepEqual(missing, [], `PR release evidence is missing, stale, or incomplete: ${missing.join(", ")}`);

  if (process.env.NODE_ENV !== "test") {
    const response = await fetch(preview, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "cache-control": "no-cache" } });
    assert.equal(response.status, 200, `Staging preview must be independently reachable (received ${response.status})`);
    const html = await response.text();
    assert.match(html, /assets\/epk\.css\?v=4/, "Staging preview must serve the reviewed EPK asset version");
    const worker = await fetch(new URL("/service-worker.js", preview), { signal: AbortSignal.timeout(15_000), headers: { "cache-control": "no-cache" } });
    assert.equal(worker.status, 200, "Staging service worker must be reachable");
    assert.match(await worker.text(), /danzstak-shell-v698/, "Staging preview must serve the reviewed PWA cache version");
  }

  console.log(`PR release evidence passed for exact head ${head} on reachable isolated staging. Human approval remains a separate required control.`);
};

main().catch(error => { console.error(error); process.exitCode = 1; });
