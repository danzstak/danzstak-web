"use strict";

(() => {
  const API = "https://api.danzstak.com";

  function applicationServerKey(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Notification setup failed");
    return data;
  }

  async function state() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted") return "prompt";
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription() ? "enabled" : "incomplete";
  }

  async function enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Background alerts are not supported by this browser.");
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notifications must be allowed for background alerts.");
    const registration = await navigator.serviceWorker.ready;
    const key = await api("/push/key");
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(key.publicKey)
    });
    const serialized = subscription.toJSON();
    await api("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys })
    });
    dispatchEvent(new CustomEvent("danzstak:push-enabled"));
    return subscription;
  }

  window.danzstakPushState = state;
  window.danzstakEnablePush = enable;
})();
