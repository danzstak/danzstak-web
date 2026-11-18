"use strict";
// AI EPK builder, the artist's side (task 08, queue 5b; server in ai-epk.mjs). Phone first, five screens:
// 1 Start (what's included, price, refund rule, disclaimer) · 2 Tell us who you are · 3 Is this you? (free)
// 4 Pay ($5 + fees, Stripe Test Mode) · 5 Build (progress), then the normal editor opens pre-filled with every
// AI-written section marked "AI draft — check it" with its sources. Publishing is blocked on the server until
// each marked section is checked (or the artist ticks "I reviewed all AI-written sections…").
// The price shows only when the artist chooses AI and hasn't bought it (owner 2026-11-18: once bought, never again).
// Building by hand never shows a price.
(() => {
  const api = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  const t = value => window.danzstakTranslate?.(value) || value;
  const money = cents => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  const el = (tag, className = "", textValue = "") => { const node = document.createElement(tag); if (className) node.className = className; if (textValue) node.textContent = t(textValue); return node; };
  const button = (label, kind = "primary", type = "button") => { const node = el("button", `ds-btn-${kind}`, label); node.type = type; return node; };
  const LIST_FIELDS = ["lineup", "releases", "notableShows", "achievements"], LINK_FIELDS = ["musicLinks", "videoLinks", "socialLinks"];
  const LABELS = { shortPitch: "One-line pitch", shortBio: "Short biography", bio: "Full biography", genres: "Genres", hometown: "Home town", lineup: "Lineup", releases: "Releases", notableShows: "Notable shows", achievements: "Achievements", pressQuotes: "Press quotes", musicLinks: "Music links", videoLinks: "Video links", socialLinks: "Social links" };
  let offer = null, sheet = null, pollTimer = 0, pushed = false;

  async function call(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), options.timeout || 30000);
    try {
      const response = await fetch(`${api}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal, ...options, headers: options.body ? { "content-type": "application/json" } : undefined });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch { return { ok: false, status: 0, data: { error: "You're offline or the connection dropped. Try again." } }; } finally { clearTimeout(timer); }
  }
  const post = (path, body = {}) => call(path, { method: "POST", body: JSON.stringify(body) });

  // ---------- the entry in the builder ----------
  function mountChoice() {
    const guide = byId("epkGuide");
    if (!guide || byId("epkAiChoice")) return;
    const row = el("div", "epk-ai-choice"); row.id = "epkAiChoice";
    const self = button("Build it myself", "tonal"), aiButton = button("", "primary");
    aiButton.id = "epkAiStart";
    const label = el("span", "", "Let AI build it"), price = el("span", "epk-ai-price");
    aiButton.append(label, price);
    self.append(el("span", "epk-ai-free", "free"));
    self.setAttribute("aria-label", `${t("Build it myself")}, ${t("free")}`);
    self.addEventListener("click", () => { row.dataset.chosen = "self"; byId("artistName")?.focus(); });
    aiButton.addEventListener("click", () => openSheet(aiButton.dataset.mode === "redesign" ? "redesign" : undefined));
    row.append(self, aiButton);
    guide.querySelector(".epk-guide-heading")?.after(row);
    renderChoice();
  }
  function renderChoice() {
    const aiButton = byId("epkAiStart"); if (!aiButton || !offer) return;
    const price = aiButton.querySelector(".epk-ai-price");
    if (!offer.available) { aiButton.disabled = true; aiButton.firstChild.textContent = t("AI builder coming soon"); price.textContent = ""; aiButton.removeAttribute("aria-label"); return; }
    aiButton.disabled = false;
    const running = offer.job && !["draft_ready", "failed"].includes(offer.job.status);
    // Once the AI EPK is bought and built, the button becomes the AI redesign: a separate, clearly named purchase.
    const redesign = !running && offer.owned && offer.job?.status === "draft_ready" && offer.credits < 1;
    aiButton.dataset.mode = redesign ? "redesign" : "build";
    aiButton.firstChild.textContent = t(running ? "Continue your AI build" : redesign ? "AI redesign" : "Let AI build it");
    // The price only until it's bought (or while a paid build is waiting to be used).
    price.textContent = redesign ? (offer.redesignCredits > 0 ? "" : money(offer.totalCents)) : offer.owned || offer.credits > 0 ? "" : money(offer.totalCents);
    aiButton.setAttribute("aria-label", [aiButton.firstChild.textContent, price.textContent].filter(Boolean).join(", "));
  }

  // ---------- the full-screen sheet ----------
  function openSheet(screen) {
    if (!offer?.available) return;
    if (!sheet) {
      sheet = el("dialog", "epk-ai-sheet"); sheet.setAttribute("aria-labelledby", "epkAiTitle");
      const head = el("div", "epk-ai-head"), title = el("h2", "", "AI EPK"); title.id = "epkAiTitle";
      const close = button("", "icon"); close.className = "ds-btn-icon epk-ai-close"; close.setAttribute("aria-label", t("Close")); close.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z"/></svg>';
      close.addEventListener("click", () => closeSheet(false));
      head.append(title, close);
      sheet.append(head, el("div", "epk-ai-body"));
      sheet.addEventListener("cancel", event => { event.preventDefault(); closeSheet(false); });
      document.body.append(sheet);
      window.addEventListener("popstate", () => { if (sheet.open) closeSheet(true); });
    }
    if (!sheet.open) {
      sheet.showModal();
      // Device Back closes the sheet and stays on the EPK builder; drafts and the build keep going.
      try { history.pushState({ epkAiSheet: true }, ""); pushed = true; } catch { pushed = false; }
    }
    show(screen || firstScreen());
  }
  function closeSheet(fromHistory) {
    if (!sheet?.open) return;
    clearTimeout(pollTimer);
    sheet.close();
    if (!fromHistory && pushed) history.back();
    pushed = false;
    byId("epkAiStart")?.focus();
  }
  function firstScreen() {
    const job = offer.job;
    if (job && !["failed"].includes(job.status)) return "build";
    if (offer.credits > 0 && offer.draft?.confirmed?.length) return "confirm";
    return "start";
  }
  function body(titleText, ...nodes) {
    const box = sheet.querySelector(".epk-ai-body"); box.replaceChildren();
    sheet.querySelector("#epkAiTitle").textContent = t(titleText);
    box.append(...nodes.filter(Boolean)); box.scrollTop = 0;
    return box;
  }
  const note = (value, className = "epk-ai-note") => el("p", className, value);
  const statusLine = () => { const p = el("p", "epk-ai-status"); p.setAttribute("role", "status"); p.setAttribute("aria-live", "polite"); return p; };
  function actions(...buttons) { const row = el("div", "epk-ai-actions"); row.append(...buttons); return row; }

  function show(screen) {
    if (screen === "start") return screenStart();
    if (screen === "who") return screenWho();
    if (screen === "confirm") return screenConfirm();
    if (screen === "pay") return screenPay();
    if (screen === "redesign") return screenRedesign();
    if (String(screen).startsWith("rewrite:")) return screenRewrite(screen.slice(8));
    return screenBuild();
  }

  // 1. Start
  function screenStart() {
    const list = el("ul", "epk-ai-included");
    for (const item of ["1 full build from your links and the public pages you confirm", `${offer.rewritesIncluded} AI rewrites of any section`, "1 booking pitch email to one venue, included"]) list.append(el("li", "", item));
    const price = offer.owned || offer.credits > 0 ? null : el("p", "epk-ai-total", `${money(offer.totalCents)}`);
    if (price) price.append(el("small", "", ` (${money(offer.priceCents)} + ${money(offer.feeCents)} ${t("fee")})`));
    const start = button("Start");
    start.addEventListener("click", () => show("who"));
    body("Let AI build your EPK", list, price,
      offer.owned || offer.credits > 0 ? null : note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee."),
      note(offer.disclaimer, "epk-ai-disclaimer"), actions(start));
    start.focus();
  }

  // 2. Tell us who you are
  function screenWho() {
    const form = el("form", "epk-ai-form"), d = offer.draft?.input || {};
    const field = (labelText, input) => { const label = el("label", "", labelText); label.append(input); return label; };
    const name = Object.assign(el("input"), { name: "artistName", required: true, maxLength: 120, value: d.artistName || byId("artistName")?.value || "" });
    const city = Object.assign(el("input"), { name: "city", maxLength: 120, value: d.city || byId("hometown")?.value || "", autocomplete: "address-level2" });
    const genre = Object.assign(el("input"), { name: "genre", maxLength: 80, value: d.genre || "", placeholder: t("punk, metal, techno…") });
    const act = el("select"); act.name = "actType";
    for (const [value, label] of [["band", "Band"], ["dj", "DJ"], ["electronic", "Electronic live act"], ["solo", "Solo artist"]]) { const o = el("option", "", label); o.value = value; act.append(o); }
    act.value = d.actType || byId("actType")?.value || "band";
    const links = Object.assign(el("textarea"), { name: "links", rows: 4, value: (d.links || []).join("\n"), placeholder: "https://yourband.bandcamp.com\nhttps://soundcloud.com/you" });
    const two = el("div", "epk-ai-two"); two.append(field("City", city), field("Genre", genre));
    const status = statusLine(), go = button("Find me", "primary", "submit");
    form.append(field("Act name", name), two, field("Band or DJ", act), field("Your links (one per line)", links),
      note("Bandcamp, SoundCloud, Mixcloud, Spotify, YouTube, Instagram, your website, Resident Advisor, Discogs, press."),
      note("Your links and public information about you are sent to our AI provider to write the draft. They are never used to train AI."), status, actions(go));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const input = { artistName: name.value.trim(), city: city.value.trim(), genre: genre.value.trim(), actType: act.value, links: links.value.split(/\s+/).map(v => v.trim()).filter(Boolean) };
      if (!input.artistName) { name.focus(); return; }
      if (!input.links.length && !input.city) { status.textContent = t("Add at least one link, or your city."); links.focus(); return; }
      go.disabled = true; status.textContent = t("Looking for you…");
      const res = await post("/epk/ai/identify", { input });
      go.disabled = false;
      if (!res.ok) { status.textContent = t(res.data.error || "Something went wrong. Try again."); return; }
      offer.draft = res.data.draft; offer.searchNote = res.data.note || "";
      show("confirm");
    });
    body("Tell us who you are", form);
    name.focus();
  }

  // 3. Is this you? (free)
  function screenConfirm() {
    const draft = offer.draft, form = el("form", "epk-ai-form"), list = el("ul", "epk-ai-found");
    for (const item of draft.candidates) {
      const li = el("li"), label = el("label", "epk-ai-pick"), box = Object.assign(el("input"), { type: "checkbox", value: item.url, checked: draft.confirmed.includes(item.url) });
      const copy = el("span", "epk-ai-pick-copy");
      copy.append(el("strong", "", item.title || item.site), el("small", "", item.own ? `${item.site} · ${t("your link")}` : item.site));
      if (item.snippet && !item.own) copy.append(el("span", "epk-ai-snippet", item.snippet));
      label.append(box, copy); li.append(label); list.append(li);
    }
    const add = Object.assign(el("input"), { type: "url", placeholder: "https://", inputMode: "url" }); add.setAttribute("aria-label", t("Add another page that is you"));
    const addRow = el("div", "epk-ai-add"), addButton = button("Add", "tonal");
    addRow.append(add, addButton);
    const status = statusLine(), go = button(offer.credits > 0 ? "Build my EPK" : "These are me", "primary", "submit");
    const extra = [];
    addButton.addEventListener("click", () => { const value = add.value.trim(); if (/^https:\/\//i.test(value)) { extra.push(value); const li = el("li"), label = el("label", "epk-ai-pick"), box = Object.assign(el("input"), { type: "checkbox", value, checked: true }); const copy = el("span", "epk-ai-pick-copy"); copy.append(el("strong", "", value), el("small", "", "your link")); label.append(box, copy); li.append(label); list.append(li); add.value = ""; } else status.textContent = t("Links start with https://"); });
    form.append(...[note("Many acts share a name. Tick only the pages that are really you — the AI reads nothing else."), offer.searchNote ? note(offer.searchNote) : null, list, addRow, status, actions(go)].filter(Boolean));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const urls = [...list.querySelectorAll("input:checked")].map(box => box.value);
      go.disabled = true; status.textContent = "";
      const res = await post("/epk/ai/confirm", { urls, add: extra });
      if (!res.ok) { go.disabled = false; status.textContent = t(res.data.error || "Something went wrong. Try again."); return; }
      offer.draft = res.data.draft;
      if (offer.credits > 0) return startBuild(status, go);
      go.disabled = false; show("pay");
    });
    body("Is this you?", form);
  }

  // 4. Pay
  function screenPay(kind = "build") {
    const table = el("dl", "epk-ai-bill");
    for (const [label, cents] of [[kind === "redesign" ? "AI redesign" : "AI EPK", offer.priceCents], ["DanzStak fee", offer.feeCents], ["Total", offer.totalCents]]) table.append(el("dt", "", label), Object.assign(el("dd"), { textContent: money(cents) }));
    const status = statusLine(), pay = button(`${t("Pay")} ${money(offer.totalCents)}`);
    pay.addEventListener("click", async () => {
      pay.disabled = true; status.textContent = t("Opening secure checkout…");
      const res = await post("/tour-manager/ai-epk/checkout", { kind });
      if (res.ok && /^https:\/\/checkout\.stripe\.com\//.test(res.data.checkoutUrl || "")) { location.assign(res.data.checkoutUrl); return; }
      pay.disabled = false; status.textContent = t(res.data.error || "Checkout couldn't start. Try again.");
    });
    body(kind === "redesign" ? "Pay for your AI redesign" : "Pay for your AI EPK", table, note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee."), note(offer.disclaimer, "epk-ai-disclaimer"), status, actions(pay));
  }

  // The artist's current EPK text for a redesign (text fields only; never images, files or contacts).
  function currentKitText() {
    const lines = id => (byId(id)?.value || "").split("\n").map(v => v.trim()).filter(Boolean);
    return { shortPitch: byId("shortPitch")?.value || "", shortBio: byId("shortBio")?.value || "", bio: byId("bio")?.value || "", genres: (byId("genres")?.value || "").split(",").map(v => v.trim()).filter(Boolean), releases: lines("releases"), notableShows: lines("notableShows"), achievements: lines("achievements"), lineup: lines("lineup") };
  }
  // AI redesign ($5 + fees): a fresh draft from the current EPK and the confirmed pages, 3 rewrites included.
  function screenRedesign() {
    const list = el("ul", "epk-ai-included");
    for (const item of ["A fresh draft of your pitch and bios, and a suggested look, from your current EPK and your confirmed pages", "3 AI rewrites included", "Your saved EPK doesn't change until you save"]) list.append(el("li", "", item));
    const paid = offer.redesignCredits > 0, status = statusLine();
    const price = paid ? null : el("p", "epk-ai-total", `${money(offer.totalCents)}`);
    if (price) price.append(el("small", "", ` (${money(offer.priceCents)} + ${money(offer.feeCents)} ${t("fee")})`));
    const go = button(paid ? "Redesign my EPK" : "Continue");
    go.addEventListener("click", () => { if (paid) { go.disabled = true; startBuild(status, go, "redesign"); } else screenPay("redesign"); });
    body("AI redesign", list, price, paid ? null : note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee."), note(offer.disclaimer, "epk-ai-disclaimer"), status, actions(go));
    go.focus();
  }

  // One of the included rewrites of a prose section ("shorter", "more punk", "in Italian").
  function screenRewrite(field) {
    const input = byId(field); if (!input) return closeSheet(false);
    const look = byId("epkLook")?.value || "techno", scene = { punk: "More punk", metal: "More metal" }[look] || "More electronic";
    const status = statusLine(), result = el("div", "epk-ai-rewrite-result"), chips = el("div", "epk-ai-chips");
    const custom = Object.assign(el("input"), { maxLength: 120, placeholder: t("Or say how") });
    custom.setAttribute("aria-label", t("Say how to rewrite it"));
    const left = el("p", "epk-ai-note"); left.textContent = `${offer.job.rewritesLeft} ${t(offer.job.rewritesLeft === 1 ? "rewrite left" : "rewrites left")}`;
    const run = async instruction => {
      if (!instruction) { custom.focus(); return; }
      chips.querySelectorAll("button").forEach(b => { b.disabled = true; }); status.textContent = t("Rewriting…"); result.replaceChildren();
      const res = await post("/epk/ai/rewrite", { section: field, instruction, text: input.value });
      chips.querySelectorAll("button").forEach(b => { b.disabled = false; });
      if (res.status === 402) { offer.job.rewritesLeft = 0; mountRewriteButtons(); renderChoice(); show("redesign"); return; }
      if (!res.ok) { status.textContent = t(res.data.error || "Something went wrong. Try again."); if (Number.isInteger(res.data.rewritesLeft)) offer.job.rewritesLeft = res.data.rewritesLeft; return; }
      offer.job.rewritesLeft = res.data.rewritesLeft; status.textContent = ""; left.textContent = `${res.data.rewritesLeft} ${t(res.data.rewritesLeft === 1 ? "rewrite left" : "rewrites left")}`;
      const use = button("Use this"), keep = button("Keep mine", "text");
      use.addEventListener("click", () => {
        input.value = res.data.text;
        document.querySelector(`.epk-ai-mark[data-field="${field}"]`)?.remove();
        markSections([field], offer.job.draft);
        byId("epkForm")?.dispatchEvent(new Event("input", { bubbles: true }));
        mountRewriteButtons(); closeSheet(false);
      });
      keep.addEventListener("click", () => { mountRewriteButtons(); closeSheet(false); });
      result.append(el("p", "epk-ai-rewrite-text"), actions(keep, use));
      result.firstChild.textContent = res.data.text;
      use.focus();
    };
    for (const label of ["Shorter", scene, "In Italian", "In French", "In Spanish"]) { const chip = button(label, "tonal"); chip.addEventListener("click", () => run(label.toLowerCase())); chips.append(chip); }
    const customRow = el("div", "epk-ai-add"), go = button("Rewrite", "tonal"); go.addEventListener("click", () => run(custom.value.trim())); customRow.append(custom, go);
    const now = el("blockquote", "epk-ai-current"); now.textContent = input.value;
    body(`${t("Rewrite")}: ${t(LABELS[field] || field)}`, now, chips, customRow, left, status, result);
  }
  function mountRewriteButtons() {
    const left = offer?.job?.status === "draft_ready" ? offer.job.rewritesLeft || 0 : 0;
    for (const field of ["shortPitch", "shortBio", "bio"]) {
      const input = byId(field), label = input?.closest("label"); if (!label) continue;
      let control = label.querySelector(".epk-ai-rewrite");
      if (!left || !input.value.trim()) { control?.remove(); continue; }
      if (!control) { control = button("", "text"); control.className = "ds-btn-text epk-ai-rewrite"; control.addEventListener("click", event => { event.preventDefault(); openSheet(`rewrite:${field}`); }); label.insertBefore(control, input); }
      control.textContent = `${t("Rewrite with AI")} · ${left} ${t("left")}`;
    }
  }

  async function startBuild(status, go, kind = "build") {
    const res = await post("/epk/ai/build", kind === "redesign" ? { kind, kit: currentKitText() } : { kind });
    if (go) go.disabled = false;
    if (res.status === 402) { show(kind === "redesign" ? "redesign" : "pay"); return; }
    if (!res.ok) { if (status) status.textContent = t(res.data.error || "The build couldn't start. Try again."); return; }
    offer.job = res.data.job;
    if (kind === "redesign") offer.redesignCredits = Math.max(0, (offer.redesignCredits || 0) - 1); else offer.credits = Math.max(0, offer.credits - 1);
    renderChoice();
    show("build");
  }

  // 5. Build (progress), then open the draft in the editor
  function screenBuild() {
    const list = el("ol", "epk-ai-progress"); list.setAttribute("aria-live", "polite");
    const status = statusLine(), done = button(offer.job?.kind === "redesign" ? "Open my redesign" : "Open my draft"); done.hidden = true;
    const retry = button("Try again"); retry.hidden = true;
    const found = el("div", "epk-ai-alsofound");
    done.addEventListener("click", () => { applyDraft(offer.job); closeSheet(false); });
    retry.addEventListener("click", () => { retry.hidden = true; startBuild(status, null, offer.job?.kind === "redesign" ? "redesign" : "build"); });
    body("Building your EPK", note("This takes a minute or two. You can close this; the build continues when you come back."), note(offer.disclaimer, "epk-ai-disclaimer"), list, status, found, actions(done, retry));
    const paint = job => {
      list.replaceChildren(...(job?.progress || []).map(line => el("li", "", line)));
      if (job?.status === "draft_ready") {
        done.hidden = false; done.focus();
        if (job.alsoFound?.length) {
          found.replaceChildren(el("h3", "", "Also found — is this you?"), note("These weren't used. Tick them next time if they're really you."));
          const ul = el("ul"); for (const item of job.alsoFound.slice(0, 6)) { const li = el("li"); const a = Object.assign(el("a"), { href: item.url, target: "_blank", rel: "noopener noreferrer", textContent: item.title || item.site }); li.append(a); ul.append(li); } found.append(ul);
        }
      }
      if (job?.status === "failed") { status.textContent = t(job.error || "The build didn't finish."); retry.hidden = !job.restored; }
    };
    paint(offer.job);
    const tick = async () => {
      if (!sheet?.open || !offer.job || ["draft_ready", "failed"].includes(offer.job.status)) return;
      const res = await post("/epk/ai/step");
      if (res.ok && res.data.job) { offer.job = res.data.job; paint(offer.job); renderChoice(); }
      else if (!res.ok && res.status !== 0) status.textContent = t(res.data.error || "Something went wrong. Retrying…");
      pollTimer = setTimeout(tick, 1200);
    };
    clearTimeout(pollTimer); pollTimer = setTimeout(tick, 300);
  }

  // ---------- the draft in the editor ----------
  function setField(id, value, replace = false) {
    const input = byId(id); if (!input) return false;
    let next = "";
    if (id === "genres") next = value.join(", ");
    else if (LIST_FIELDS.includes(id)) next = value.join("\n");
    else if (LINK_FIELDS.includes(id)) next = value.map(item => `${item.label} | ${item.url}`).join("\n");
    else if (id === "pressQuotes") next = value.map(item => `${item.quote} | ${item.source}${item.url ? ` | ${item.url}` : ""}`).join("\n");
    else next = String(value || "");
    if (!next || (input.value.trim() && !replace)) return false; // never overwrite what the artist already wrote (except a paid redesign of the prose)
    input.value = next;
    return true;
  }
  function applyDraft(job) {
    const draft = job?.draft; if (!draft) return;
    const filled = [];
    const redesign = job.kind === "redesign";
    for (const field of draft.aiFields) if (setField(field, draft.kit[field], redesign && ["shortPitch", "shortBio", "bio"].includes(field))) filled.push(field);
    if (draft.look && byId("epkLook") && (redesign || byId("epkLook").value === "techno")) { byId("epkLook").value = draft.look; byId("epkLook").dispatchEvent(new Event("change", { bubbles: true })); }
    // Sections the artist had already written aren't AI drafts: clear them from the review list.
    const untouched = draft.aiFields.filter(field => !filled.includes(field));
    if (untouched.length) post("/epk/ai/review", { sections: untouched });
    try { localStorage.setItem(`danzstak_ai_epk_applied_${job.id}`, "1"); } catch {}
    byId("epkForm")?.dispatchEvent(new Event("input", { bubbles: true }));
    for (const field of filled) document.querySelector(`.epk-ai-mark[data-field="${field}"]`)?.remove();
    markSections(filled, draft);
    mountRewriteButtons();
    if (draft.checklist?.length) {
      const guide = byId("epkGuide"); guide?.querySelector(".epk-ai-todo")?.remove();
      const todo = el("div", "epk-ai-todo"); todo.append(el("h3", "", "Still missing"));
      const ul = el("ul"); for (const item of draft.checklist) ul.append(el("li", "", item)); todo.append(ul);
      guide?.append(todo);
    }
    if (byId("showAllFields") && document.querySelector("[data-epk-step].is-hidden-step, .epk-guided")) byId("showAllFields").click();
    byId(filled[0])?.closest("label")?.scrollIntoView({ block: "center" });
  }
  function markSections(fields, draft) {
    for (const field of fields) {
      const input = byId(field), label = input?.closest("label");
      if (!label || label.querySelector(".epk-ai-mark")) continue;
      const mark = el("span", "epk-ai-mark"); mark.dataset.field = field;
      mark.append(el("span", "epk-ai-badge", "AI draft — check it"));
      const sources = (draft?.sources?.[field] || []).slice(0, 4);
      if (sources.length) {
        const src = el("span", "epk-ai-sources"); src.append(el("span", "", "Sources:"));
        for (const url of sources) { const a = Object.assign(el("a"), { href: url, target: "_blank", rel: "noopener noreferrer" }); try { a.textContent = new URL(url).hostname.replace(/^www\./, ""); } catch { a.textContent = url; } src.append(" ", a); }
        mark.append(src);
      }
      const ok = button("Looks right", "text"); ok.addEventListener("click", event => { event.preventDefault(); reviewed(field); });
      mark.append(ok);
      label.insertBefore(mark, input);
      // Editing the section counts as checking it.
      input.addEventListener("input", () => reviewed(field), { once: true });
    }
    renderReviewGate();
  }
  async function reviewed(field) {
    document.querySelector(`.epk-ai-mark[data-field="${field}"]`)?.remove();
    renderReviewGate();
    await post("/epk/ai/review", { sections: [field], quotesPermission: false });
  }
  function renderReviewGate() {
    const pending = document.querySelectorAll(".epk-ai-mark").length, actionsRow = document.querySelector("#epkForm .form-actions");
    let gate = byId("epkAiReviewGate");
    if (!pending) { gate?.remove(); return; }
    if (!gate && actionsRow) {
      gate = el("label", "epk-ai-gate"); gate.id = "epkAiReviewGate";
      const box = Object.assign(el("input"), { type: "checkbox" });
      gate.append(box, el("span", "", "I reviewed all AI-written sections and have permission for every quote and image."));
      box.addEventListener("change", async () => {
        if (!box.checked) return;
        const res = await post("/epk/ai/review", { all: true, confirmed: true });
        if (res.ok) { document.querySelectorAll(".epk-ai-mark").forEach(node => node.remove()); gate.remove(); }
        else box.checked = false;
      });
      actionsRow.before(gate);
    }
  }

  // ---------- start ----------
  async function load() {
    const res = await call("/epk/ai");
    if (!res.ok) return; // signed out or offline: the builder works by hand as before
    offer = res.data;
    mountChoice(); renderChoice();
    const params = new URLSearchParams(location.search), paid = params.get("ai-epk") === "paid";
    if (paid) { try { history.replaceState(history.state, "", location.pathname); } catch {} }
    const job = offer.job;
    if (job?.status === "draft_ready") {
      let applied = false; try { applied = localStorage.getItem(`danzstak_ai_epk_applied_${job.id}`) === "1"; } catch {}
      if (!applied) openSheet("build");
      else setTimeout(() => { if (offer.review?.pending?.length) markSections(offer.review.pending, job.draft); mountRewriteButtons(); }, 600); // after epk.js fills the form
    } else if (job && job.status !== "failed") openSheet("build");
    else if (paid && offer.available) {
      // Back from Stripe: the webhook may take a moment to grant the build.
      openSheet("build");
      const redesign = params.get("kind") === "redesign", ready = () => redesign ? offer.redesignCredits > 0 : offer.credits > 0;
      for (let tries = 0; tries < 10 && !ready(); tries++) { await new Promise(r => setTimeout(r, 1500)); const again = await call("/epk/ai"); if (again.ok) offer = again.data; }
      if (ready()) startBuild(null, null, redesign ? "redesign" : "build"); else body("Payment received", note("We're still waiting for Stripe to confirm. This page will be ready in a minute — reopen Let AI build it."));
    }
  }
  window.danzstakEpkAi = { applyDraft, setField, markSections, mountRewriteButtons };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true }); else load();
})();
