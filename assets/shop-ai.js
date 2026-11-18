"use strict";
// "Draft it with AI" in My Shop (task 19, queue 5b2; server in ai-shop.mjs). $6.30 once covers the shop setup and
// 10 listing drafts; the price shows only until bought. One row on the shop form (name and about) and one on the
// product form (title, description, condition from a photo and notes). Drafts fill the forms; the seller checks
// every word, sets the price and saves. Nothing is saved or published here. Sheet styles are shared (epk-ai.css).
(() => {
  if (new URLSearchParams(location.search).get("manage") !== "1") return;
  const api = "https://api.danzstak.com", byId = id => document.getElementById(id);
  const t = value => window.danzstakTranslate?.(value) || value;
  const money = cents => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
  const el = (tag, className = "", textValue = "") => { const node = document.createElement(tag); if (className) node.className = className; if (textValue) node.textContent = t(textValue); return node; };
  const button = (label, kind = "primary", type = "button") => { const node = el("button", `ds-btn-${kind}`, label); node.type = type; return node; };
  const SPARKLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8zM18 13l1 2.8 2.8 1.2-2.8 1-1 3-1-3-2.8-1 2.8-1.2z"/></svg>';
  const KINDS = [["records", "Records"], ["merch", "Band merch"], ["crafts", "Crafts"], ["gear", "Gear"], ["art", "Art and prints"], ["other", "Something else"]];
  let state = null, sheet = null, pushed = false;

  async function call(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch(`${api}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal, ...options, headers: options.body ? { "content-type": "application/json" } : undefined });
      return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
    } catch { return { ok: false, status: 0, data: { error: "You're offline or the connection dropped. Try again." } }; } finally { clearTimeout(timer); }
  }
  const post = (path, body = {}) => call(path, { method: "POST", body: JSON.stringify(body) });

  // ---------- the two rows ----------
  function row(id, form, mode) {
    if (!form || byId(id)) return;
    const node = button("", "tonal"); node.id = id; node.className = "ds-btn-tonal profile-ai-row shop-ai-row"; node.dataset.mode = mode;
    node.innerHTML = `${SPARKLE}<span class="profile-ai-label"></span><span class="profile-ai-price"></span>`;
    node.addEventListener("click", () => openSheet(!state?.owned ? "start" : mode === "listing" && state.listingsLeft < 1 ? "start" : mode));
    const status = el("p", "profile-ai-status"); status.id = `${id}Status`; status.hidden = true; status.setAttribute("role", "status");
    form.prepend(node, status);
  }
  function render() {
    for (const [id, label] of [["shopAiSetup", "Draft it with AI"], ["shopAiListing", "Draft this listing with AI"]]) {
      const node = byId(id); if (!node || !state) continue;
      const name = node.querySelector(".profile-ai-label"), price = node.querySelector(".profile-ai-price");
      node.disabled = !state.available;
      name.textContent = t(state.available ? label : "AI coming soon");
      // The price only until bought; then the listing row shows how many AI listings are left.
      price.textContent = !state.available ? "" : !state.owned ? money(state.totalCents) : id === "shopAiListing" ? `${state.listingsLeft} ${t("left")}` : "";
      node.setAttribute("aria-label", [name.textContent, price.textContent].filter(Boolean).join(", "));
    }
  }
  async function load() {
    const res = await call("/shop/ai");
    if (!res.ok) return false;
    state = res.data; render(); return true;
  }

  // ---------- the sheet ----------
  function openSheet(screen) {
    if (!state?.available) return;
    if (!sheet) {
      sheet = el("dialog", "epk-ai-sheet shop-ai-sheet"); sheet.setAttribute("aria-labelledby", "shopAiTitle");
      const head = el("div", "epk-ai-head"), title = el("h2", "", "Draft it with AI"); title.id = "shopAiTitle";
      const close = button("", "icon"); close.className = "ds-btn-icon epk-ai-close"; close.setAttribute("aria-label", t("Close"));
      close.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7l1.4-1.4L12 10.6l6.3-6.3z"/></svg>';
      close.addEventListener("click", () => closeSheet(false));
      head.append(title, close); sheet.append(head, el("div", "epk-ai-body"));
      sheet.addEventListener("cancel", event => { event.preventDefault(); closeSheet(false); });
      document.body.append(sheet);
      window.addEventListener("popstate", () => { if (sheet.open) closeSheet(true); });
    }
    if (!sheet.open) { sheet.showModal(); try { history.pushState({ shopAiSheet: true }, ""); pushed = true; } catch { pushed = false; } }
    ({ start: screenStart, pay: screenPay, setup: screenSetup, listing: screenListing })[screen]?.();
  }
  function closeSheet(fromHistory) {
    if (!sheet?.open) return;
    sheet.close();
    if (!fromHistory && pushed) history.back();
    pushed = false;
  }
  function body(titleText, ...nodes) {
    const box = sheet.querySelector(".epk-ai-body"); box.replaceChildren();
    sheet.querySelector("#shopAiTitle").textContent = t(titleText);
    box.append(...nodes.filter(Boolean)); box.scrollTop = 0;
  }
  const note = (value, className = "epk-ai-note") => el("p", className, value);
  const statusLine = () => { const p = el("p", "epk-ai-status"); p.setAttribute("role", "status"); p.setAttribute("aria-live", "polite"); return p; };
  const actions = (...buttons) => { const r = el("div", "epk-ai-actions"); r.append(...buttons); return r; };
  const field = (labelText, input) => { const label = el("label", "", labelText); label.append(input); return label; };

  function screenStart() {
    const list = el("ul", "epk-ai-included");
    for (const item of ["Your shop name and about, with a shipping and returns line", "Up to 10 listing drafts from your photos", "You check every word, set the price and save it yourself"]) list.append(el("li", "", item));
    const price = el("p", "epk-ai-total", money(state.totalCents));
    price.append(el("small", "", ` (${money(state.priceCents)} + ${money(state.feeCents)} ${t("fee")})`));
    const go = button("Continue"); go.addEventListener("click", screenPay);
    body(state.owned ? "10 more AI listings" : "Draft it with AI", list, price, note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee."), note(state.disclaimer, "epk-ai-disclaimer"), actions(go));
    go.focus();
  }
  function screenPay() {
    const bill = el("dl", "epk-ai-bill");
    for (const [label, cents] of [["AI shop", state.priceCents], ["DanzStak fee", state.feeCents], ["Total", state.totalCents]]) bill.append(el("dt", "", label), Object.assign(el("dd"), { textContent: money(cents) }));
    const status = statusLine(), pay = button(`${t("Pay")} ${money(state.totalCents)}`);
    pay.addEventListener("click", async () => {
      pay.disabled = true; status.textContent = t("Opening secure checkout…");
      const res = await post("/tour-manager/ai-epk/checkout", { kind: "shop" });
      if (res.ok && /^https:\/\/checkout\.stripe\.com\//.test(res.data.checkoutUrl || "")) { location.assign(res.data.checkoutUrl); return; }
      pay.disabled = false; status.textContent = t(res.data.error || "Checkout couldn't start. Try again.");
    });
    body("Pay for the AI shop", bill, note("No refund once a draft is made. If you don't use it, the refund is the price minus Stripe's fee."), note(state.disclaimer, "epk-ai-disclaimer"), status, actions(pay));
  }

  // Shop setup: a few quick questions -> name and about.
  function screenSetup() {
    const form = el("form", "epk-ai-form"), kind = el("select"); kind.name = "kind";
    for (const [value, label] of KINDS) kind.append(Object.assign(el("option", "", label), { value }));
    const shopName = Object.assign(el("input"), { name: "shopName", maxLength: 60, value: byId("shopName")?.value || "" });
    const about = Object.assign(el("input"), { name: "about", maxLength: 300, value: "" });
    const city = Object.assign(el("input"), { name: "city", maxLength: 80 });
    const shipping = Object.assign(el("input"), { name: "shipping", maxLength: 200, placeholder: t("e.g. ships in 3 days, returns if damaged") });
    const status = statusLine(), go = button("Draft it with AI", "primary", "submit");
    form.append(field("What do you sell?", kind), field("Shop name (if you have one)", shopName), field("One line about your shop", about), field("City", city), field("Shipping and returns", shipping),
      note("Your answers are sent to our AI provider to write the draft. They are never used to train AI."), status, actions(go));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const answers = { kind: kind.value, shopName: shopName.value.trim(), about: about.value.trim(), city: city.value.trim(), shipping: shipping.value.trim() };
      if (!answers.about && !answers.shopName) { status.textContent = t("Tell us what you sell, or your shop's name."); about.focus(); return; }
      go.disabled = true; status.textContent = t("Writing your shop…");
      const res = await post("/shop/ai/setup", { answers });
      go.disabled = false;
      if (res.status === 402) return screenStart();
      if (!res.ok) { status.textContent = t(res.data.error || "Something went wrong. Try again."); return; }
      const d = res.data.draft, list = el("dl", "profile-ai-draft");
      list.append(el("dt", "", "Shop name"), Object.assign(el("dd"), { textContent: d.name }), el("dt", "", "About your shop"), Object.assign(el("dd"), { textContent: d.about }));
      const use = button("Use this"), again = button("Redraft", "text");
      again.addEventListener("click", screenSetup);
      use.addEventListener("click", () => { fill({ shopName: d.name, shopDescription: d.about }, "shopAiSetupStatus"); closeSheet(false); });
      body("Your AI draft", note("Check every word. Nothing is saved until you tap Save shop."), note(state.disclaimer, "epk-ai-disclaimer"), list, actions(again, use));
      use.focus();
    });
    body("A few quick questions", form);
    kind.focus();
  }

  // A listing from a photo (picked on the phone, or the listing's own image link) and notes.
  function screenListing() {
    const form = el("form", "epk-ai-form"), picked = { image: null };
    const photo = Object.assign(el("input"), { type: "file", accept: "image/*" }); photo.setAttribute("aria-label", t("Pick a photo of the item"));
    const pick = button("Pick a photo", "tonal"), preview = el("img", "shop-ai-preview"); preview.alt = ""; preview.hidden = true;
    photo.hidden = true; pick.addEventListener("click", () => photo.click());
    const link = (byId("productImage")?.value || "").trim(), useLink = /^https:\/\//i.test(link);
    const notes = Object.assign(el("input"), { name: "notes", maxLength: 300, placeholder: t("Anything the photo can't show: size, pressing, year…") });
    const status = statusLine(), left = note(`${state.listingsLeft} ${t(state.listingsLeft === 1 ? "AI listing left" : "AI listings left")}`), go = button("Draft it with AI", "primary", "submit");
    photo.addEventListener("change", async () => {
      const file = photo.files?.[0]; if (!file) return;
      status.textContent = t("Getting the photo ready…");
      try { picked.image = await shrink(file); preview.src = `data:${picked.image.mediaType};base64,${picked.image.data}`; preview.hidden = false; status.textContent = ""; }
      catch { picked.image = null; status.textContent = t("That photo couldn't be read. Try another one."); }
    });
    form.append(...[pick, photo, preview, useLink ? note("Or leave it: the AI looks at the image link already in your listing.") : null, field("Notes (optional)", notes),
      note("The photo is sent to our AI provider only to write this listing. DanzStak doesn't keep it, and it's never used to train AI."), left, status, actions(go)].filter(Boolean));
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const payload = { notes: notes.value.trim() };
      if (picked.image) payload.image = picked.image; else if (useLink) payload.imageUrl = link;
      if (!payload.image && !payload.imageUrl && !payload.notes) { status.textContent = t("Add a photo or a few words about the item."); return; }
      go.disabled = true; status.textContent = t("Writing your listing…");
      const res = await post("/shop/ai/listing", payload);
      go.disabled = false;
      if (res.status === 402) { state.listingsLeft = 0; render(); return screenStart(); }
      if (!res.ok) { status.textContent = t(res.data.error || "Something went wrong. Try again."); return; }
      state.listingsLeft = res.data.listingsLeft; render();
      const d = res.data.draft, list = el("dl", "profile-ai-draft");
      for (const [label, value] of [["Title", d.title], ["Condition", t(d.condition)], ["Description", d.description]]) list.append(el("dt", "", label), Object.assign(el("dd"), { textContent: value }));
      const use = button("Use this"), again = button("Draft another", "text");
      again.addEventListener("click", screenListing);
      use.addEventListener("click", () => {
        const condition = d.condition && d.condition !== "Not sure" ? `${t("Condition")}: ${t(d.condition)}.\n\n` : "";
        fill({ productTitle: d.title, productDescription: condition + d.description }, "shopAiListingStatus");
        closeSheet(false); byId("productPrice")?.focus();
      });
      body("Your AI draft", note("Check every word and set your price. Nothing is saved until you tap Save product."), note(state.disclaimer, "epk-ai-disclaimer"), list, actions(again, use));
      use.focus();
    });
    body("Draft this listing with AI", form);
  }
  // Shrink a photo in the browser (longest side 1024 px, JPEG) before it is sent.
  // createImageBitmap needs no URL (the page's CSP allows only data: and https: images, not blob:); data: is the fallback.
  async function shrink(file) {
    let img;
    try { img = await createImageBitmap(file); }
    catch {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = dataUrl; });
    }
    const width = img.width || img.naturalWidth, height = img.height || img.naturalHeight;
    const scale = Math.min(1, 1024 / Math.max(width, height)), canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close?.();
    return { mediaType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.82).split(",")[1] };
  }
  function fill(values, statusId) {
    for (const [id, value] of Object.entries(values)) { const input = byId(id); if (input && value) { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); } }
    const status = byId(statusId); if (status) { status.hidden = false; status.textContent = t("AI draft filled in. Check every word, then save."); }
  }

  // ---------- start ----------
  async function start() {
    const mount = () => { row("shopAiSetup", byId("shopForm"), "setup"); row("shopAiListing", byId("productForm"), "listing"); render(); };
    mount();
    if (!await load()) return;
    const params = new URLSearchParams(location.search);
    if (params.get("ai-shop") === "paid") {
      // Back from Stripe: wait for the webhook, then start with the shop setup.
      try { const url = new URL(location.href); url.searchParams.delete("ai-shop"); history.replaceState(history.state, "", url.pathname + url.search); } catch {}
      for (let tries = 0; tries < 12 && !state.owned; tries++) { await new Promise(r => setTimeout(r, 1500)); await load(); }
      if (state.owned) openSheet("setup");
    }
  }
  window.danzstakShopAi = { fill };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
