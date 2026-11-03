const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/profile-onboarding.js", "utf8");

assert.match(html, /id="profileOnboardingName"[^>]+aria-describedby="profileOnboardingHelp profileOnboardingStatus"/,
  "new-member name entry must expose its help and save status");
assert.match(source, /querySelector\("\.friend-name-search input"\)\?\.focus\(\{ preventScroll: true \}\)/,
  "Find people must move focus into the member-name search");
assert.match(source, /form\.setAttribute\("aria-busy", "true"\)/,
  "profile setup must announce its in-flight save state");
assert.match(source, /finally \{ save\.disabled = false; form\.setAttribute\("aria-busy", "false"\); \}/,
  "profile setup must clear its busy state after success or failure");

console.log("Profile onboarding handoff checks passed: guidance is connected, saves announce progress, and friend search receives focus.");
