"use strict";
// Owner 2026-11-19: calls must ring and be answerable on every member page, not only in SYNC. Each page with the app
// bar loads the device check, the ringer and the call pop-up (browser-checks/incoming-call-everywhere.cjs runs them).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const members = fs.readdirSync(".").filter(name => name.endsWith(".html") && fs.readFileSync(name, "utf8").includes("assets/app-bar.js")).filter(name => !["privacy.html", "terms.html", "support.html", "trusted-contacts.html"].includes(name)).concat("profile.html");
for (const page of members) {
  const html = fs.readFileSync(page, "utf8");
  for (const asset of ["call-devices.js", "call-ringer.js", "incoming-calls.js", "incoming-calls.css"]) assert.match(html, new RegExp(`assets/${asset.replace(".", "\\.")}\\?v=\\d+`), `${page} loads ${asset}`);
  assert.ok(html.indexOf("assets/call-devices.js") < html.indexOf("assets/incoming-calls.js"), `${page}: the device check loads before the call pop-up`);
}
console.log(`Incoming call page checks passed: ${members.length} member pages load the device check, the ringer and the call pop-up.`);
