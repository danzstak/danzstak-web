// Spec 47, Train B part 1 (owner 2026-11-24: "users may have a bunch of epk", "and also several per artist",
// "artist might send a different to different venues or festivals", "a limit of 5 epk per artist").
// - The builder works on one EPK at a time: ?epk=<id> in the address, or the one last worked on (kept on this device).
//   No id, or "main", is the account's first EPK, which older pages keep using.
// - The header shows "<artist> · <label> ▾"; tapping it opens My EPKs: every EPK grouped by artist, each name's
//   verification state, + New EPK (blank or a copy of this one), Rename and Delete.
// - Every builder call carries the EPK: path() adds ?epk=, body() adds epkId (assets/epk.js, epk-versions.js,
//   epk-share-card.js).
// Words go through i18n.js; artist names and labels are marked data-no-translate.
(() => {
  "use strict";
  const STORE = "danzstakEpkCurrent";
  const ID = /^[a-f0-9]{10}$/;
  const query = new URLSearchParams(location.search);
  const read = () => { try { return localStorage.getItem(STORE) || ""; } catch { return ""; } };
  const remember = id => { try { if (id && id !== "main") localStorage.setItem(STORE, id); else localStorage.removeItem(STORE); } catch { /* private mode */ } };
  const publicView = ["id", "share", "outreach"].some(key => query.has(key));
  let id = "main";
  if (ID.test(query.get("epk") || "")) id = query.get("epk");
  // The EPK last worked on, only for a plain epk.html (a version or Bring back link without ?epk= is the first EPK's).
  else if (!["epk", "version", "restore"].some(key => query.has(key)) && !publicView && ID.test(read())) id = read();
  if (!publicView) remember(id);
  if (!publicView && id !== "main" && query.get("epk") !== id) {
    query.set("epk", id);
    history.replaceState(history.state, "", `${location.pathname}?${query}${location.hash}`);
  }

  const byId = name => document.getElementById(name);
  const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children.filter(child => child !== null && child !== undefined && child !== false)); return node; };
  const name = text => { const span = el("span", { textContent: text }); span.setAttribute("translate", "no"); span.dataset.noTranslate = ""; return span; };
  const glyph = text => { const span = el("span", { textContent: text }); span.setAttribute("aria-hidden", "true"); return span; };
  const api = () => window.danzstakEpkBuilder?.api || "https://api.danzstak.com";
  const request = (...args) => (window.danzstakEpkBuilder?.request || fetch)(...args);
  const when = iso => window.danzstakEpkVersions?.when?.(iso) || "";
  const artistKey = value => String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const href = epkId => epkId === "main" ? "epk.html?epk=main" : `epk.html?epk=${encodeURIComponent(epkId)}`;
  let current = { artistName: "", label: "" }, listing = null;

  function path(url) {
    if (id === "main") return url;
    return `${url}${url.includes("?") ? "&" : "?"}epk=${encodeURIComponent(id)}`;
  }
  function body(data = {}) { return id === "main" ? data : { ...data, epkId: id }; }
  function link(url) { return path(url); }

  // The header switch: "<artist> · <label> ▾".
  function drawSwitch() {
    const button = byId("epkSwitch");
    if (!button) return;
    const artist = current.artistName || "", label = current.label || "";
    const parts = [];
    if (artist) parts.push(name(artist));
    if (artist && label) parts.push(document.createTextNode(" · "));
    if (label) parts.push(name(label));
    if (!parts.length) parts.push(document.createTextNode("My EPKs"));
    button.querySelector(".epk-switch__text").replaceChildren(...parts);
  }
  function show(data = {}) {
    if (data.kit && typeof data.kit.artistName === "string") current.artistName = data.kit.artistName;
    if (typeof data.label === "string") current.label = data.label;
    drawSwitch();
  }
  function typed(artistName) { current.artistName = String(artistName || "").trim(); drawSwitch(); }

  async function call(url, options = {}) {
    const response = await request(`${api()}${url}`, { credentials: "include", cache: "no-store", ...options }, 15000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Your EPKs could not be loaded."), { data, status: response.status });
    return data;
  }
  const post = data => call("/epk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const limitLine = artist => `${artist} already has 5 EPKs. Delete one to make another.`;

  function dialog() { return byId("epkLibraryDialog"); }
  function close() { const node = dialog(); if (typeof node?.close === "function") node.close(); else node?.removeAttribute("open"); }
  function say(text) { const status = byId("epkLibraryStatus"); if (status) status.textContent = text; }

  // A name is verified once for all its EPKs (task 20). "Verify this name" opens one of its EPKs at the verify steps.
  function verificationLine(entry, epkId) {
    if (!entry) return null;
    if (entry.status === "verified") return el("span", { className: "epk-lib-badge is-verified", textContent: "Verified ✓" });
    if (entry.status === "needs_review" || entry.status === "pending_review") return el("span", { className: "epk-lib-badge", textContent: "Waiting for review" });
    const verify = el("a", { className: "epk-lib-badge is-todo", href: `${href(epkId)}#epkVerifyChip`, textContent: "Verify this name" });
    verify.addEventListener("click", event => { if (epkId === id) { event.preventDefault(); close(); toVerify(); } });
    return verify;
  }
  function toVerify(tries = 0) {
    const chip = byId("epkVerifyChip");
    if (chip) { chip.closest("section, div")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (tries < 20) setTimeout(() => toVerify(tries + 1), 250);
  }

  function row(epk) {
    const item = el("li", { className: `epk-lib-row${epk.epkId === id ? " is-current" : ""}` });
    const open = el("a", { className: "epk-lib-open", href: href(epk.epkId) });
    if (epk.epkId === id) open.setAttribute("aria-current", "page");
    const title = el("span", { className: "epk-lib-label" }, epk.label ? name(epk.label) : document.createTextNode("Main EPK"));
    const date = epk.published ? when(epk.publishedAt) : "";
    const state = el("span", { className: "epk-lib-state", textContent: epk.published ? (date ? `Published ${date}` : "Published") : "Draft" });
    open.append(title, state);
    const rename = el("button", { type: "button", className: "epk-lib-icon", title: "Rename" }, glyph("✎"));
    rename.setAttribute("aria-label", "Rename");
    rename.dataset.icon = "edit"; // icon-buttons.js draws the shared pencil
    const remove = el("button", { type: "button", className: "epk-lib-icon is-danger", title: "Delete this EPK" }, glyph("🗑"));
    remove.setAttribute("aria-label", "Delete this EPK");
    remove.dataset.icon = "trash";
    rename.addEventListener("click", () => renameRow(item, epk));
    remove.addEventListener("click", () => removeEpk(epk));
    item.append(open, rename, remove);
    return item;
  }

  function renameRow(item, epk) {
    const input = el("input", { type: "text", maxLength: 40, value: epk.label || "", className: "epk-lib-input", required: true });
    input.setAttribute("aria-label", "EPK name");
    input.placeholder = "Live set, Festival, Italia";
    const saveButton = el("button", { type: "submit", className: "primary epk-lib-go", textContent: "Save" });
    const cancel = el("button", { type: "button", className: "epk-lib-quiet", textContent: "Cancel" });
    saveButton.dataset.iconLayout = cancel.dataset.iconLayout = "label";
    const form = el("form", { className: "epk-lib-rename" }, input, saveButton, cancel);
    cancel.addEventListener("click", () => item.replaceWith(row(epk)));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const label = input.value.replace(/\s+/g, " ").trim();
      if (!label) { input.focus(); return; }
      saveButton.disabled = true;
      try {
        await post({ action: "rename", epkId: epk.epkId, label });
        epk.label = label;
        if (epk.epkId === id) { current.label = label; drawSwitch(); }
        item.replaceWith(row(epk));
        say("Renamed.");
      } catch (error) { say(error.message); saveButton.disabled = false; }
    });
    item.replaceChildren(form);
    input.focus();
  }

  async function removeEpk(epk) {
    const confirmed = await window.danzstakConfirm?.("Its link, private review link, link preview, published versions and files go. Files another of your EPKs uses stay. Screenshots, downloads and copies outside DanzStak can't be recalled.", {
      title: "Delete this EPK?", confirmLabel: "Delete EPK", cancelLabel: "Keep EPK", danger: true
    });
    if (confirmed === false) return;
    say("Deleting EPK and private files...");
    try {
      await call(epk.epkId === "main" ? "/epk" : `/epk?epk=${encodeURIComponent(epk.epkId)}`, { method: "DELETE" });
      if (epk.epkId === id) { remember("main"); location.assign(href("main")); return; }
      say("EPK deleted.");
      await load();
    } catch (error) { say(error.message); }
  }

  function draw(data) {
    const groups = new Map();
    for (const epk of data.epks || []) {
      const key = artistKey(epk.artistName) || "-";
      if (!groups.has(key)) groups.set(key, { artistName: epk.artistName, epks: [] });
      groups.get(key).epks.push(epk);
    }
    const names = new Map((data.names || []).map(entry => [artistKey(entry.artistName), entry]));
    const list = byId("epkLibraryList");
    list.replaceChildren(...[...groups.entries()].map(([key, group]) => {
      const head = el("div", { className: "epk-lib-group__head" },
        el("h3", {}, group.artistName ? name(group.artistName) : document.createTextNode("No artist name yet")),
        el("span", { className: "epk-lib-count", textContent: `${group.epks.length} of ${data.maxPerArtist || 5}` }),
        verificationLine(names.get(key), group.epks[0].epkId));
      return el("section", { className: "epk-lib-group" }, head, el("ul", { className: "epk-lib-rows" }, ...group.epks.map(row)));
    }));
    if (!groups.size) list.replaceChildren(el("p", { className: "epk-lib-empty", textContent: "No EPKs yet. Save this one to start." }));
  }

  async function load() {
    say("Loading your EPKs...");
    try { listing = await call("/epk?list=1"); draw(listing); say(""); }
    catch (error) { say(error.message); }
  }

  function countFor(artist) {
    const key = artistKey(artist);
    return (listing?.epks || []).filter(epk => artistKey(epk.artistName) === key).length;
  }

  function setUpNew() {
    const form = byId("epkLibraryNew"), artist = byId("epkLibraryArtist"), label = byId("epkLibraryLabel"), line = byId("epkLibraryNewStatus");
    if (!form) return;
    byId("epkLibraryNewOpen").addEventListener("click", () => {
      form.hidden = false;
      artist.value = current.artistName || "";
      label.value = "";
      line.textContent = "";
      (artist.value ? label : artist).focus();
    });
    byId("epkLibraryNewCancel").addEventListener("click", () => { form.hidden = true; });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const copy = form.elements.epkStart.value === "copy";
      const artistName = copy ? current.artistName : artist.value.replace(/\s+/g, " ").trim();
      const labelText = label.value.replace(/\s+/g, " ").trim();
      if (!artistName) { line.textContent = copy ? "Add the artist or act name first." : "Add the artist name for the new EPK."; artist.focus(); return; }
      if (!labelText) { line.textContent = "Give the EPK a short name, like Live set or Festival."; label.focus(); return; }
      if (countFor(artistName) >= (listing?.maxPerArtist || 5)) { line.textContent = limitLine(artistName); return; }
      const submit = byId("epkLibraryCreate");
      submit.disabled = true;
      line.textContent = "Making your EPK...";
      try {
        const made = await post(copy ? { action: "create", from: id, label: labelText } : { action: "create", artistName, label: labelText });
        remember(made.epkId);
        location.assign(href(made.epkId));
      } catch (error) {
        line.textContent = error.data?.code === "epk_artist_limit" ? limitLine(artistName) : error.message;
        submit.disabled = false;
      }
    });
    // "Copy this EPK" keeps this EPK's artist; a blank one asks for the name.
    form.addEventListener("change", event => {
      if (event.target.name !== "epkStart") return;
      const copy = event.target.value === "copy";
      byId("epkLibraryArtistRow").hidden = copy;
      artist.required = !copy;
    });
  }

  function open() {
    const node = dialog();
    if (!node) return;
    const form = byId("epkLibraryNew");
    if (form) form.hidden = true;
    if (typeof node.showModal === "function") node.showModal(); else node.setAttribute("open", "");
    load();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (publicView) return;
    const button = byId("epkSwitch");
    if (button) { button.hidden = false; button.addEventListener("click", open); }
    byId("epkLibraryClose")?.addEventListener("click", close);
    byId("artistName")?.addEventListener("input", event => typed(event.target.value));
    setUpNew();
    drawSwitch();
    if (location.hash === "#epkVerifyChip") toVerify();
  });

  // The builder hands an EPK that's gone (deleted on another device) back to the first one.
  function missing() { remember("main"); location.replace(href("main")); }

  window.danzstakEpkLibrary = { get id() { return id; }, path, body, link, show, missing, open };
})();
