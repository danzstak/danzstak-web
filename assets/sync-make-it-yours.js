"use strict";
// SYNC → Settings → Make it yours (task 16-H, part 1). Look (theme, accent, bubble style, text size), sound and feel
// (vibration pattern, quiet hours), hide message previews in notifications, and the 6 quick reactions. Every choice is
// previewed live, saved to the account (GET/POST /settings/sync-prefs) so every registered device follows it, cached on
// the device so it works offline, and has a Reset on its own line. No paid cosmetics, no streaks.
(() => {
  const API = "https://api.danzstak.com", CACHE = "danzstak_sync_prefs";
  const t = value => window.danzstakTranslate?.(value) || value;
  const DEFAULTS = { theme: "auto", accent: "orange", bubbles: "rounded", textSize: 1, vibration: "short", quietHours: { on: false, from: "23:00", to: "07:00", tz: "UTC", callsRing: true }, hidePreviews: false, reactions: ["👍", "❤️", "😂", "😮", "😢", "🤘"] };
  // Each accent: solid (send button) + text on it, and the light/dark tint for your own bubbles + their text. All ≥ 4.5:1.
  const ACCENTS = {
    orange: { name: "DanzStak orange", solid: "#c2410c", on: "#ffffff", tint: "#ffe8dc", ink: "#172033", darkTint: "#5a2410", darkInk: "#fff4ec" },
    techno: { name: "Techno", solid: "#ff5a1f", on: "#0b0b0c", tint: "#ffe3d6", ink: "#0b0b0c", darkTint: "#3a1a0d", darkInk: "#ededea" },
    punk: { name: "Punk", solid: "#b8321f", on: "#ffffff", tint: "#fde2dc", ink: "#121110", darkTint: "#4f1810", darkInk: "#efe8da" },
    metal: { name: "Metal", solid: "#9e1b1b", on: "#ffffff", tint: "#f6dada", ink: "#121010", darkTint: "#4a1010", darkInk: "#e6decb" },
    house: { name: "House", solid: "#ffc93c", on: "#0f2e26", tint: "#fff2cc", ink: "#0f2e26", darkTint: "#0f2e26", darkInk: "#fff4e0" }
  };
  const VIBRATION = { short: [200], long: [600, 200, 600], off: null };
  const clone = value => JSON.parse(JSON.stringify(value));
  let prefs = clone(DEFAULTS), saveTimer = null, dialog = null;
  try { prefs = { ...clone(DEFAULTS), ...JSON.parse(localStorage.getItem(CACHE) || "{}") }; prefs.quietHours = { ...DEFAULTS.quietHours, ...(prefs.quietHours || {}) }; } catch {}

  // Owner 2026-11-18: following the phone's dark setting ("auto") put the whole page in the retired site-wide dark mode and
  // jumbled the chat list (swipe actions showing, bottom tabs gone). DanzStak is light-only; SYNC goes dark only when the
  // member picks Dark in Make it yours.
  // Owner 2026-11-18: the dark look made typed text and names unreadable (light ink on white fields). DanzStak is
  // light-only until a dark SYNC theme is designed and contrast-tested on every screen, so a saved "dark" shows light.
  const darkWanted = () => false;
  function apply() {
    const root = document.documentElement, accent = ACCENTS[prefs.accent] || ACCENTS.orange, dark = darkWanted();
    root.dataset.syncAccent = prefs.accent;
    root.dataset.syncBubbles = prefs.bubbles;
    root.dataset.syncText = String(prefs.textSize);
    root.classList.toggle("dark-mode", dark);
    root.dataset.syncTheme = prefs.theme;
    root.style.setProperty("--sync-accent", accent.solid);
    root.style.setProperty("--sync-on-accent", accent.on);
    root.style.setProperty("--sync-mine-bg", dark ? accent.darkTint : accent.tint);
    root.style.setProperty("--sync-mine-ink", dark ? accent.darkInk : accent.ink);
  }
  function cache() { try { localStorage.setItem(CACHE, JSON.stringify(prefs)); } catch {} }
  function save() {
    cache(); apply();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const status = dialog?.querySelector("[data-status]");
      try {
        const r = await fetch(API + "/settings/sync-prefs", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefs }) });
        if (!r.ok) throw new Error();
        if (status) status.textContent = t("Saved to your account.");
      } catch { if (status) status.textContent = t("Saved on this device. It syncs to your account when you're back online."); }
    }, 400);
  }
  async function load() {
    try { const r = await fetch(API + "/settings/sync-prefs", { credentials: "include", cache: "no-store" }); if (r.ok) { const d = await r.json(); if (d.prefs) { prefs = { ...clone(DEFAULTS), ...d.prefs, quietHours: { ...DEFAULTS.quietHours, ...(d.prefs.quietHours || {}) } }; cache(); apply(); } } } catch {}
  }

  // Used by sync-tones.js and the reaction menu.
  function inQuiet(kind, at = new Date()) {
    const q = prefs.quietHours; if (!q?.on || (kind === "call" && q.callsRing)) return false;
    const local = at.toTimeString().slice(0, 5);
    return q.from <= q.to ? local >= q.from && local < q.to : local >= q.from || local < q.to;
  }
  const api = { get: () => clone(prefs), reactions: () => prefs.reactions.slice(), vibration: () => VIBRATION[prefs.vibration] ?? VIBRATION.short, quiet: inQuiet, accents: ACCENTS, apply, open: () => open() };

  // ---- the sheet ----
  function line(title, build, reset) {
    const row = document.createElement("section"); row.className = "myo-line";
    const head = document.createElement("div"); head.className = "myo-head";
    const h = document.createElement("h3"); h.textContent = t(title);
    const r = document.createElement("button"); r.type = "button"; r.className = "myo-reset"; r.textContent = t("Reset"); r.setAttribute("aria-label", t("Reset") + ": " + t(title));
    r.addEventListener("click", () => { reset(); save(); render(); });
    head.append(h, r); row.append(head, build()); return row;
  }
  function segmented(name, options, current, onPick) {
    const group = document.createElement("div"); group.className = "myo-seg"; group.setAttribute("role", "radiogroup");
    for (const [value, label] of options) {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(value === current)); b.textContent = t(label);
      b.addEventListener("click", () => { onPick(value); save(); render(); });
      group.append(b);
    }
    return group;
  }
  function toggle(label, checked, onChange) {
    const row = document.createElement("label"); row.className = "sync-tone-switch myo-switch";
    row.innerHTML = '<span></span><input type="checkbox" role="switch">';
    row.querySelector("span").textContent = t(label);
    const box = row.querySelector("input"); box.checked = checked; box.addEventListener("change", () => { onChange(box.checked); save(); render(); });
    return row;
  }
  function render() {
    const body = dialog.querySelector(".myo-body"); body.replaceChildren();
    // Live preview: a two-bubble chat in the current look.
    const preview = document.createElement("div"); preview.className = "myo-preview message-list"; preview.setAttribute("aria-hidden", "true");
    preview.innerHTML = '<div class="message"><span class="message-text"></span></div><div class="message mine"><span class="message-text"></span></div>';
    preview.querySelectorAll(".message-text")[0].textContent = t("Soundcheck at 5?"); preview.querySelectorAll(".message-text")[1].textContent = t("On my way with the cables.");
    body.append(preview);
    body.append(line("Accent color", () => {
      const wrap = document.createElement("div"); wrap.className = "myo-accents"; wrap.setAttribute("role", "radiogroup");
      for (const [id, a] of Object.entries(ACCENTS)) {
        const b = document.createElement("button"); b.type = "button"; b.className = "myo-accent"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(prefs.accent === id)); b.setAttribute("aria-label", t(a.name));
        b.style.setProperty("background", a.solid); b.addEventListener("click", () => { prefs.accent = id; save(); render(); });
        wrap.append(b);
      }
      return wrap;
    }, () => { prefs.accent = DEFAULTS.accent; }));
    body.append(line("Bubbles", () => segmented("bubbles", [["rounded", "Rounded"], ["square", "Square (techno)"]], prefs.bubbles, v => { prefs.bubbles = v; }), () => { prefs.bubbles = DEFAULTS.bubbles; }));
    body.append(line("Text size", () => segmented("text", [[0, "S"], [1, "M"], [2, "L"], [3, "XL"]], prefs.textSize, v => { prefs.textSize = v; }), () => { prefs.textSize = DEFAULTS.textSize; }));
    body.append(line("Vibration", () => segmented("vibration", [["short", "Short"], ["long", "Long"], ["off", "Off"]], prefs.vibration, v => { prefs.vibration = v; }), () => { prefs.vibration = DEFAULTS.vibration; }));
    body.append(line("Quiet hours", () => {
      const wrap = document.createElement("div"); wrap.className = "myo-quiet";
      wrap.append(toggle("No sound or vibration", prefs.quietHours.on, v => { prefs.quietHours.on = v; prefs.quietHours.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }));
      const times = document.createElement("div"); times.className = "myo-times";
      for (const key of ["from", "to"]) {
        const l = document.createElement("label"); l.innerHTML = "<span></span><input type=\"time\" step=\"300\">";
        l.querySelector("span").textContent = t(key === "from" ? "From" : "To");
        const input = l.querySelector("input"); input.value = prefs.quietHours[key]; input.disabled = !prefs.quietHours.on;
        input.addEventListener("change", () => { if (/^\d{2}:\d{2}$/.test(input.value)) { prefs.quietHours[key] = input.value; prefs.quietHours.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; save(); } });
        times.append(l);
      }
      wrap.append(times, toggle("Calls still ring", prefs.quietHours.callsRing, v => { prefs.quietHours.callsRing = v; }));
      return wrap;
    }, () => { prefs.quietHours = clone(DEFAULTS.quietHours); }));
    body.append(line("Notifications", () => toggle("Hide message previews", prefs.hidePreviews, v => { prefs.hidePreviews = v; }), () => { prefs.hidePreviews = DEFAULTS.hidePreviews; }));
    body.append(line("Quick reactions", () => {
      const wrap = document.createElement("div"); wrap.className = "myo-reactions";
      prefs.reactions.forEach((emoji, index) => {
        const input = document.createElement("input"); input.type = "text"; input.value = emoji; input.maxLength = 8; input.setAttribute("aria-label", t("Reaction") + " " + (index + 1)); input.inputMode = "text";
        input.addEventListener("change", () => { const value = input.value.trim(); if (value && [...value].length <= 8 && !/[<>&"'`]/.test(value)) { prefs.reactions[index] = value; save(); } else input.value = prefs.reactions[index]; });
        wrap.append(input);
      });
      return wrap;
    }, () => { prefs.reactions = DEFAULTS.reactions.slice(); }));
    const more = document.createElement("nav"); more.className = "myo-more";
    for (const [id, label] of [["wallpaper", "Chat wallpaper"], ["tones", "Ringtones"], ["privacy", "Privacy"]]) {
      const b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = t(label);
      b.addEventListener("click", () => { dialog.close(); ({ wallpaper: () => window.danzstakSyncWallpaper?.open("all"), tones: () => window.danzstakSyncTones?.open(""), privacy: () => window.danzstakSyncPrivacy?.open() })[id]?.(); });
      more.append(b);
    }
    body.append(more);
  }
  async function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog sync-wallpaper-dialog sync-tones-dialog myo-dialog";
      dialog.setAttribute("aria-labelledby", "myoTitle");
      dialog.innerHTML = '<header><h2 id="myoTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header><div class="myo-body"></div><p class="phone-setup-status" role="status" data-status></p>';
      dialog.querySelector(".call-setup-close").addEventListener("click", () => dialog.close());
      document.body.appendChild(dialog);
      window.danzstakIcons?.enhance?.(dialog);
    }
    dialog.querySelector("h2").textContent = t("Make it yours");
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector("[data-status]").textContent = "";
    render();
    if (!dialog.open) dialog.showModal();
    await load(); if (dialog.open) render();
  }

  apply();
  load();
  window.danzstakSyncSettings?.add({ id: "make-it-yours", label: "Make it yours", hint: "Theme, accent, bubbles, text size, vibration, quiet hours, reactions", icon: "sparkles", order: 5, run: open });
  window.danzstakSyncPrefs = api;
})();
