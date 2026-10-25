const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, 'assets/feed-enhancements.js'), 'utf8');
const code = source.slice(source.indexOf('        report.addEventListener("click", async () => {'), source.indexOf('        moderation.append(moderationTitle, moderationText, report);'));
let click, response = { ok: false, json: async () => ({ error: 'Unavailable' }) };
const requests = [], errors = [];
const report = { disabled: false, textContent: 'Report a problem', addEventListener: (_, handler) => { click = handler; } };
vm.runInNewContext(code, { report, group: { id: 'default-0' }, prompt: () => 'Concern to review', alert: message => errors.push(message),
  fetch: async (_, options) => { requests.push(JSON.parse(options.body)); return response; } });
(async () => {
  await click();
  assert.equal(report.textContent, 'Report a problem', 'failure cannot claim the report was sent');
  assert.equal(report.disabled, false); assert.equal(errors[0], 'Unavailable');
  response = { ok: true, json: async () => ({ report: { reportId: 'server-report-1' } }) };
  await click();
  assert.equal(report.textContent, 'Report submitted'); assert.equal(report.disabled, true);
  assert.equal(requests[1].targetType, 'group'); assert.equal(requests[1].groupId, 'default-0');
  console.log('Group report control checks passed: retry on failure and confirmation only after server storage.');
})().catch(error => { console.error(error); process.exitCode = 1; });
