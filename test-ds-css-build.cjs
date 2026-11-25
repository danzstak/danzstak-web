"use strict";
// UI kit build (docs/tasks/39-modern-look.md section 2): assets/ds.css and assets/icons.svg are committed and
// served as they are, so rebuilding them from tools/ui-kit must give the same files. Needs `npm ci` in tools/ui-kit
// (the "UI kit" job in review.yml does it; set UI_KIT_REQUIRED=1 there). Without it this prints SKIP, because the
// cloud build session can't reach npm.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");

const kit = path.join(__dirname, "tools", "ui-kit");
const cli = path.join(kit, "node_modules", "@tailwindcss", "cli", "package.json");
if (!fs.existsSync(cli)) {
  assert.ok(!process.env.UI_KIT_REQUIRED, "UI_KIT_REQUIRED is set but tools/ui-kit has no node_modules (run npm ci there)");
  console.log("SKIP ds.css rebuild: tools/ui-kit dependencies are not installed here");
  return;
}
const pkg = require(path.join(kit, "package.json"));
for (const [name, version] of Object.entries(pkg.devDependencies)) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} is pinned to an exact version`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ds-kit-"));
const norm = text => text.replace(/\r\n/g, "\n");
const bin = path.join(kit, "node_modules", ".bin", process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss");
const css = spawnSync(bin, ["-i", "./ds.src.css", "-o", path.join(tmp, "ds.css"), "--minify"], { cwd: kit, encoding: "utf8", shell: process.platform === "win32" });
assert.equal(css.status, 0, `tailwindcss failed:\n${css.stderr}`);
assert.equal(norm(fs.readFileSync(path.join(tmp, "ds.css"), "utf8")), norm(fs.readFileSync(path.join(__dirname, "assets", "ds.css"), "utf8")),
  "assets/ds.css is not what tools/ui-kit builds: run `npm run build` in tools/ui-kit (or push and let the UI kit build workflow commit it)");

fs.mkdirSync(path.join(tmp, "vendor"));
const icons = spawnSync(process.execPath, ["build-icons.cjs", path.join(tmp, "icons.svg")], { cwd: kit, encoding: "utf8" });
assert.equal(icons.status, 0, `build-icons failed:\n${icons.stderr}`);
assert.equal(norm(fs.readFileSync(path.join(tmp, "icons.svg"), "utf8")), norm(fs.readFileSync(path.join(__dirname, "assets", "icons.svg"), "utf8")),
  "assets/icons.svg is not what tools/ui-kit builds");
console.log("ds.css and icons.svg match a fresh build");
