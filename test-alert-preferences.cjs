const fs = require("node:fs");
const assert = require("node:assert/strict");

const settings = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const api = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

assert.match(settings, /Notify me about incoming calls/);
assert.match(settings, /Notify me about new messages/);
assert.match(settings, /data\.callAlerts !== false/);
assert.match(settings, /data\.messageAlerts !== false/);
assert.match(settings, /callAlerts: callAlertsCheckbox\.checked/);
assert.match(settings, /messageAlerts: messageAlertsCheckbox\.checked/);
assert.doesNotMatch(settings, /alertSettings\.addEventListener\("click"/,
  "call and message preferences must not open the unrelated device-settings dialog");
assert.match(styles, /\.alert-preferences/);

assert.match(api, /callAlerts:item\.callAlerts\?\.BOOL!==false/);
assert.match(api, /messageAlerts:item\.messageAlerts\?\.BOOL!==false/);
assert.match(api, /alertEnabled\(recipientEmail,'callAlerts'\)/);
assert.match(api, /alertEnabled\(recipientEmail,'messageAlerts'\)/);
assert.match(api, /typeof body\.callAlerts==='boolean'/);
assert.match(api, /typeof body\.messageAlerts==='boolean'/);

for (const key of ["Incoming calls", "New messages", "Notify me about incoming calls", "Notify me about new messages"]) {
  assert.ok(i18n.includes(JSON.stringify(key)), `${key} must be included in the internationalized settings UI`);
}

console.log("Alert preference checks passed: call and message push alerts are independently saved, translated, and enforced.");
