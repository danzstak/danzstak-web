"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const BATCH = 100, PAGE = 50;
  const parser = window.DanzStakMovingDay;
  const byId = id => document.getElementById(id);
  const status = byId("movingStatus");
  let items = [], shown = PAGE, moving = false;

  const money = cents => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  const node = (tag, text = "", className = "") => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
  const label = { discogs: "Discogs", ebay: "eBay", shopify: "Shopify", spreadsheet: "spreadsheet" };

  async function request(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", ...options, signal: controller.signal, headers: { "content-type": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || "Moving Day hit a problem. Nothing was lost; try again."); error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("DanzStak took too long to answer. Press Move again; items already moved are skipped.");
      if (error instanceof TypeError) throw new Error("No connection. Press Move again when you're back online; items already moved are skipped.");
      throw error;
    } finally { clearTimeout(timer); }
  }

  function adjusted(item) {
    const percent = Number(byId("priceAdjust").value) || 0;
    const price = Math.round(item.priceCents * (1 + percent / 100));
    const shippingText = byId("shippingAll").value.trim();
    const shipping = shippingText ? parser.money(shippingText) ?? item.shippingCents : item.shippingCents;
    return { priceCents: price, shippingCents: shipping };
  }

  function problems(item) {
    const { priceCents, shippingCents } = adjusted(item);
    const list = item.problems.filter(problem => problem === "no title");
    if (priceCents < 50) list.push("no price");
    if (shippingCents > priceCents) list.push("shipping above price");
    return list;
  }

  function visibleItems() {
    const term = byId("pickFilter").value.trim().toLocaleLowerCase();
    return term ? items.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase().includes(term)) : items;
  }

  function summary() {
    const chosen = items.filter(item => item.chosen);
    const ready = chosen.filter(item => !problems(item).length);
    byId("pickSummary").textContent = `${items.length} items found · ${chosen.length} picked${ready.length !== chosen.length ? ` · ${chosen.length - ready.length} need a fix` : ""}`;
    byId("moveButton").textContent = ready.length ? `Move ${ready.length} item${ready.length === 1 ? "" : "s"}` : "Pick items to move";
    byId("moveButton").disabled = !ready.length || moving;
  }

  function render() {
    const list = byId("pickList"), view = visibleItems();
    list.replaceChildren();
    for (const item of view.slice(0, shown)) {
      const row = node("li", "", "moving-item"), box = document.createElement("input");
      box.type = "checkbox"; box.checked = item.chosen; box.id = `pick-${item.row}`;
      box.addEventListener("change", () => { item.chosen = box.checked; summary(); });
      const text = node("label", "", "moving-item-text"); text.htmlFor = box.id;
      const issue = problems(item), { priceCents } = adjusted(item);
      text.append(node("strong", item.title || `Row ${item.row}`), node("span", item.description.split("\n").slice(0, 2).join(" · "), "moving-item-meta"));
      const price = node("span", issue.length ? issue.join(", ") : money(priceCents), issue.length ? "moving-item-issue" : "moving-item-price");
      row.append(box, text, price); list.append(row);
    }
    byId("pickMore").hidden = view.length <= shown;
    summary();
  }

  async function readFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { status.textContent = "That file is over 25 MB. Export only the items for sale and try again."; return; }
    status.textContent = "Reading your export…";
    const parsed = parser.toItems(parser.parseCsv(await file.text()));
    items = parsed.items.map(item => ({ ...item, chosen: item.forSale && !item.problems.includes("no title") }));
    shown = PAGE;
    if (!items.length) { status.textContent = "No items found in that file. Check that it's the inventory export with a header row."; return; }
    status.textContent = `Read ${items.length} items from your ${label[parsed.source]} export.`;
    const unused = byId("pickUnused");
    unused.hidden = !parsed.unused.length;
    unused.textContent = parsed.unused.length ? `Not moved (no DanzStak field yet): ${parsed.unused.slice(0, 12).join(", ")}${parsed.unused.length > 12 ? "…" : ""}` : "";
    for (const id of ["stepPick", "stepPrice", "stepMove"]) byId(id).hidden = false;
    render();
  }

  async function move() {
    const ready = items.filter(item => item.chosen && !problems(item).length);
    if (!ready.length || moving) return;
    moving = true; summary();
    const progress = byId("moveProgress"), count = byId("moveCount"), errors = byId("moveErrors");
    progress.parentElement.hidden = false; errors.replaceChildren(); errors.hidden = true; byId("moveDone").hidden = true;
    const totals = { moved: 0, skipped: 0, errors: 0 }, moveStatus = byId("moveStatus").value;
    try {
      for (let start = 0; start < ready.length; start += BATCH) {
        const batch = ready.slice(start, start + BATCH);
        const payload = batch.map(item => ({ sourceRef: item.sourceRef, title: item.title, description: item.description, imageUrl: item.imageUrl, inventory: item.inventory, ...adjusted(item) }));
        const result = await request("/marketplace/products/import", { method: "POST", body: JSON.stringify({ status: moveStatus, items: payload }) });
        totals.moved += result.moved; totals.skipped += result.skipped; totals.errors += result.errors;
        for (const entry of result.results.filter(entry => entry.result === "error")) {
          errors.append(node("li", `Row ${batch[entry.index]?.row}: ${entry.error}`)); errors.hidden = false;
        }
        for (const entry of result.results.filter(entry => entry.result !== "error")) batch[entry.index].chosen = false;
        progress.value = Math.round(Math.min(ready.length, start + BATCH) / ready.length * 100);
        count.textContent = `${Math.min(ready.length, start + BATCH)} of ${ready.length}`;
      }
      status.textContent = `Moved ${totals.moved}${totals.skipped ? ` · ${totals.skipped} were already here` : ""}${totals.errors ? ` · ${totals.errors} need a fix` : ""}.`;
      byId("moveDone").hidden = false;
    } catch (error) {
      status.textContent = error.status === 409 ? "Name your shop first, then come back to Moving Day." : error.message;
      if (error.status === 409) { byId("moveDone").hidden = false; byId("moveDone").firstElementChild.textContent = "Name my shop"; }
    } finally { moving = false; render(); }
  }

  byId("movingFile").addEventListener("change", event => readFile(event.target.files[0]).catch(() => { status.textContent = "That file couldn't be read. Save it as CSV and try again."; }));
  byId("pickFilter").addEventListener("input", () => { shown = PAGE; render(); });
  byId("pickAll").addEventListener("click", () => { for (const item of visibleItems()) item.chosen = true; render(); });
  byId("pickNone").addEventListener("click", () => { for (const item of visibleItems()) item.chosen = false; render(); });
  byId("pickMore").addEventListener("click", () => { shown += PAGE; render(); });
  for (const id of ["priceAdjust", "shippingAll"]) byId(id).addEventListener("input", render);
  byId("moveButton").addEventListener("click", move);
})();
