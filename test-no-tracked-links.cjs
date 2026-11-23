"use strict";
// 2026-11-22: a symbolic link named infrastructure/auth-api/node_modules (pointing at one machine's folder) was committed
// by accident, because .gitignore's "node_modules/" only matches a real folder, never a link. GitHub Pages then failed
// on main ("No such file or directory … infrastructure/auth-api/node_modules") and every checkout got a dead link.
// No tracked file may be a symbolic link, and node_modules is ignored in every form.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

let listing = "";
try { listing = execFileSync("git", ["ls-files", "-s"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); }
catch { console.log("No tracked links check skipped: not a git checkout."); process.exit(0); }
const links = listing.split("\n").filter(line => line.startsWith("120000 ")).map(line => line.split("\t")[1]);
assert.deepEqual(links, [], `symbolic links must not be committed: ${links.join(", ")}`);
const ignore = fs.readFileSync(".gitignore", "utf8").split(/\r?\n/).map(line => line.trim());
assert.ok(ignore.includes("node_modules"), ".gitignore ignores node_modules as a folder, a file or a link (not only \"node_modules/\")");
console.log("No tracked links checks passed: no symbolic links in the repository, node_modules ignored in every form.");
