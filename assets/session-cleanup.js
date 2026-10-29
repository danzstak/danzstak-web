"use strict";

(() => {
  const accountLocalKeys = [
    "danzstak_dev_sections",
    "danzstak-post-preferences",
    "danzstak-hidden-posts",
    "danzstak_external_reels",
    "danzstak_chat_read",
    "danzstak_profile_draft",
    "danzstak_profile_media",
    "danzstak_last_activity"
  ];

  window.danzstakClearAccountData = () => {
    try { for (const key of accountLocalKeys) localStorage.removeItem(key); }
    catch { /* Server logout remains authoritative when browser storage is unavailable. */ }
    try {
      sessionStorage.removeItem("danzstak_install_prompt_shown");
      sessionStorage.removeItem("danzstakBookingVenueSelections");
      sessionStorage.removeItem("danzstakBookingMapAdditions");
      sessionStorage.removeItem("danzstak_push_synced");
      sessionStorage.removeItem("danzstak_push_prompt_dismissed");
    }
    catch { /* Session storage is optional. */ }
  };

  window.danzstakDisablePush = async () => {
    try {
      sessionStorage.removeItem("danzstak_push_synced");
      sessionStorage.removeItem("danzstak_push_prompt_dismissed");
    } catch { /* A device without session storage can still disable its subscription. */ }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    let readyTimer;
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error("Service worker unavailable")), 4000); })
    ]).finally(() => clearTimeout(readyTimer));
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch("https://api.danzstak.com/push/subscribe", {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    } finally {
      clearTimeout(timeout);
      await subscription.unsubscribe().catch(() => false);
    }
    return true;
  };
})();
