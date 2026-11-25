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
  // The same rule as call-devices.js, so both agree on what counts as this device's SYNC credential.
  const valid = item => Boolean(item && /^[a-f0-9-]{36}$/.test(String(item.deviceId || "")) && /^[A-Za-z0-9_-]{43}$/.test(String(item.deviceToken || "")));

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

  // One kit list row (assets/notifications.js): the whole row opens SYNC's "verify your number"; the DS number is offered
  // right under it. Returns { node, after, unread } for Notifications' New / Earlier sections.
  function row() {
    const kit = window.danzstakNotifications;
    const text = document.createElement("p");
    text.className = "ds-row__text";
    const title = document.createElement("strong"); title.textContent = t("Verify this device for SYNC calls");
    const line = document.createElement("span"); line.className = "ds-row__sub"; line.textContent = t("Calls and voice messages need it. Texting already works.");
    text.append(title, " ", line);
    const isUnread = unread();
    const node = kit.row({ kind: "device", unread: isUnread, text, open: { href: "/sync/?device=register" }, extraClass: "notification-row--device",
      avatar: { picture: "assets/sync-icon-192.png?v=1" } });
    // Owner 2026-11-19: "if they don't wish to put their phone number in [they] can get a ds- number … they have to buy
    // the ds- number … just offer it in the notification" ($3, the existing Stripe checkout in SYNC's device panel).
    const ds = document.createElement("a");
    ds.className = "notification-ds-link ds-row__link"; ds.href = "/sync/?device=register&ds=1";
    ds.textContent = t("No phone number? Get a DS number");
    return { node, after: [ds], unread: isUnread };
  }
  window.danzstakDeviceReminder = Object.freeze({ needed, unread, markSeen, row });
})();
