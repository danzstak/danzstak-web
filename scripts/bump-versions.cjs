#!/usr/bin/env node
"use strict";
// Bumps the offline shell cache and asset ?v= numbers, and updates every test pin to match.
// Front-end rule: any changed asset needs a new ?v= and a new danzstak-shell-vNNN in service-worker.js.
//
//   node scripts/bump-versions.cjs --shell 871 --asset event.js:7 --asset feed-enhancements.css:519
//
// --shell N        set service-worker.js CACHE to danzstak-shell-vN and update every pin of the old value
// --asset name:N   set every "<name>?v=…" in *.html to N and update test / browser-check pins of the old value
// --dry-run        print what would change without writing
// Pins are matched both literally (feed.js?v=3) and as regex source (feed\.js\?v=3).
const fs = require("node:fs");
const path = require("node:path");

function parse(argv) {
  const out = { shell: null, assets: [], dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--shell") out.shell = argv[++i];
    else if (argv[i] === "--asset") { const [name, version] = String(argv[++i] || "").split(":"); out.assets.push({ name, version }); }
    else if (argv[i] === "--dry-run") out.dryRun = true;
  }
  if (out.shell !== null && !/^\d+$/.test(out.shell)) throw new Error("--shell needs a number");
  for (const a of out.assets) if (!/^[\w.-]+\.(js|css|mjs|webmanifest)$/.test(a.name || "") || !/^\d+$/.test(a.version || "")) throw new Error(`--asset needs name.ext:N, got ${a.name}:${a.version}`);
  return out;
}
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Repo-relative paths with forward slashes on every OS.
const listFiles = (root, dir, test) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(test).map(name => dir === "." ? name : `${dir}/${name}`) : [];

function plan(root, { shell, assets }) {
  const changes = new Map();
  const read = file => changes.get(file) ?? fs.readFileSync(path.join(root, file), "utf8");
  const write = (file, text) => { if (text !== read(file)) changes.set(file, text); };
  const html = listFiles(root, ".", n => n.endsWith(".html"));
  // test-dev-scripts.cjs holds sample pages for this script (its own fixtures), not pins: bumping event.js once rewrote them.
  const pins = [...listFiles(root, ".", n => /^test-.*\.cjs$/.test(n) && n !== "test-dev-scripts.cjs"), ...listFiles(root, "browser-checks", n => n.endsWith(".cjs"))];

  if (shell !== null) {
    const worker = read("service-worker.js"), old = worker.match(/danzstak-shell-v(\d+)/)?.[1];
    if (!old) throw new Error("service-worker.js has no danzstak-shell-vNNN");
    for (const file of ["service-worker.js", ...pins]) write(file, read(file).split(`danzstak-shell-v${old}`).join(`danzstak-shell-v${shell}`));
  }
  for (const { name, version } of assets) {
    const literal = new RegExp(`(?<![\\w-])${escapeRe(name)}\\?v=(\\d+)`, "g");
    const olds = new Set();
    for (const file of html) { const text = read(file); for (const m of text.matchAll(literal)) olds.add(m[1]); write(file, text.replace(literal, `${name}?v=${version}`)); }
    const [base, ext] = [name.slice(0, name.lastIndexOf(".")), name.slice(name.lastIndexOf(".") + 1)];
    for (const old of olds) for (const file of pins) {
      let text = read(file);
      text = text.replace(new RegExp(`(?<![\\w-])${escapeRe(`${name}?v=${old}`)}(?!\\d)`, "g"), `${name}?v=${version}`);
      text = text.replace(new RegExp(`(?<![\\w-])${escapeRe(`${base}\\.${ext}\\?v=${old}`)}(?!\\d)`, "g"), `${base}\\.${ext}\\?v=${version}`);
      write(file, text);
    }
  }
  return changes;
}

if (require.main === module) {
  const options = parse(process.argv.slice(2)), root = path.resolve(__dirname, "..");
  const changes = plan(root, options);
  for (const [file, text] of changes) { if (!options.dryRun) fs.writeFileSync(path.join(root, file), text); console.log(`${options.dryRun ? "would update" : "updated"} ${file}`); }
  // Task 34: /sync/ (SYNC as its own app) is generated from messages.html; keep it in step with every bump.
  const syncChanged = require("./build-sync-app.cjs").write({ dryRun: options.dryRun });
  if (syncChanged) console.log(`${options.dryRun ? "would update" : "updated"} sync/index.html`);
  const total = changes.size + (syncChanged && !changes.has("sync/index.html") ? 1 : 0);
  console.log(`${total} file${total === 1 ? "" : "s"} ${options.dryRun ? "would change" : "changed"}.`);
}
module.exports = { parse, plan };
