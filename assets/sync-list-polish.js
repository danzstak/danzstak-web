"use strict";
// SYNC list at 390px (owner check 2026-11-18, fix-it 18 "SYNC list"): WhatsApp pattern, not five round buttons.
// - The header keeps the title and ONE ⋮ (it opens the SYNC settings sheet). Invite a friend, Call alerts and
//   New video call become rows in that sheet; Phone and registered devices is already one. New chat stays the
//   floating button; calls live in the Calls tab. The original buttons stay in the DOM (hidden) so every handler,
//   deep link and test that clicks them keeps working.
// - No explanatory sub-line ("Your saved conversations.") under the tabs.
// - A profile picture that fails to load (for example an expired link) falls back to the member's initial
//   instead of leaving an empty circle.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const click = id => () => document.getElementById(id)?.click();
  const ROWS = [
    { id: "invite", label: "Invite a friend", hint: "Share your DanzStak link", icon: "share", order: 10, run: click("inviteFriend") },
    { id: "video", label: "New video call", hint: "Pick someone from your chats", icon: "video", order: 20, run: click("newVideoCall") },
    { id: "alerts", label: "Call alerts", hint: "Ring this device when someone calls", icon: "bell", order: 30, run: click("enableRinging") }
  ];

  function moreButton() {
    const gear = document.getElementById("syncSettings");
    if (!gear || gear.dataset.syncMore === "1") return Boolean(gear);
    gear.dataset.syncMore = "1";
    gear.dataset.icon = "more";
    gear.textContent = "⋮";
    gear.setAttribute("aria-label", t("More options")); gear.title = t("More options");
    gear.setAttribute("aria-haspopup", "dialog");
    window.danzstakIcons?.enhance?.(gear.parentElement);
    return true;
  }

  function initial(name) { return (String(name || "").trim().charAt(0) || "·").toUpperCase(); }
  function fallback(img) {
    const span = document.createElement("span");
    span.className = img.className;
    const owner = img.closest(".chat-contact, .conversation-user");
    span.textContent = initial(owner?.title || owner?.querySelector("strong, .chat-contact-name")?.textContent);
    span.setAttribute("aria-hidden", "true");
    img.replaceWith(span);
  }

  function mount() {
    document.body.classList.add("sync-list-polish");
    for (const row of ROWS) window.danzstakSyncSettings?.add?.(row);
    if (!moreButton()) {
      const actions = document.querySelector(".chat-heading-actions");
      if (actions) {
        const watch = new MutationObserver(() => { if (moreButton()) watch.disconnect(); });
        watch.observe(actions, { childList: true });
      }
    }
    const note = document.getElementById("syncSectionNote");
    if (note) note.setAttribute("aria-hidden", "true");
    // Broken avatar images (they do not bubble, so listen in the capture phase).
    document.addEventListener("error", event => {
      const img = event.target;
      if (img instanceof HTMLImageElement && img.matches(".chat-contact-avatar, .conversation-list-avatar")) fallback(img);
    }, true);
  }

  window.danzstakSyncListPolish = Object.freeze({ initial, ROWS });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
