"use strict";
// SYNC settings sheet (task 16): one place for the member's own SYNC choices. Features register a row with
// danzstakSyncSettings.add({ id, label, icon, order, run }); 16-B adds Chat wallpaper, 16-B2 Ringtones, 16-H Make it yours.
// Opened from the gear in the chat list header.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const rows = new Map();
  let dialog = null;

  function render() {
    const list = dialog.querySelector(".sync-settings-rows");
    list.replaceChildren(...[...rows.values()].sort((a, b) => (a.order || 0) - (b.order || 0)).map(row => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "sync-settings-row"; button.dataset.settingsRow = row.id;
      button.innerHTML = '<span class="sync-settings-icon" aria-hidden="true"></span><span class="sync-settings-text"><strong></strong><small></small></span><span class="sync-settings-chevron" data-menu-icon="chevron" aria-hidden="true"></span>';
      button.querySelector(".sync-settings-icon").dataset.menuIcon = row.icon || "settings";
      button.querySelector("strong").textContent = t(row.label);
      button.querySelector("small").textContent = row.hint ? t(row.hint) : "";
      button.addEventListener("click", () => { dialog.close(); row.run(); });
      return button;
    }));
    window.danzstakIcons?.enhance?.(dialog);
  }
  function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog sync-settings-dialog";
      dialog.setAttribute("aria-labelledby", "syncSettingsTitle");
      dialog.innerHTML = '<header><h2 id="syncSettingsTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header><nav class="sync-settings-rows"></nav>';
      dialog.querySelector(".call-setup-close").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
      document.body.appendChild(dialog);
    }
    dialog.querySelector("h2").textContent = t("SYNC settings");
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    render();
    if (!dialog.open) dialog.showModal();
  }
  function add(row) { if (row?.id && typeof row.run === "function") rows.set(row.id, row); if (dialog?.open) render(); }

  function mountButton() {
    const actions = document.querySelector(".chat-heading-actions");
    if (!actions || document.getElementById("syncSettings")) return;
    const button = document.createElement("button");
    button.type = "button"; button.id = "syncSettings"; button.className = "chat-heading-button"; button.dataset.icon = "settings";
    button.setAttribute("aria-label", t("SYNC settings")); button.title = t("SYNC settings");
    button.textContent = "⚙";
    button.addEventListener("click", open);
    actions.insertBefore(button, document.getElementById("newChat"));
    window.danzstakIcons?.enhance?.(actions);
  }
  // 16-G: SYNC as its own app (same account, no second login).
  add({ id: "standalone", label: "Get SYNC as its own app", hint: "Its own icon on your home screen, straight to your chats", icon: "smartphone", order: 95, run: () => { location.href = "sync.html"; } });
  add({ id: "devices", label: "Phone and registered devices", hint: "SMS registration for calls and voice messages", icon: "smartphone", order: 90, run: () => document.getElementById("callingDevices")?.click() });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButton); else mountButton();
  window.danzstakSyncSettings = { open, add };
})();
