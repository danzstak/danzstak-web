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
    try { sessionStorage.setItem("danzstak_push_synced", "1"); } catch (_) {}
    dispatchEvent(new CustomEvent("danzstak:push-enabled"));
    return subscription;
  }

  window.danzstakPushState = state;
  window.danzstakEnablePush = enable;

  async function renewExistingSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      if (sessionStorage.getItem("danzstak_push_synced") === "1") return;
    } catch (_) {}
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
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

  async function showPermissionPrompt() {
    if (new URLSearchParams(location.search).get("embedded") === "1") return;
    try {
      if (sessionStorage.getItem("danzstak_push_prompt_dismissed") === "1") return;
    } catch (_) {}
    const current = await state().catch(() => "unsupported");
    if (!['prompt', 'incomplete'].includes(current) || document.querySelector('.push-alert-prompt')) return;
    const prompt = document.createElement('aside');
    prompt.className = 'push-alert-prompt';
    prompt.setAttribute('role', 'status');
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Never miss a DanzStak call';
    const detail = document.createElement('span');
    detail.textContent = 'Receive call and message notifications while DanzStak is in the background. Sound follows your device settings.';
    copy.append(title, detail);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'primary';
    action.textContent = current === 'incomplete' ? 'Finish setup' : 'Enable alerts';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'push-alert-dismiss';
    dismiss.textContent = 'Not now';
    dismiss.addEventListener('click', () => {
      try { sessionStorage.setItem('danzstak_push_prompt_dismissed', '1'); } catch (_) {}
      prompt.remove();
    });
    action.addEventListener('click', async () => {
      action.disabled = true;
      action.textContent = 'Enabling...';
      try {
        await enable();
        prompt.remove();
      } catch (error) {
        detail.textContent = error.message;
        action.textContent = 'Try again';
        action.disabled = false;
      }
    });
    prompt.append(copy, action, dismiss);
    document.body.appendChild(prompt);
  }

  addEventListener('danzstak:push-enabled', () => document.querySelector('.push-alert-prompt')?.remove());
  setTimeout(renewExistingSubscription, 2000);
  setTimeout(showPermissionPrompt, 12000);
})();
