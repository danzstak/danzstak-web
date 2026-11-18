"use strict";
// Regression (owner's Claude, 2026-11-18): the one-top-bar change hid .topnav on phones, and .topnav IS the phone
// bottom tab bar (Mix · Music HQ · Events · Bazaar · SYNC · Menu). The bottom tabs must never be hidden on phones.
const fs = require("node:fs");
const assert = require("node:assert");
const css = fs.readdirSync("assets").filter(n => n.endsWith(".css")).map(n => [n, fs.readFileSync(`assets/${n}`, "utf8")]);
for (const [name, text] of css) {
  for (const m of text.matchAll(/([^{}]*\.topnav[^{}]*)\{([^}]*)\}/g)) {
    const selector = m[1], body = m[2];
    if (/display\s*:\s*none/.test(body) && !/\.topnav\s+[.#\w]|\.topnav\s*>|\.topnav[.:\[]/.test(selector.trim().split(",").pop())) {
      assert.fail(`${name}: "${selector.trim()}" hides the phone bottom tabs`);
    }
  }
}
console.log("Phone bottom tabs are never hidden by a .topnav display:none rule.");
