"use strict";
// "Write it with AI" on Edit profile (task 19, queue 5b2; server in ai-profile.mjs). A single row under the title;
// the price ($6.30) shows only until bought. A few quick questions draft the bio, the "More profile details"
// fields and @username ideas; "Use this" fills the editor and the member checks every word and saves it themselves.
// Nothing is saved or published here. Without the key: "AI coming soon". Shares the sheet styles in epk-ai.css.
(() => {
  const api = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const money = cents => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  const el = (tag, className = "", textValue = "") => { const node = document.createElement(tag); if (className) node.className = className; if (textValue) node.textContent = t(textValue); return node; };
  const button = (label, kind = "primary", type = "button") => { const node = el("button", `ds-btn-${kind}`, label); node.type = type; return node; };
  const ROLES = [["band", "I play in a band"], ["dj", "DJ"], ["solo", "Solo artist"], ["producer", "Producer"], ["fan", "Music fan"], ["promoter", "Promoter"], ["record-shop", "Record shop"], ["venue", "Venue"], ["crew", "Stage or production crew"]];
  const SPARKLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8zM18 13l1 2.8 2.8 1.2-2.8 1-1 3-1-3-2.8-1 2.8-1.2z"/></svg>';
  let state = null, sheet = null, pushed = false, lastDraft = null;

  async function call(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${api}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal, ...options, headers: options.body ? { "content-type": "application/json" } : undefined });
      return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
    } catch { return { ok: false, status: 0, data: { error: "You're offline or the connection dropped. Try again." } }; } finally { clearTimeout(timer); }
  }
  const post = (path, body = {}) => call(path, { method: "POST", body: JSON.stringify(body) });
  const panel = () => document.querySelector(".edit-profile-panel");

  // ---------- the row under "Edit your profile" ----------
  function mountRow() {
    const form = panel(); if (!form || form.querySelector("#profileAiRow")) return;
    const row = button("", "tonal"); row.id = "profileAiRow"; row.className = "ds-btn-tonal profile-ai-row";
    row.innerHTML = `${SPARKLE}<span class="profile-ai-label"></span><span class="profile-ai-price"></span>`;
    row.addEventListener("click", () => openSheet(state?.owned ? "ask" : "start"));
    const status = el("p", "profile-ai-status"); status.id = "profileAiStatus"; status.setAttribute("role", "status"); status.hidden = true;
    form.querySelector("h2")?.after(row, status);
    renderRow();
  }
  function renderRow() {
    const row = document.getElementById("profileAiRow"); if (!row || !state) return;
    const label = row.querySelector(".profile-ai-label"), price = row.querySelector(".profile-ai-price");
    row.disabled = !state.available;
    label.textContent = t(state.available ? "Write it with AI" : "AI coming soon");
    price.textContent = state.available && !state.owned ? money(state.totalCents) : "";
    row.setAttribute("aria-label", [label.textContent, price.textContent].filter(Boolean).join(", "));
  }
  async function loadState() {
    const res = await call("/profile/ai");
    if (!res.ok) return false;
    state = res.data; renderRow(); return true;
  }

  // ---------- the sheet ----------
  function openSheet(screen) {
    if (!state?.available) return;
    if (!sheet) {
      sheet = el("dialog", "epk-ai-sheet profile-ai-sheet"); sheet.setAttribute("aria-labelledby", "profileAiTitle");
      const head = el("div", "epk-ai-head"), title = el("h2", "", "Write it with AI"); title.id = "profileAiTitle";
      const close = button("", "icon"); close.className = "ds-btn-icon epk-ai-close"; close.setAttribute("aria-label", t("Close"));
      close.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z"/></svg>';
      close.addEventListener("click", () => closeSheet(false));
      head.append(title, close); sheet.append(head, el("div", "epk-ai-body"));
      sheet.addEventListener("cancel", event => { event.preventDefault(); closeSheet(false); });
      document.body.append(sheet);
      window.addEventListener("popstate", () => { if (sheet.open) closeSheet(true); });
    }
    if (!sheet.open) {
      sheet.showModal();
      // Device Back closes the sheet and stays on Edit profile.
      try { history.pushState({ profileAiSheet: true }, ""); pushed = true; } catch { pushed = false; }
    }
    ({ start: screenStart, pay: screenPay, ask: screenAsk, result: screenResult })[screen]?.();
  }
  function closeSheet(fromHistory) {
    if (!sheet?.open) return;
    sheet.close();
    if (!fromHistory && pushed) history.back();
    pushed = false;
    document.getElementById("profileAiRow")?.focus();
  }
  function body(titleText, ...nodes) {
    const box = sheet.querySelector(".epk-ai-body"); box.replaceChildren();
    sheet.querySelector("#profileAiTitle").textContent = t(titleText);
    box.append(...nodes.filter(Boolean)); box.scrollTop = 0;
  }
  const note = (value, className = "epk-ai-note") => el("p", className, value);
  const statusLine = () => { const p = el("p", "epk-ai-status"); p.setAttribute("role", "status"); p.setAttribute("aria-live", "polite"); return p; };
  const actions = (...buttons) => { const row = el("div", "epk-ai-actions"); row.append(...buttons); return row; };
  const refundRule = () => note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee.");

  function screenStart() {
    const list = el("ul", "epk-ai-included");
    for (const item of ["A bio, profile details and @username ideas from your answers and your EPK", "Redraft as often as you like, up to 5 a day", "You check every word and save it yourself"]) list.append(el("li", "", item));
    const price = el("p", "epk-ai-total", money(state.totalCents));
    price.append(el("small", "", ` (${money(state.priceCents)} + ${money(state.feeCents)} ${t("fee")})`));
    const go = button("Continue"); go.addEventListener("click", screenPay);
    body("Write it with AI", list, price, refundRule(), note(state.disclaimer, "epk-ai-disclaimer"), actions(go));
    go.focus();
  }
  function screenPay() {
    const bill = el("dl", "epk-ai-bill");
    for (const [label, cents] of [["AI profile", state.priceCents], ["DanzStak fee", state.feeCents], ["Total", state.totalCents]]) bill.append(el("dt", "", label), Object.assign(el("dd"), { textContent: money(cents) }));
    const status = statusLine(), pay = button(`${t("Pay")} ${money(state.totalCents)}`);
    pay.addEventListener("click", async () => {
      pay.disabled = true; status.textContent = t("Opening secure checkout…");
      const res = await post("/tour-manager/ai-epk/checkout", { kind: "profile" });
      if (res.ok && /^https:\/\/checkout\.stripe\.com\//.test(res.data.checkoutUrl || "")) { location.assign(res.data.checkoutUrl); return; }
      pay.disabled = false; status.textContent = t(res.data.error || "Checkout couldn't start. Try again.");
    });
    body("Pay for Write it with AI", bill, refundRule(), note(state.disclaimer, "epk-ai-disclaimer"), status, actions(pay));
  }

  // A few quick questions (spec: what you do, scene/genres, city, one line about you, links).
  function screenAsk() {
    const form = el("form", "epk-ai-form"), editor = panel();
    const field = (labelText, input) => { const label = el("label", "", labelText); label.append(input); return label; };
    const role = el("select"); role.name = "role";
    role.append(Object.assign(el("option", "", "Choose one"), { value: "" }));
    for (const [value, label] of ROLES) role.append(Object.assign(el("option", "", label), { value }));
    const genres = Object.assign(el("input"), { name: "genres", maxLength: 120, placeholder: t("punk, metal, techno…") });
    const city = Object.assign(el("input"), { name: "city", maxLength: 80, value: editor?.elements.location?.value || "" });
    const oneLine = Object.assign(el("input"), { name: "oneLine", maxLength: 200 });
    const links = Object.assign(el("textarea"), { name: "links", rows: 3, value: editor?.elements.website?.value ? (window.danzstakNormalizeUserUrl?.(editor.elements.website.value) || "") : "", placeholder: "https://" });
    const status = statusLine(), go = button("Draft it with AI", "primary", "submit");
    const left = note(`${state.draftsLeftToday} ${t(state.draftsLeftToday === 1 ? "draft left today" : "drafts left today")}`);
    form.append(field("What do you do?", role), field("Scene or genres", genres), field("City", city), field("One line about you", oneLine), field("Your links (one per line)", links),
      note("Your answers and your EPK text are sent to our AI provider to write the draft. They are never used to train AI."), left, status, actions(go));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const answers = { role: role.value, genres: genres.value.trim(), city: city.value.trim(), oneLine: oneLine.value.trim(), links: links.value.split(/\s+/).filter(Boolean) };
      if (!answers.role && !answers.oneLine) { status.textContent = t("Tell us what you do, or one line about you."); role.focus(); return; }
      go.disabled = true; status.textContent = t("Writing your profile…");
      const res = await post("/profile/ai/draft", { answers });
      go.disabled = false;
      if (res.status === 402) { state.owned = false; renderRow(); return screenStart(); }
      if (!res.ok) { status.textContent = t(res.data.error || "Something went wrong. Try again."); if (Number.isInteger(res.data.draftsLeftToday)) state.draftsLeftToday = res.data.draftsLeftToday; return; }
      lastDraft = res.data.draft; state.draftsLeftToday = res.data.draftsLeftToday;
      screenResult();
    });
    body("A few quick questions", form);
    role.focus();
  }

  function screenResult() {
    const d = lastDraft, list = el("dl", "profile-ai-draft");
    for (const [label, value] of [["Bio", d.bio], ["Location", d.location], ["Work", d.work], ["Website", d.website]]) if (value) list.append(el("dt", "", label), Object.assign(el("dd"), { textContent: value }));
    const handles = el("div", "epk-ai-chips"); let picked = "";
    if (d.handles.length) {
      list.append(el("dt", "", "@username ideas"), Object.assign(el("dd"), {}));
      for (const handle of d.handles) {
        const chip = button(`@${handle}`, "tonal"); chip.setAttribute("aria-pressed", "false");
        chip.addEventListener("click", () => { picked = picked === handle ? "" : handle; handles.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent === `@${picked}`))); });
        handles.append(chip);
      }
      list.lastChild.append(handles);
    }
    const use = button("Use this"), again = button("Redraft", "text");
    again.disabled = state.draftsLeftToday < 1;
    again.addEventListener("click", screenAsk);
    use.addEventListener("click", () => { fill(d, picked); closeSheet(false); });
    body("Your AI draft", note("Check every word. Nothing is saved until you tap Save."), note(state.disclaimer, "epk-ai-disclaimer"), list, actions(again, use));
    use.focus();
  }

  // Fill the editor; the member reviews and saves (never auto-saved).
  function fill(d, handle) {
    const form = panel(); if (!form) return;
    const set = (name, value) => { if (value && form.elements[name]) { form.elements[name].value = value; form.elements[name].dispatchEvent(new Event("input", { bubbles: true })); } };
    set("bio", d.bio); set("location", d.location); set("work", d.work); set("website", d.website);
    if (handle) { set("handle", handle); form.querySelector(".profile-username")?.setAttribute("open", ""); }
    form.elements.bio?.closest("details")?.setAttribute("open", "");
    const status = document.getElementById("profileAiStatus");
    if (status) { status.hidden = false; status.textContent = t("AI draft filled in. Check every word, then Save."); }
    form.elements.bio?.focus();
  }

  // ---------- start ----------
  function watchPanel() {
    const form = panel(); if (!form) return false;
    const opened = async () => { if (form.hidden) return; mountRow(); if (!state) await loadState(); };
    new MutationObserver(opened).observe(form, { attributes: true, attributeFilter: ["hidden"] });
    opened();
    return true;
  }
  async function start() {
    if (!watchPanel()) { const wait = new MutationObserver(() => { if (watchPanel()) wait.disconnect(); }); wait.observe(document.body, { childList: true, subtree: true }); setTimeout(() => wait.disconnect(), 10000); }
    const params = new URLSearchParams(location.search);
    if (params.get("ai-profile") === "paid") {
      // Back from Stripe: open Edit profile and the questions once the webhook has granted it.
      try { history.replaceState(history.state, "", location.pathname); } catch {}
      for (let tries = 0; tries < 12; tries++) { if (await loadState() && state.owned) break; await new Promise(r => setTimeout(r, 1500)); }
      document.querySelector('button[data-icon="edit"]')?.click();
      setTimeout(() => { mountRow(); if (state?.owned) openSheet("ask"); }, 300);
    }
  }
  window.danzstakProfileAi = { fill };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
