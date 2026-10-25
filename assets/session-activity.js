"use strict";
(() => {
  const refreshEvery = 5 * 60 * 1000;
  const idleTimeout = 2 * 60 * 60 * 1000;
  const activityKey = "danzstak_last_activity";
  let lastActivity = 0;
  let lastRefresh = 0;
  let refreshing = false;
  let presenceUpdating = false;
  let idleTimer = null;
  let loggingOut = false;

  // Reaching an authenticated page is current activity. An old timestamp from
  // a previous login must not suppress presence or immediately end a new session.
  lastActivity = Date.now();
  try { localStorage.setItem(activityKey, String(lastActivity)); }
  catch { /* This tab can still track activity in memory. */ }

  function sharedLastActivity() {
    try { return Math.max(lastActivity, Number(localStorage.getItem(activityKey)) || 0); }
    catch { return lastActivity; }
  }

  function scheduleIdleLogout() {
    clearTimeout(idleTimer);
    const remaining = Math.max(0, idleTimeout - (Date.now() - sharedLastActivity()));
    idleTimer = setTimeout(logoutIfIdle, remaining + 50);
  }

  async function logoutIfIdle() {
    if (Date.now() - sharedLastActivity() < idleTimeout) return scheduleIdleLogout();
    if (loggingOut) return;
    loggingOut = true;
    try {
      await fetch("https://api.danzstak.com/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    } catch { /* The server session still expires at the same idle deadline. */ }
    window.danzstakClearAccountData?.();
    location.replace("./?idle=1");
  }

  const markActive = () => {
    const timestamp = Date.now();
    if (timestamp - lastActivity < 5000) return;
    lastActivity = timestamp;
    try { localStorage.setItem(activityKey, String(timestamp)); }
    catch { /* This tab can still enforce its own idle deadline. */ }
    scheduleIdleLogout();
  };
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
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (response.ok) lastRefresh = now;
      else if (response.status === 401) location.replace("./");
    } catch { /* A later active heartbeat will retry. */ }
    finally { refreshing = false; }
  }

  async function refreshPresence() {
    // A signed-in app often runs in a background tab. Keep presence alive while
    // the user's two-hour activity session is valid; browsers otherwise marked
    // people offline roughly one minute after they changed tabs.
    if (Date.now() - lastActivity >= idleTimeout || presenceUpdating) return;
    presenceUpdating = true;
    try {
      const response = await fetch("https://api.danzstak.com/calls/presence", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (response.ok) dispatchEvent(new CustomEvent("danzstak-presence-updated"));
    } catch { /* A later heartbeat will retry. */ }
    finally { presenceUpdating = false; }
  }

  refreshIfActive();
  refreshPresence();
  setInterval(refreshIfActive, 60 * 1000);
  setInterval(refreshPresence, 30 * 1000);
  addEventListener("focus", refreshPresence);
  addEventListener("pageshow", refreshPresence);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { markActive(); refreshPresence(); } });
  addEventListener("storage", event => { if (event.key === activityKey) { lastActivity = Math.max(lastActivity, Number(event.newValue) || 0); scheduleIdleLogout(); } });
  scheduleIdleLogout();
})();
