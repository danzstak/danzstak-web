"use strict";
// The repo's own dev tools (the dev machine is temporary): scripts/bump-versions.cjs updates the shell cache, asset ?v=
// numbers and every test pin together; scripts/run-all-tests.cjs runs the suite on any machine with Node.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parse, plan } = require("./scripts/bump-versions.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "danzstak-bump-"));
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
put("service-worker.js", 'const CACHE = "danzstak-shell-v866";\n');
put("feed.html", '<script src="assets/feed-enhancements.js?v=560" defer></script><script src="assets/my-feed-enhancements.js?v=560"></script>\n');
put("event.html", '<link href="assets/event.css?v=6"><script src="assets/event.js?v=6"></script>\n');
put("test-a.cjs", 'assert.match(worker, /danzstak-shell-v866/);\nassert.match(html, /assets\\/feed-enhancements\\.js\\?v=560/);\n');
put("test-b.cjs", 'const pin = "assets/event.js?v=6"; const other = "event.js?v=61";\n');
put("browser-checks/x.cjs", 'expect("feed-enhancements.js?v=560");\n');

const changes = plan(root, parse(["--shell", "867", "--asset", "feed-enhancements.js:562", "--asset", "event.js:7"]));
assert.equal(changes.get("service-worker.js"), 'const CACHE = "danzstak-shell-v867";\n');
assert.equal(changes.get("feed.html"), '<script src="assets/feed-enhancements.js?v=562" defer></script><script src="assets/my-feed-enhancements.js?v=560"></script>\n', "only the named asset, not one whose name merely ends with it");
assert.equal(changes.get("event.html"), '<link href="assets/event.css?v=6"><script src="assets/event.js?v=7"></script>\n', "event.css is a different asset");
assert.equal(changes.get("test-a.cjs"), 'assert.match(worker, /danzstak-shell-v867/);\nassert.match(html, /assets\\/feed-enhancements\\.js\\?v=562/);\n', "regex-style pins update too");
assert.equal(changes.get("test-b.cjs"), 'const pin = "assets/event.js?v=7"; const other = "event.js?v=61";\n', "v=61 is not v=6");
assert.equal(changes.get("browser-checks/x.cjs"), 'expect("feed-enhancements.js?v=562");\n');
assert.equal(fs.readFileSync(path.join(root, "feed.html"), "utf8").includes("v=560"), true, "plan() never writes; the CLI does");
assert.throws(() => parse(["--shell", "abc"]), /number/);
assert.throws(() => parse(["--asset", "event.js"]), /name\.ext:N/);
fs.rmSync(root, { recursive: true, force: true });

const runner = fs.readFileSync("scripts/run-all-tests.cjs", "utf8");
assert.match(runner, /\/\^test-\.\*\\\.cjs\$\//, "runs every test-*.cjs");
assert.match(runner, /test-release-verification\.ps1", "test-site\.ps1", "test-infrastructure\.ps1"/, "and the PowerShell suites");
assert.match(runner, /process\.exitCode = failures\.length \? 1 : 0;/);
console.log("Dev script checks passed: version bump updates shell, assets and test pins (literal and regex) without touching look-alike names; the suite runner covers every test.");
