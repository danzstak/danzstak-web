"use strict";

(() => {
  const api = "https://api.danzstak.com";
  const key = "danzstak-offline-v1";
  const preferenceKey = "danzstak_offline_access";
  const nativeFetch = window.fetch.bind(window);
  let state;
  try { state = JSON.parse(localStorage.getItem(key)) || {}; } catch { state = {}; }
  state.reads ||= {};
  state.queue ||= [];
  let verified = false;
  let syncing = false;
  let queueButton;
  const enabled = () => {
    try { return localStorage.getItem(preferenceKey) === "1"; }
    catch { return false; }
  };
  const save = () => localStorage.setItem(key, JSON.stringify(state));
  const banner = document.createElement("div");
  banner.setAttribute("role", "status");
  banner.style.cssText = "position:fixed;bottom:12px;left:12px;right:12px;z-index:10000;background:#172330;color:white;padding:12px;border-radius:12px;font:14px system-ui";
  const render = (message = "") => {
    if (!enabled()) { banner.hidden = true; banner.textContent = ""; if (queueButton) queueButton.hidden = true; return; }
    banner.textContent = message || (navigator.onLine === false ? "Offline — showing saved content. Text posts and messages will wait for a connection." : state.queue.length ? `${state.queue.length} offline item(s) waiting to sync.` : "");
    banner.hidden = !banner.textContent;
    if (queueButton) queueButton.hidden = state.queue.length === 0;
  };
  document.addEventListener("DOMContentLoaded", () => { document.body.append(banner); render(); });
  const identity = async () => {
    const response = await nativeFetch(api + "/auth/session", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) { verified = false; throw new Error("Sign in to sync offline changes."); }
    const data = await response.clone().json();
    const profile = data.user || data.claims || data.profile || data;
    const owner = profile.sub || profile.userEmail || profile.email || profile.userId;
    if (!owner) throw new Error("Account could not be verified for offline use.");
    if (state.owner !== owner) state = { owner, reads: {}, queue: [] };
    verified = true;
    state.reads["/auth/session"] = { authenticated: true, user: { email: profile.email, sub: profile.sub } };
    save();
    return owner;
  };
  const readable = path => /^\/(?:auth\/session|profiles|secure-posts|friends|conversations|messages|groups|engagement)(?:\?|$)/.test(path);
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const path = url.pathname + url.search;
    const method = options.method || input?.method || "GET";
    if (!enabled() || url.origin !== api || method !== "GET" || !readable(path)) return nativeFetch(input, options);
    if (navigator.onLine === false && state.owner && state.reads[path]) return Response.json(state.reads[path]);
    try {
      const response = await nativeFetch(input, options);
      if (response.status === 401) { verified = false; state = { reads: {}, queue: [] }; save(); }
      if (response.ok && verified && url.pathname !== "/auth/session") {
        const data = await response.clone().json();
        // Bound private saved data; never store credentials or auth responses.
        if (JSON.stringify(data).length < 500000) {
          delete state.reads[path];
          state.reads[path] = data;
          const keys = Object.keys(state.reads);
          if (keys.length > 40) delete state.reads[keys[0]];
          try { save(); } catch { /* Keep the live response if storage is full. */ }
        }
      }
      return response;
    } catch (error) {
      if (navigator.onLine === false && state.owner && state.reads[path]) return Response.json(state.reads[path]);
      throw error;
    }
  };
  window.danzstakQueueOffline = (path, body) => {
    if (!enabled()) throw new Error("Turn on offline access in App and device settings first.");
    try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) state = saved; } catch { /* Storage errors are reported by save below. */ }
    if (!state.owner) throw new Error("Load your profile online once before saving offline changes.");
    if (!["/secure-posts", "/messages"].includes(path) || body.mediaKey) throw new Error("This action needs a connection.");
    if (state.queue.length >= 50) throw new Error("Reconnect to send your saved items before adding more.");
    const item = { id: crypto.randomUUID(), path, body, status: "waiting" };
    state.queue.push(item);
    try { save(); } catch (error) { state.queue.pop(); throw new Error("Device storage is full. Your text has not been queued."); }
    render("Saved on this device — will send when you reconnect.");
  };
  async function sync() {
    if (!enabled() || syncing || navigator.onLine === false) return;
    syncing = true;
    try {
      const previousOwner = state.owner;
      await identity();
      if (previousOwner && previousOwner !== state.owner) return;
      for (const item of state.queue) {
        if (item.status !== "waiting") continue;
        item.status = "sending";
        save();
        // An interrupted send is retained for review, never automatically duplicated.
        const response = await nativeFetch(api + item.path, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body), signal: AbortSignal.timeout(15000) });
        if (!response.ok) { item.status = response.status === 401 ? "waiting" : "review"; save(); throw new Error("Offline item could not be sent. Sign in or review your saved items."); }
        state.queue = state.queue.filter(row => row.id !== item.id);
        save();
      }
      render(state.queue.length ? "Some offline items need review. Open Saved offline items." : "");
      window.dispatchEvent(new Event("danzstak-offline-synced"));
    } catch (error) { render(error.message || "Offline changes are waiting for a connection."); }
    finally { syncing = false; }
  }
  window.danzstakClearOffline = () => { verified = false; state = { reads: {}, queue: [] }; localStorage.removeItem(key); render(); };
  window.danzstakOfflineEnabled = enabled;
  window.danzstakSetOfflineEnabled = async value => {
    if (!value) {
      try { localStorage.removeItem(preferenceKey); } catch { /* Storage may be unavailable. */ }
      window.danzstakClearOffline();
      window.dispatchEvent(new Event("danzstak-offline-preference"));
      return false;
    }
    try { localStorage.setItem(preferenceKey, "1"); }
    catch { throw new Error("This browser cannot save offline access settings."); }
    try { await identity(); }
    catch (error) {
      localStorage.removeItem(preferenceKey);
      window.danzstakClearOffline();
      throw error;
    }
    render("Offline access is on for this device.");
    window.dispatchEvent(new Event("danzstak-offline-preference"));
    return true;
  };
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    queueButton = button;
    button.textContent = "Saved offline items";
    button.type = "button";
    button.hidden = !enabled() || state.queue.length === 0;
    button.addEventListener("click", () => {
      const dialog = document.createElement("dialog");
      const title = document.createElement("h2"); title.textContent = "Saved offline items"; dialog.append(title);
      for (const item of state.queue) {
        const row = document.createElement("p");
        row.textContent = `${item.status}: ${item.body.content} ${item.status === "sending" ? "— delivery uncertain; check your feed or chat before posting again." : ""}`;
        const remove = document.createElement("button"); remove.textContent = "Discard";
        remove.onclick = () => { state.queue = state.queue.filter(entry => entry.id !== item.id); save(); row.remove(); render(); };
        row.append(remove); dialog.append(row);
      }
      const close = document.createElement("button"); close.textContent = "Close"; close.onclick = () => { dialog.close(); dialog.remove(); }; dialog.append(close);
      document.body.append(dialog); dialog.showModal();
    });
    document.body.append(button);
    window.addEventListener("danzstak-offline-preference", () => { button.hidden = !enabled() || state.queue.length === 0; });
    window.addEventListener("danzstak-offline-synced", () => { button.hidden = !enabled() || state.queue.length === 0; });
  });
  window.addEventListener("online", sync);
  window.addEventListener("offline", () => render());
  window.addEventListener("storage", event => {
    if (event.key === preferenceKey) { if (!enabled()) window.danzstakClearOffline(); render(); return; }
    if (event.key !== key) return;
    try { state = JSON.parse(event.newValue) || { reads: {}, queue: [] }; } catch { state = { reads: {}, queue: [] }; }
    verified = false;
    render();
  });
  // A browser lock keeps multiple open tabs from sending the same queue.
  const runSync = () => navigator.locks ? navigator.locks.request("danzstak-offline-sync", { ifAvailable: true }, lock => {
    if (!lock) return;
    try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) state = saved; } catch { /* Use current state. */ }
    return sync();
  }) : identity().catch(() => render());
  window.removeEventListener("online", sync);
  window.addEventListener("online", runSync);
  if (enabled()) runSync();
})();

