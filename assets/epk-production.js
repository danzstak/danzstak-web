"use strict";
(() => {
  const byId = id => document.getElementById(id);
  const kinds = new Set(["vocal-mic","instrument-mic","di","monitor","amplifier","drum-kit","keyboard","dj-mixer","playback","power","other"]);
  const positions = new Set(["rear-left","rear-center","rear-right","front-left","front-center","front-right"]);
  const connections = new Set(["mic","di","stereo-di","line","power"]), stands = new Set(["none","straight","boom","short"]);
  let state = { plotItems:[], inputs:[] };
  const clean = value => String(value || "").trim();
  const labels = {
    "rear-left":"Upstage left", "rear-center":"Upstage center", "rear-right":"Upstage right",
    "front-left":"Downstage left", "front-center":"Downstage center", "front-right":"Downstage right",
    "vocal-mic":"Vocal mic", "instrument-mic":"Instrument mic", "di":"DI", "stereo-di":"Stereo DI",
    "dj-mixer":"DJ mixer", "drum-kit":"Drum kit", "none":"None"
  };
  const labelFor = value => labels[value] || value.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const makeId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function normalized(value = {}) {
    const plotItems = Array.isArray(value.plotItems) ? value.plotItems.slice(0,24).map(item => ({ id:clean(item?.id).slice(0,64) || makeId(), kind:kinds.has(item?.kind) ? item.kind : "other", label:clean(item?.label).slice(0,100), position:positions.has(item?.position) ? item.position : "front-center" })).filter(item => item.label) : [];
    const inputs = Array.isArray(value.inputs) ? value.inputs.slice(0,48).map(item => ({ id:clean(item?.id).slice(0,64) || makeId(), source:clean(item?.source).slice(0,100), connection:connections.has(item?.connection) ? item.connection : "mic", stand:stands.has(item?.stand) ? item.stand : "none", phantom:item?.phantom === true, notes:clean(item?.notes).slice(0,240) })).filter(item => item.source) : [];
    return { plotItems, inputs };
  }
  function notify() { document.getElementById("epkForm")?.dispatchEvent(new CustomEvent("epkproductionchange", { bubbles:true })); }
  function itemRow(item, type, index) {
    const row = document.createElement("article"), copy = document.createElement("div"), title = document.createElement("strong"), detail = document.createElement("span"), remove = document.createElement("button");
    row.className = "epk-production-item"; title.textContent = type === "plot" ? item.label : `${index + 1}. ${item.source}`;
    detail.textContent = type === "plot" ? `${labelFor(item.kind)} · ${labelFor(item.position)}` : `${labelFor(item.connection)} · ${labelFor(item.stand)} stand${item.phantom ? " · 48V" : ""}${item.notes ? ` · ${item.notes}` : ""}`;
    copy.append(title, detail); remove.type = "button"; remove.textContent = "🗑️"; remove.title = `Remove ${title.textContent}`; remove.setAttribute("aria-label", `Remove ${title.textContent}`);
    remove.addEventListener("click", () => { state[type === "plot" ? "plotItems" : "inputs"].splice(index,1); renderEditor(); notify(); }); row.append(copy, remove); return row;
  }
  function renderList(node, items, type, empty) { node.replaceChildren(); if (!items.length) { const p = document.createElement("p"); p.className = "epk-production-empty"; p.textContent = empty; node.append(p); return; } items.forEach((item,index) => node.append(itemRow(item,type,index))); }
  function renderEditor() {
    renderList(byId("plotItems"), state.plotItems, "plot", "No equipment placed yet.");
    renderList(byId("inputItems"), state.inputs, "input", "No input channels added yet.");
    const booth = ["dj","electronic"].includes(byId("actType")?.value); byId("productionTitle").textContent = booth ? "Booth plot and input list" : "Stage plot and input list"; byId("productionHint").textContent = booth ? "Place the mixer, playback, power and monitoring the venue should prepare." : "Place the performers, microphones, backline and monitors the venue should prepare.";
  }
  function addPlot() { const label = clean(byId("plotLabel").value); if (!label) { byId("plotLabel").focus(); return; } state.plotItems.push({ id:makeId(), kind:byId("plotKind").value, label:label.slice(0,100), position:byId("plotPosition").value }); byId("plotLabel").value = ""; renderEditor(); notify(); }
  function addInput() { const source = clean(byId("inputSource").value); if (!source) { byId("inputSource").focus(); return; } state.inputs.push({ id:makeId(), source:source.slice(0,100), connection:byId("inputConnection").value, stand:byId("inputStand").value, phantom:byId("inputPhantom").checked, notes:clean(byId("inputNotes").value).slice(0,240) }); for (const id of ["inputSource","inputNotes"]) byId(id).value = ""; byId("inputPhantom").checked = false; renderEditor(); notify(); }
  function plotNode(production, actType = "band") {
    const data = normalized(production), wrap = document.createElement("div"); if (!data.plotItems.length && !data.inputs.length) return null; wrap.className = "epk-production-public";
    if (data.plotItems.length) { const plot = document.createElement("div"), grid = document.createElement("div"), audience = document.createElement("div"); plot.className = "epk-plot"; grid.className = "epk-plot-grid"; for (const position of positions) { const cell = document.createElement("div"), heading = document.createElement("b"); cell.className = "epk-plot-cell"; cell.dataset.position = position; heading.textContent = labelFor(position); cell.append(heading); data.plotItems.filter(item => item.position === position).forEach(item => { const gear = document.createElement("span"); gear.className = "epk-plot-gear"; gear.textContent = `${item.label} · ${labelFor(item.kind)}`; cell.append(gear); }); grid.append(cell); } audience.className = "epk-audience"; audience.textContent = ["dj","electronic"].includes(actType) ? "Dance floor / audience" : "Audience"; plot.append(grid,audience); wrap.append(plot); }
    if (data.inputs.length) { const list = document.createElement("div"), header = document.createElement("div"); list.className = "epk-input-list"; header.className = "epk-input-row"; ["Ch","Source","Connection","Stand / 48V","Notes"].forEach(value => { const span=document.createElement("span"); span.textContent=value; header.append(span); }); list.append(header); data.inputs.forEach((item,index) => { const row=document.createElement("div"); row.className="epk-input-row"; const values=[String(index+1),item.source,labelFor(item.connection),`${labelFor(item.stand)}${item.phantom ? " / 48V" : ""}`,item.notes || "—"]; values.forEach((value,i)=>{const span=document.createElement("span"); span.textContent=value; if(i>1) span.dataset.label=["","","Connection","Stand / 48V","Notes"][i]; row.append(span);}); list.append(row); }); wrap.append(list); }
    return wrap;
  }
  function init() { byId("addPlotItem")?.addEventListener("click", addPlot); byId("addInputItem")?.addEventListener("click", addInput); byId("actType")?.addEventListener("change", () => { renderEditor(); notify(); }); renderEditor(); }
  window.danzstakEpkProduction = { init, getData:() => normalized(state), setData:value => { state=normalized(value); renderEditor(); }, renderPublic:plotNode };
})();
