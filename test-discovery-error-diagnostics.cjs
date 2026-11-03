"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const tick = () => new Promise(resolve => setImmediate(resolve));
const element = (id = "") => ({
  id, value:"", hidden:false, disabled:false, textContent:"", children:[],
  addEventListener(type, handler) { this.listeners ||= {}; this.listeners[type] = handler; },
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children = [...nodes]; },
  scrollIntoView() {}, setAttribute() {}
});
const documentFor = ids => {
  const nodes = new Map(ids.map(id => [id, element(id)]));
  return {
    nodes,
    document: {
      getElementById: id => nodes.get(id) || null,
      createElement: tag => element(tag),
      createTextNode: value => ({ textContent:String(value) })
    }
  };
};
const providerFailure = {
  error:"Discovery is temporarily unavailable.",
  providers:[
    { name:"AWS Places", ok:false, count:0 },
    { name:"OpenStreetMap", ok:false, count:0 }
  ]
};

(async () => {
  const booking = documentFor(["venueQuickForm","venueQuickQuery","venueQuickStatus","venueQuickResults","venueQuickMore","bookingBrief","bookingBriefForm"]);
  booking.nodes.get("venueQuickQuery").value = "punk clubs in Berlin";
  vm.runInContext(fs.readFileSync("assets/booking-discovery.js", "utf8"), vm.createContext({
    document:booking.document, window:{ dispatchEvent() {} }, CustomEvent:class {}, AbortController,
    setTimeout, clearTimeout, encodeURIComponent,
    fetch:async () => ({ ok:false, json:async () => providerFailure })
  }));
  booking.nodes.get("venueQuickForm").listeners.submit({ preventDefault() {} });
  await tick(); await tick();
  assert.match(booking.nodes.get("venueQuickStatus").textContent, /AWS Places: unavailable/);
  assert.match(booking.nodes.get("venueQuickStatus").textContent, /OpenStreetMap: unavailable/);

  const storeIds = ["recordStoreForm","recordStoreLocation","recordStoreStatus","recordStoreResults","placementStores","placementStatus","loadMoreStores","savePlacement","releaseArtist","releaseTitleInput","releaseFormat","releaseGenre","releaseDate","releaseWholesale","releaseRetail","releaseEpk","releaseListen","releaseContactName","releaseContactEmail","releaseTerms"];
  const stores = documentFor(storeIds);
  stores.nodes.get("recordStoreLocation").value = "Tokyo, Japan";
  vm.runInContext(fs.readFileSync("assets/record-stores.js", "utf8"), vm.createContext({
    document:stores.document, AbortController, setTimeout, clearTimeout, encodeURIComponent,
    fetch:async url => String(url).endsWith("/record-store-workspace")
      ? { ok:true, json:async () => ({ release:{}, stores:[], revision:"" }) }
      : { ok:false, json:async () => providerFailure }
  }));
  await tick(); await tick();
  stores.nodes.get("recordStoreForm").listeners.submit({ preventDefault() {} });
  await tick(); await tick();
  assert.match(stores.nodes.get("recordStoreStatus").textContent, /AWS Places: unavailable/);
  assert.match(stores.nodes.get("recordStoreStatus").textContent, /OpenStreetMap: unavailable/);
  console.log("Discovery error checks passed: venue and record-store outages preserve per-provider diagnostics.");
})().catch(error => { console.error(error); process.exitCode = 1; });
