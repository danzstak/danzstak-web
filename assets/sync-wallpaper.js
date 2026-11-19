"use strict";
// SYNC chat wallpaper (task 16-B, owner 2026-11-17: "change their background … girlfriend or whatever").
// Two places to set it: all chats (SYNC settings) or one chat (the chat's ⋮ menu). A per-chat choice wins over the
// all-chats one; "Reset to default" is one tap. Choices: your own photo (camera roll or camera), original DanzStak
// wallpapers drawn in CSS (one per genre look plus stage/vinyl), solid colors, or the default SYNC paper.
// Privacy: the photo never leaves this device. It is decoded and re-drawn on a canvas (which drops EXIF/GPS), resized to
// the screen, stored in this browser's IndexedDB and shown only to its owner; the other person never sees it. Logging out
// deletes it (session-cleanup.js). Images only, max 4 MB in. A dim layer (0-60%) keeps the date/system chips readable;
// bubbles are opaque so their text contrast never depends on the wallpaper.
(() => {
  const DB = "danzstak-sync-wallpaper", STORE = "choices", MAX_BYTES = 4 * 1024 * 1024, MAX_DIM = 60;
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const t = value => window.danzstakTranslate?.(value) || value;
  // Original DanzStak wallpapers: pure CSS, no image files. Each has a light and a dark look.
  const PRESETS = {
    techno: { name: "Techno", color: "#0b0b0c", image: "repeating-linear-gradient(135deg,rgba(255,90,31,.22) 0 2px,transparent 2px 26px),linear-gradient(180deg,#0b0b0c,#18181b)" },
    punk: { name: "Punk", color: "#efe8da", image: "repeating-linear-gradient(0deg,transparent 0 46px,rgba(18,17,16,.16) 46px 47px),repeating-linear-gradient(90deg,rgba(229,69,46,.10) 0 6px,transparent 6px 14px)", dark: "repeating-linear-gradient(0deg,transparent 0 46px,rgba(239,232,218,.12) 46px 47px),linear-gradient(#1c1a17,#121110)" },
    metal: { name: "Metal", color: "#0e0d0d", image: "radial-gradient(ellipse at 50% 0%,rgba(158,27,27,.55),transparent 62%),radial-gradient(ellipse at 50% 100%,rgba(230,222,203,.10),transparent 55%)" },
    house: { name: "House", color: "#0f2e26", image: "radial-gradient(circle at 78% 18%,rgba(255,201,60,.55) 0 14%,transparent 15%),radial-gradient(circle at 18% 86%,rgba(255,111,168,.28) 0 22%,transparent 23%)" },
    stage: { name: "Stage lights", color: "#120f1a", image: "conic-gradient(from 160deg at 30% -10%,transparent 0 8deg,rgba(255,236,200,.18) 8deg 18deg,transparent 18deg 360deg),conic-gradient(from 175deg at 72% -10%,transparent 0 6deg,rgba(255,90,31,.20) 6deg 15deg,transparent 15deg 360deg)" },
    vinyl: { name: "Vinyl", color: "#151517", image: "radial-gradient(circle at 50% 50%,#2b2b30 0 7%,transparent 7.2%),repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.05) 0 1px,transparent 1px 5px)" }
  };
  const COLORS = ["#0b0b0c", "#1f2937", "#0f2e26", "#3b1d5a", "#7a1f1f", "#efe8da", "#dce7f1", "#ffe7d6"];
  const DEFAULT = { kind: "default", dim: 0 };
  const urls = new WeakMap(); // one object URL per painted element, revoked when it changes
  let dbPromise = null, activeKey = "", dialog = null, editing = null, editingKey = "global";

  const openDb = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("no IndexedDB")); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
  async function tx(mode, run) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode), store = transaction.objectStore(STORE);
      const request = run(store);
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  const read = key => tx("readonly", store => store.get(key)).catch(() => undefined);
  const write = (key, value) => tx("readwrite", store => store.put(value, key));
  const remove = key => tx("readwrite", store => store.delete(key)).catch(() => undefined);

  // Chats are keyed by a hash of the contact, so the wallpaper store never holds the contact's address.
  async function chatKey(contact) {
    const value = String(contact || "").trim().toLowerCase();
    if (!value) return "";
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("danzstak-sync-wallpaper:" + value));
      return "chat:" + [...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { return "chat:" + value.replace(/[^a-z0-9]/g, "").slice(0, 48); }
  }
  const clampDim = value => Math.max(0, Math.min(MAX_DIM, Math.round(Number(value) || 0)));
  const isDark = () => document.documentElement.classList.contains("dark-mode");

  function css(choice, target) {
    const dim = clampDim(choice?.dim) / 100;
    if (!choice || choice.kind === "default") return null;
    if (choice.kind === "color" && /^#[0-9a-f]{6}$/i.test(choice.color || "")) return { color: choice.color, image: "none", dim };
    if (choice.kind === "preset" && PRESETS[choice.preset]) { const p = PRESETS[choice.preset]; return { color: p.color, image: (isDark() && p.dark) || p.image, dim }; }
    if (choice.kind === "photo" && choice.blob instanceof Blob) {
      const previous = urls.get(target);
      if (previous?.blob === choice.blob) return { color: "#111", image: `url("${previous.url}")`, dim, photo: true };
      if (previous) URL.revokeObjectURL(previous.url);
      const url = URL.createObjectURL(choice.blob);
      urls.set(target, { blob: choice.blob, url });
      return { color: "#111", image: `url("${url}")`, dim, photo: true };
    }
    return null;
  }

  function paint(target, choice) {
    if (!target) return;
    const look = css(choice, target);
    if (!look?.photo && urls.has(target)) { URL.revokeObjectURL(urls.get(target).url); urls.delete(target); }
    if (!look) { delete target.dataset.wallpaper; for (const name of ["--sync-wp-image", "--sync-wp-color", "--sync-wp-dim"]) target.style.removeProperty(name); return; }
    target.dataset.wallpaper = look.photo ? "photo" : choice.kind;
    target.style.setProperty("--sync-wp-image", look.image);
    target.style.setProperty("--sync-wp-color", look.color);
    target.style.setProperty("--sync-wp-dim", String(look.dim));
  }

  // The thread shows the per-chat choice when there is one, else the all-chats choice, else the default.
  async function resolveFor(contact) {
    const key = await chatKey(contact);
    return (key && await read(key)) || await read("global") || DEFAULT;
  }
  async function applyCurrent() {
    const contact = document.getElementById("contactEmail")?.value || "";
    activeKey = await chatKey(contact);
    paint(document.getElementById("messageList"), await resolveFor(contact));
  }

  // Re-encode on a canvas: drops EXIF/GPS and any other metadata, and resizes to the device's screen.
  async function cleanPhoto(file) {
    if (!file || !IMAGE_TYPES.includes(file.type)) throw new Error(t("Choose a photo (JPEG, PNG, WebP or GIF)."));
    if (file.size > MAX_BYTES) throw new Error(t("That photo is over 4 MB. Choose a smaller one."));
    const bitmap = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("decode")); img.src = URL.createObjectURL(file); }));
    const dpr = Math.min(window.devicePixelRatio || 1, 3), longest = Math.min(2400, Math.round(Math.max(screen.width || 430, screen.height || 932) * dpr));
    const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error(t("That photo could not be read. Try another."));
    return blob;
  }

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "call-setup-dialog sync-wallpaper-dialog";
    dialog.setAttribute("aria-labelledby", "syncWallpaperTitle");
    const presetTiles = Object.entries(PRESETS).map(([id, p]) => `<button type="button" class="sync-wp-tile" data-preset="${id}" aria-label="${p.name}"><span></span><small data-t="${p.name}"></small></button>`).join("");
    const colorTiles = COLORS.map(color => `<button type="button" class="sync-wp-swatch" data-color="${color}"></button>`).join("");
    dialog.innerHTML = '<header><div><p class="phone-setup-count" data-scope></p><h2 id="syncWallpaperTitle" data-t="Chat wallpaper"></h2></div><button type="button" class="call-setup-close" data-icon="close" data-close></button></header>'
      + '<div class="sync-wp-preview message-list" aria-hidden="true"><p class="system-message" data-t="Today"></p><div class="message"><span data-t="Load-in at 6, doors at 8."></span></div><div class="message mine"><span data-t="See you at soundcheck."></span></div></div>'
      + '<div class="sync-wp-row"><label class="sync-wp-photo"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-photo><span data-menu-icon="image" aria-hidden="true"></span><span data-t="Your photo"></span></label>'
      + '<label class="sync-wp-photo"><input type="file" accept="image/*" capture="environment" data-camera><span data-menu-icon="camera" aria-hidden="true"></span><span data-t="Camera"></span></label>'
      + '<button type="button" class="sync-wp-photo" data-default><span data-menu-icon="refresh" aria-hidden="true"></span><span data-t="Default"></span></button></div>'
      + `<p class="sync-wp-label" data-t="DanzStak wallpapers"></p><div class="sync-wp-grid">${presetTiles}</div>`
      + `<p class="sync-wp-label" data-t="Colors"></p><div class="sync-wp-swatches">${colorTiles}</div>`
      + '<label class="sync-wp-dim"><span><span data-t="Dim"></span> <output data-dim-out>0%</output></span><input type="range" min="0" max="60" step="5" value="0" data-dim></label>'
      + '<p class="sync-wp-note" data-t="Only you see your wallpaper. Your photo stays on this device and is never sent to the other person."></p>'
      + '<p class="phone-setup-status call-setup-status" role="status" data-status></p>'
      + '<div class="phone-setup-actions"><button type="button" class="secondary" data-reset data-t="Reset to default"></button><span></span><button type="button" class="primary" data-save data-t="Set wallpaper"></button></div>';
    // The page CSP blocks style="" attributes, so tiles are painted through the CSSOM.
    for (const tile of dialog.querySelectorAll("[data-preset]")) paint(tile.querySelector("span"), { kind: "preset", preset: tile.dataset.preset, dim: 0 });
    for (const swatch of dialog.querySelectorAll("[data-color]")) swatch.style.setProperty("background", swatch.dataset.color, "important");
    const status = dialog.querySelector("[data-status]");
    const preview = () => { paint(dialog.querySelector(".sync-wp-preview"), editing); dialog.querySelector("[data-dim-out]").textContent = clampDim(editing.dim) + "%"; markSelected(); };
    const pick = next => { editing = { ...next, dim: next.kind === "default" ? 0 : clampDim(!editing || editing.kind === "default" ? 20 : editing.dim) }; dialog.querySelector("[data-dim]").value = String(editing.dim); status.textContent = ""; preview(); };
    for (const input of dialog.querySelectorAll("[data-photo],[data-camera]")) input.addEventListener("change", async () => {
      const file = input.files?.[0]; input.value = "";
      if (!file) return;
      try { pick({ kind: "photo", blob: await cleanPhoto(file) }); } catch (error) { status.textContent = error.message; }
    });
    dialog.querySelector("[data-default]").addEventListener("click", () => pick(DEFAULT));
    for (const tile of dialog.querySelectorAll("[data-preset]")) tile.addEventListener("click", () => pick({ kind: "preset", preset: tile.dataset.preset }));
    for (const swatch of dialog.querySelectorAll("[data-color]")) swatch.addEventListener("click", () => pick({ kind: "color", color: swatch.dataset.color }));
    dialog.querySelector("[data-dim]").addEventListener("input", event => { editing = { ...editing, dim: clampDim(event.target.value) }; preview(); });
    dialog.querySelector("[data-reset]").addEventListener("click", async () => { await remove(editingKey); editing = { ...DEFAULT }; preview(); await applyCurrent(); status.textContent = t("Wallpaper reset to default."); });
    dialog.querySelector("[data-save]").addEventListener("click", async () => {
      try {
        if (editing.kind === "default") await remove(editingKey); else await write(editingKey, editing);
        await applyCurrent();
        dialog.close();
        window.dispatchEvent(new CustomEvent("danzstak:sync-wallpaper-saved", { detail: { scope: editingKey === "global" ? "all" : "chat" } }));
      } catch { status.textContent = t("This browser could not save the wallpaper. Private browsing can block it."); }
    });
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    window.danzstakIcons?.enhance?.(dialog);
  }
  function markSelected() {
    for (const el of dialog.querySelectorAll("[data-preset],[data-color],[data-default]")) {
      const on = (el.dataset.preset && editing.kind === "preset" && editing.preset === el.dataset.preset) || (el.dataset.color && editing.kind === "color" && editing.color === el.dataset.color) || (el.hasAttribute("data-default") && editing.kind === "default");
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  // scope: "all" (every chat) or "chat" (the open chat). Returns once the sheet is open.
  async function open(scope = "all") {
    if (!dialog) buildDialog();
    const contact = document.getElementById("contactEmail")?.value || "";
    editingKey = scope === "chat" && contact ? await chatKey(contact) : "global";
    editing = { ...((await read(editingKey)) || DEFAULT) };
    for (const el of dialog.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
    for (const el of dialog.querySelectorAll("[data-preset]")) el.setAttribute("aria-label", t(PRESETS[el.dataset.preset].name));
    for (const el of dialog.querySelectorAll("[data-color]")) el.setAttribute("aria-label", t("Color") + " " + el.dataset.color);
    dialog.querySelector("[data-close]").setAttribute("aria-label", t("Close"));
    dialog.querySelector("[data-scope]").textContent = editingKey === "global" ? t("All chats") : t("This chat: {name}").replace("{name}", window.danzstakActiveContactName || t("DanzStak member"));
    dialog.querySelector("[data-dim]").value = String(clampDim(editing.dim));
    dialog.querySelector("[data-status]").textContent = "";
    paint(dialog.querySelector(".sync-wp-preview"), editing);
    dialog.querySelector("[data-dim-out]").textContent = clampDim(editing.dim) + "%";
    markSelected();
    if (!dialog.open) dialog.showModal();
  }

  async function clearAll() {
    try { (await openDb()).close(); } catch {}
    dbPromise = null;
    await new Promise(resolve => { try { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); } catch { resolve(); } });
    paint(document.getElementById("messageList"), DEFAULT);
  }

  function addChatMenuItem() {
    const menu = document.getElementById("conversationMenu");
    if (!menu || menu.querySelector("#headerWallpaperMenu")) return;
    const item = document.createElement("button");
    item.type = "button"; item.id = "headerWallpaperMenu"; item.setAttribute("role", "menuitem"); item.dataset.icon = "image";
    item.textContent = t("Wallpaper");
    item.addEventListener("click", () => { menu.hidden = true; document.getElementById("conversationMore")?.setAttribute("aria-expanded", "false"); open("chat"); });
    menu.insertBefore(item, menu.querySelector("#headerDeleteChat"));
    window.danzstakIcons?.enhance?.(menu);
  }

  window.danzstakSyncSettings?.add({ id: "wallpaper", label: "Chat wallpaper", hint: "Your photo, DanzStak wallpapers or a color", icon: "image", order: 10, run: () => open("all") });
  window.addEventListener("danzstak:sync-conversation-opened", applyCurrent);
  document.addEventListener("DOMContentLoaded", () => { addChatMenuItem(); applyCurrent(); });
  if (document.readyState !== "loading") { addChatMenuItem(); applyCurrent(); }
  // Dark mode switches the preset variant.
  new MutationObserver(() => applyCurrent()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.danzstakSyncWallpaper = { open, apply: applyCurrent, clearAll, presets: Object.keys(PRESETS), colors: COLORS.slice(), _cleanPhoto: cleanPhoto };
})();
