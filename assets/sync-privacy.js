"use strict";
// SYNC privacy (task 16-D): who sees your last seen and online (everyone, friends, nobody) and read receipts on/off.
// Saved to the member's account (POST /settings/sync-privacy), so every device follows it. Last seen and read receipts are
// reciprocal, like familiar messengers: hide yours and you don't see other people's.
(() => {
  const API = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  let dialog = null, state = { lastSeen: "everyone", readReceipts: true };

  async function load() {
    try { const r = await fetch(API + "/settings/presence", { credentials: "include", cache: "no-store" }); if (r.ok) { const d = await r.json(); state = { lastSeen: ["everyone", "friends", "nobody"].includes(d.lastSeen) ? d.lastSeen : d.onlineVisible === false ? "nobody" : "everyone", readReceipts: d.readReceipts !== false }; } } catch {}
    return state;
  }
  async function save(next, status) {
    const previous = state; state = { ...state, ...next };
    try {
      const r = await fetch(API + "/settings/sync-privacy", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
      if (!r.ok) throw new Error();
      status.textContent = t("Saved.");
    } catch { state = previous; render(); status.textContent = t("Not saved. Check your connection and try again."); }
  }
  function render() {
    const body = dialog.querySelector(".sync-privacy-body");
    body.replaceChildren();
    const status = dialog.querySelector("[data-status]");
    const section = document.createElement("section"); section.className = "sync-tone-section";
    const h = document.createElement("h3"); h.textContent = t("Last seen and online"); section.append(h);
    for (const [value, label] of [["everyone", "Everyone"], ["friends", "My friends"], ["nobody", "Nobody"]]) {
      const row = document.createElement("label"); row.className = "sync-tone-row sync-privacy-row";
      row.innerHTML = '<input type="radio" name="sync-last-seen"><span></span>';
      const input = row.querySelector("input"); input.value = value; input.checked = state.lastSeen === value;
      row.querySelector("span").textContent = t(label);
      input.addEventListener("change", () => save({ lastSeen: value }, status));
      section.append(row);
    }
    const note = document.createElement("p"); note.className = "sync-wp-note sync-privacy-note"; note.textContent = t("If you don't share your last seen, you won't see other people's.");
    section.append(note);
    const receipts = document.createElement("label"); receipts.className = "sync-tone-switch";
    receipts.innerHTML = '<span><strong></strong><small></small></span><input type="checkbox" role="switch">';
    receipts.querySelector("strong").textContent = t("Read receipts");
    receipts.querySelector("small").textContent = t("Turn off and others won't see blue ticks from you, and you won't see theirs.");
    const box = receipts.querySelector("input"); box.checked = state.readReceipts;
    box.addEventListener("change", () => save({ readReceipts: box.checked }, status));
    body.append(section, receipts);
  }
  async function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog sync-wallpaper-dialog sync-tones-dialog sync-privacy-dialog";
      dialog.setAttribute("aria-labelledby", "syncPrivacyTitle");
      dialog.innerHTML = '<header><h2 id="syncPrivacyTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header><div class="sync-privacy-body"></div><p class="phone-setup-status" role="status" data-status></p>';
      dialog.querySelector(".call-setup-close").addEventListener("click", () => dialog.close());
      document.body.appendChild(dialog);
      window.danzstakIcons?.enhance?.(dialog);
    }
    dialog.querySelector("h2").textContent = t("Privacy");
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector("[data-status]").textContent = "";
    await load();
    render();
    if (!dialog.open) dialog.showModal();
  }
  window.danzstakSyncSettings?.add({ id: "privacy", label: "Privacy", hint: "Last seen, online and read receipts", icon: "lock", order: 30, run: open });
  window.danzstakSyncPrivacy = { open, load };
})();
