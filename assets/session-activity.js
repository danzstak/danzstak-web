"use strict";
(() => {
  const refreshEvery = 5 * 60 * 1000;
  const idleTimeout = 2 * 60 * 60 * 1000;
  let lastActivity = Date.now();
  let lastRefresh = 0;
  let refreshing = false;
  let presenceUpdating = false;

  const markActive = () => { lastActivity = Date.now(); };
  for (const eventName of ["pointerdown", "keydown", "touchstart", "scroll"]) {
    addEventListener(eventName, markActive, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) markActive();
  });

  async function refreshIfActive() {
    const now = Date.now();
    if (document.hidden || now - lastActivity >= idleTimeout || now - lastRefresh < refreshEvery || refreshing) return;
    refreshing = true;
    try {
      const response = await fetch("https://api.danzstak.com/auth/refresh", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (response.ok) lastRefresh = now;
      else if (response.status === 401) location.replace("./");
    } catch { /* A later active heartbeat will retry. */ }
    finally { refreshing = false; }
  }

  async function refreshPresence() {
    if (document.hidden || presenceUpdating) return;
    presenceUpdating = true;
    try {
      await fetch("https://api.danzstak.com/calls/presence", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
    } catch { /* A later heartbeat will retry. */ }
    finally { presenceUpdating = false; }
  }

  refreshIfActive();
  refreshPresence();
  setInterval(refreshIfActive, 60 * 1000);
  setInterval(refreshPresence, 30 * 1000);
  addEventListener("focus", refreshPresence);
  addEventListener("pageshow", refreshPresence);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPresence(); });
})();
