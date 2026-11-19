"use strict";
// Owner 2026-11-19: "users that don't verify their device should get a notification in danzstak that says to verify
// their device". Members can skip verification at sign-up and keep texting; until this device is verified, Notifications
// shows one row "Verify this device for SYNC calls" (the whole row opens SYNC's "verify your number"), counted on the
// bell until the member has seen it, then again every 3 days. Nothing is sent anywhere: the check reads only whether this
// browser holds a SYNC device credential (call-devices.js keeps it in IndexedDB "danzstak-call-device"); the SYNC page
// itself catches a credential the server no longer accepts.
(() => {
  const DB_NAME = "danzstak-call-device", STORE = "credentials", SEEN_KEY = "danzstak_device_reminder_seen", AGAIN_MS = 3 * 24 * 60 * 60 * 1000;
  const t = value => window.danzstakTranslate?.(value) || value;
  const valid = item => Boolean(item && typeof item.deviceId === "string" && item.deviceId && typeof item.deviceToken === "string" && item.deviceToken);

  function hasCredential() {
    if (!window.indexedDB) return Promise.resolve(false);
    return new Promise(resolve => {
      let request;
      try { request = indexedDB.open(DB_NAME, 1); } catch { resolve(false); return; }
      request.onupgradeneeded = () => request.result.createObjectStore(STORE); // first visit: the same empty store call-devices.js makes
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const store = db.transaction(STORE, "readonly").objectStore(STORE), accounts = store.get("accounts"), legacy = store.get("current");
          accounts.transaction.oncomplete = () => { db.close(); resolve((Array.isArray(accounts.result) && accounts.result.some(valid)) || valid(legacy.result)); };
          accounts.transaction.onerror = () => { db.close(); resolve(false); };
        } catch { db.close(); resolve(false); }
      };
    });
  }
  let cached = null;
  const needed = () => (cached ||= hasCredential().then(has => !has));
  const seenAt = () => { try { return Number(localStorage.getItem(SEEN_KEY) || 0); } catch { return 0; } };
  const unread = () => Date.now() - seenAt() > AGAIN_MS;
  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* optional */ } };

  function row() {
    const link = document.createElement("a");
    link.className = "notification-row notification-row--device";
    link.href = "/sync/?device=register";
    link.classList.toggle("is-read", !unread());
    const icon = document.createElement("span"); icon.className = "notification-avatar";
    const image = document.createElement("img"); image.src = "assets/sync-icon-192.png?v=1"; image.alt = ""; image.width = 44; image.height = 44;
    icon.append(image);
    const text = document.createElement("p");
    const title = document.createElement("strong"); title.textContent = t("Verify this device for SYNC calls");
    const line = document.createElement("span"); line.textContent = t("Calls and voice messages need it. Texting already works.");
    text.append(title, line);
    link.append(icon, text);
    return link;
  }
  window.danzstakDeviceReminder = Object.freeze({ needed, unread, markSeen, row });
})();
