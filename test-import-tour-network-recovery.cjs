const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function abortHarness(source, startText, endText, expression) {
  const start = source.indexOf(startText), end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `missing helper ${startText}`);
  let timerCallback, cleared = false;
  class AbortController {
    constructor() { const listeners=[]; this.signal={addEventListener:(name,fn)=>{if(name==='abort')listeners.push(fn);}}; this.abort=()=>listeners.forEach(fn=>fn()); }
  }
  const context = vm.createContext({
    AbortController, Number, Math,
    location: { assign() {} },
    setTimeout: callback => { timerCallback=callback; return 12; },
    clearTimeout: id => { assert.equal(id,12); cleared=true; },
    fetch: (_,options) => new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{const error=Error('aborted');error.name='AbortError';reject(error);})),
  });
  vm.runInContext(source.slice(start,end),context);
  const request=vm.runInContext(expression,context).catch(error=>error);
  timerCallback();
  return request.then(error=>({error,cleared,context}));
}

(async()=>{
  const importer=readFileSync('assets/facebook-import.js','utf8');
  const importResult=await abortHarness(importer,'async function importFetch','async function digest','importFetch("https://api.danzstak.com/stories")');
  assert.match(importResult.error.message,/import took too long/i);assert.equal(importResult.cleared,true);
  assert.equal(vm.runInContext('importUploadDeadline(1)',importResult.context),120000);
  assert.ok(vm.runInContext('importUploadDeadline(16*1024*1024)',importResult.context)>120000);
  assert.match(importer,/await importFetch\(API\+path/);assert.match(importer,/await importFetch\(ticket\.uploadUrl/);

  const booking=readFileSync('assets/booking-agent.js','utf8');
  const tourResult=await abortHarness(booking,'async function toursRequest','function showSavedTours','toursRequest("/tours")');
  assert.match(tourResult.error.message,/tour service took too long/i);assert.equal(tourResult.cleared,true);
  assert.match(booking,/signal:\s*controller\.signal/);
  console.log('Import and tour network checks passed: API and media operations time out safely with adaptive upload time.');
})().catch(error=>{console.error(error);process.exitCode=1;});
