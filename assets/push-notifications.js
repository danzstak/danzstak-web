"use strict";

(() => {
  const API = "https://api.danzstak.com";

  function applicationServerKey(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }

  async function withDeadline(promise, timeoutMs, message) {
    let timeout;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), timeoutMs); })
    ]).finally(() => clearTimeout(timeout));
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(API + path, {
        credentials: "include",
        cache: "no-store",
        ...options,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(await globalThis.danzstakCallingDeviceHeaders?.()), ...(options.headers || {}) }
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Notification setup took too long. Try again.");
      throw new Error("DanzStak cannot connect right now. Check your connection and try again.");
    } finally { clearTimeout(timeout); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Notification setup failed");
    return data;
  }

  async function state() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted") return "prompt";
    const registration = await withDeadline(navigator.serviceWorker.ready, 10000, "Notification service is not ready. Try again.");
    return await withDeadline(registration.pushManager.getSubscription(), 10000, "Notification status took too long.") ? "enabled" : "incomplete";
  }

  async function enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Background alerts are not supported by this browser.");
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notifications must be allowed for background alerts.");
    const registration = await withDeadline(navigator.serviceWorker.ready, 10000, "Notification service is not ready. Try again.");
    const key = await api("/push/key");
    const existing = await withDeadline(registration.pushManager.getSubscription(), 10000, "Notification status took too long.");
    const subscription = existing || await withDeadline(registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(key.publicKey)
    }), 15000, "Notification permission setup took too long. Try again.");
    const serialized = subscription.toJSON();
    await api("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys })
    });
    try { sessionStorage.setItem("danzstak_push_synced", "1"); } catch (_) {}
    dispatchEvent(new CustomEvent("danzstak:push-enabled"));
    return subscription;
  }

  async function disable() {
    try { sessionStorage.removeItem("danzstak_push_synced"); } catch (_) {}
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const registration = await withDeadline(navigator.serviceWorker.ready, 10000, "Notification service is not ready. Try again.");
    const subscription = await withDeadline(registration.pushManager.getSubscription(), 10000, "Notification status took too long.");
    if (!subscription) {
      dispatchEvent(new CustomEvent("danzstak:push-disabled"));
      return false;
    }
    let serverRemoved = false;
    try {
      await api("/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      serverRemoved = true;
    } finally {
      // Always stop this browser locally. A failed server delete is safe to
      // retry because expired endpoints are also removed after a 404/410.
      await withDeadline(subscription.unsubscribe(), 10000, "Notification removal took too long.").catch(() => false);
    }
    dispatchEvent(new CustomEvent("danzstak:push-disabled"));
    return serverRemoved;
  }

  window.danzstakPushState = state;
  window.danzstakEnablePush = enable;
  window.danzstakDisablePush = disable;

  async function renewExistingSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem("danzstak_push_synced") === "1") return;
    } catch (_) {}
    try {
      const registration = await withDeadline(navigator.serviceWorker.ready, 10000, "Notification service is not ready.");
      const subscription = await withDeadline(registration.pushManager.getSubscription(), 10000, "Notification status took too long.");
      if (!subscription) return;
      const serialized = subscription.toJSON();
      await api("/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys })
      });
      try { sessionStorage.setItem("danzstak_push_synced", "1"); } catch (_) {}
      dispatchEvent(new CustomEvent("danzstak:push-enabled"));
    } catch (_) { /* Retry on the next page load without disturbing the signed-in experience. */ }
  }

  // Renew a subscription that the member explicitly enabled in App and
  // device settings. Never surface a permission prompt during page load.
  setTimeout(renewExistingSubscription, 2000);
})();
