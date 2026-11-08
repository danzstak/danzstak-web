const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("epk.html", "utf8");
const script = fs.readFileSync("assets/epk.js", "utf8");
const css = fs.readFileSync("assets/epk.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(html, /id="epkBookingHandoff"[^>]*hidden/, "the booking handoff must stay hidden before publication");
assert.match(html, /href="booking\.html#venueQuickTitle">Find clubs to pitch</, "the primary action must open real venue discovery");
assert.match(html, /href="booking-selections\.html">Review selected clubs</, "artists must be able to continue with saved venue selections");
assert.match(html, /review every recipient and message before anything is sent/i, "the handoff must not imply automatic outreach");
assert.match(script, /handoff\.hidden = row\.hidden/, "published state must control the handoff with the public link");
assert.match(script, /showLink\("",\s*false\)/, "deleting the EPK must hide the booking handoff");
assert.match(css, /\.epk-booking-handoff\[hidden\]\{display:none\}/, "the hidden state must override the component layout");
assert.match(css, /\.epk-booking-handoff__actions a\{[^}]*min-height:44px/, "handoff actions must retain mobile touch targets");
assert.match(worker, /danzstak-shell-v730/, "the installed PWA must fetch the new handoff assets");
assert.doesNotMatch(html, /tour-manager\/emails\/send|checkout|payment/i, "the UI handoff must not send or purchase automatically");

console.log("EPK-to-booking handoff regression checks passed.");
