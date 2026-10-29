const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/booking-selections.js', 'utf8');
const csv = source.match(/function csvCell\(value\) \{[\s\S]*?\n  \}/)[0];
const context = vm.createContext({});
vm.runInContext(csv, context);
for (const value of ['=HYPERLINK("https://example.com")', '+123', '-10', '@SUM(1)', '  =1+1']) {
  assert.ok(context.csvCell(value).startsWith('"\''), 'spreadsheet formulas must export as text');
}
assert.equal(context.csvCell('Buyer says "yes"'), '"Buyer says ""yes"""');
assert.equal(context.csvCell(undefined), '""');
const summary = source.slice(source.indexOf('function updateControls()'), source.indexOf('function persist()'));
const state = vm.createContext({
  venues: [{booking:{stage:'Confirmed',followUp:'2000-01-01'}}, {booking:{stage:'Declined',followUp:'2000-01-01'}}, {booking:{stage:'Contacted',followUp:'2000-01-01'}}, {booking:{stage:'Research',followUp:'2999-01-01'}}],
  printButton:{}, downloadButton:{}, clearButton:{}, status:{}
});
vm.runInContext(summary + '; updateControls();', state);
assert.equal(state.status.textContent, '4 selected clubs · 1 confirmed · 1 follow-ups due');
console.log('Booking pipeline checks passed: follow-up counts exclude closed leads and CSV neutralizes formulas.');
