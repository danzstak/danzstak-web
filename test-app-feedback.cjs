"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const feedback = readFileSync("assets/app-feedback.js", "utf8");
const styles = readFileSync("assets/app-feedback.css", "utf8");
const pwa = readFileSync("assets/pwa.js", "utf8");
const logout = readFileSync("assets/logout.js", "utf8");
const worker = readFileSync("service-worker.js", "utf8");

assert.match(feedback, /window\.danzstakShowFeedback = function/, "app feedback must be available to every core surface");
assert.match(feedback, /window\.danzstakConfirm = function/, "shared confirmation dialogs must be available to every core surface");
assert.match(feedback, /dialog\.addEventListener\("cancel"/, "Escape should safely cancel confirmations");
assert.match(feedback, /opener instanceof HTMLElement/, "confirmation dialogs should return focus to their opener");
assert.match(feedback, /aria-live", "polite"/, "app feedback should be announced accessibly");
assert.match(feedback, /aria-atomic", "true"/, "each message should be announced as a unit");
assert.match(styles, /safe-area-inset-bottom/, "feedback should clear mobile safe areas");
assert.match(styles, /prefers-reduced-motion:reduce/, "feedback should respect reduced motion");
assert.match(styles, /\.danzstak-confirm-dialog::backdrop/, "confirmations should have a focused modal surface");
assert.doesNotMatch(pwa, /\balert\(/, "install guidance should not block the page");
assert.doesNotMatch(logout, /\balert\(/, "logout failures should not block the page");
assert.match(pwa, /danzstakShowFeedback/, "manual installation guidance should use app feedback");
assert.match(logout, /danzstakShowFeedback/, "logout failures should use app feedback");
assert.match(worker, /"\/assets\/app-feedback\.js"/);
assert.match(worker, /"\/assets\/app-feedback\.css"/);

for (const file of ["index.html", "feed.html", "profile.html", "messages.html", "booking.html", "booking-selections.html"]) {
  const html = readFileSync(file, "utf8");
  assert.match(html, /assets\/app-feedback\.css\?v=2/, `${file} should load the shared feedback styles`);
  assert.match(html, /assets\/app-feedback\.js\?v=2/, `${file} should load the shared feedback behavior`);
}

console.log("App feedback checks passed: install and logout guidance use one accessible, nonblocking surface.");
