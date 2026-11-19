"use strict";
// Task 34 (owner 2026-11-18): "Get SYNC as its own app" puts a SYNC icon on the home screen.
// SYNC lives under /sync/ (sync/index.html, generated from messages.html) with its own manifest scope, so Chrome can
// install it next to DanzStak. This file:
//   - keeps SYNC inside /sync/ while you use it there (links to messages.html become /sync/);
//   - runs the install sheet: the browser's install prompt when it offers one, the phone's own steps when it does not,
//     and "SYNC is installed on this phone" inside the installed SYNC app. Same account, no second login.
(() => {
  const HOME = "/sync/", INSTALLED_KEY = "danzstak_sync_app_installed", LAUNCH_KEY = "danzstak_launch_app";
  const inSyncApp = location.pathname.startsWith(HOME);
  const t = value => window.danzstakTranslate?.(value) || value;
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

  // Which installed app is this window? A standalone window's first page tells: the SYNC app starts at /sync/.
  let launchApp = "";
  try {
    launchApp = sessionStorage.getItem(LAUNCH_KEY) || "";
    if (!launchApp && standalone()) { launchApp = inSyncApp ? "sync" : "danzstak"; sessionStorage.setItem(LAUNCH_KEY, launchApp); }
  } catch { if (standalone()) launchApp = inSyncApp ? "sync" : "danzstak"; }
  const inInstalledSync = () => standalone() && launchApp === "sync";
  let knownInstalled = inInstalledSync();
  try { if (knownInstalled) localStorage.setItem(INSTALLED_KEY, "1"); else knownInstalled = localStorage.getItem(INSTALLED_KEY) === "1"; } catch { /* optional */ }

  // ---- Stay inside /sync/ ----
  const toSync = link => {
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin === location.origin && url.pathname === "/messages.html") link.href = HOME + url.search + url.hash;
  };
  if (inSyncApp) {
    document.addEventListener("click", event => { const link = event.target.closest?.("a[href]"); if (link && (!link.target || link.target === "_self")) toSync(link); }, true);
    const fixLinks = () => document.querySelectorAll('a[href^="messages.html"], a[href^="/messages.html"]').forEach(toSync);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixLinks, { once: true }); else fixLinks();
  }

  // ---- Install ----
  let deferred = null, dialog = null, waited = false, waitTimer = 0, added = false;
  if (inSyncApp) {
    addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferred = event; if (dialog?.open) render(); });
    addEventListener("appinstalled", () => {
      deferred = null; added = true; knownInstalled = true;
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* optional */ }
      if (dialog?.open) render();
    });
  }
  async function installedRelatedApp() {
    if (typeof navigator.getInstalledRelatedApps !== "function") return false;
    try { return (await navigator.getInstalledRelatedApps()).some(app => app?.platform === "webapp" && /\/sync\.webmanifest$/.test(String(app.url || ""))); }
    catch { return false; }
  }
  const chromeIntent = () => `intent://${location.host}${HOME}?install=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(`${location.origin}${HOME}?install=1`)};end`;

  // One state at a time, most certain first.
  function currentState() {
    if (inInstalledSync()) return "installed-here";
    if (added) return "added";
    if (deferred) return "prompt";
    if (knownInstalled) return "known-installed";
    if (standalone()) return "other-app"; // inside the DanzStak app: install from the browser instead
    if (!waited) return "waiting";
    return "steps";
  }
  const COPY = {
    "installed-here": ["SYNC is installed on this phone", "You're in the SYNC app. Same account as DanzStak, no second login."],
    added: ["SYNC is on your home screen", "Open it from the SYNC icon. Same account, no second login."],
    prompt: ["Get SYNC as its own app", "Its own icon on your home screen, straight to your chats. Same account, no second login."],
    "known-installed": ["SYNC is already on this phone", "Open it from the SYNC icon on your home screen."],
    "other-app": ["Install SYNC from your browser", "Apps can't install other apps, so this step happens in your browser."],
    waiting: ["Get SYNC as its own app", "Getting SYNC ready…"],
    steps: ["Get SYNC as its own app", "Its own icon on your home screen, straight to your chats. Same account, no second login."]
  };
  function stepsFor(state) {
    if (state === "other-app") return isIOS
      ? ["Open danzstak.com/sync in Safari.", "Tap Share.", "Tap Add to Home Screen."]
      : isAndroid ? [] : ["Open danzstak.com/sync in your browser.", "Use its install icon in the address bar, or its menu → Install SYNC."];
    if (state !== "steps") return [];
    if (isIOS) return ["Tap Share.", "Tap Add to Home Screen."];
    if (isAndroid) return ["Tap ⋮ at the top right of Chrome.", "Tap Install app (or Add to Home screen)."];
    return ["Use the install icon in the address bar, or the browser menu → Install SYNC."];
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.id = "syncInstallDialog";
    dialog.className = "call-setup-dialog sync-install-dialog";
    dialog.setAttribute("aria-labelledby", "syncInstallTitle");
    dialog.innerHTML = '<header><h2 id="syncInstallTitle"></h2><button type="button" class="call-setup-close" data-icon="close"></button></header>'
      + '<div class="sync-install-body"><img class="sync-install-icon" src="assets/sync-icon-192.png?v=1" alt="" width="72" height="72">'
      + '<p class="sync-install-text" role="status"></p><ol class="sync-install-steps"></ol>'
      + '<button type="button" class="sync-install-primary"></button><a class="sync-install-link" rel="noopener"></a></div>';
    dialog.querySelector(".call-setup-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => clearTimeout(waitTimer));
    dialog.querySelector(".sync-install-primary").addEventListener("click", primaryAction);
    document.body.appendChild(dialog);
    window.danzstakIcons?.enhance?.(dialog);
  }
  function render() {
    if (!dialog) return;
    const state = currentState(), [headline, text] = COPY[state];
    dialog.dataset.state = state;
    dialog.querySelector("h2").textContent = t(headline);
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector(".sync-install-text").textContent = t(text);
    const steps = stepsFor(state), list = dialog.querySelector(".sync-install-steps");
    list.replaceChildren(...steps.map(step => { const item = document.createElement("li"); item.textContent = t(step); return item; }));
    list.hidden = !steps.length;
    const primary = dialog.querySelector(".sync-install-primary");
    primary.hidden = state === "waiting" || state === "other-app";
    primary.textContent = t(state === "prompt" ? "Install SYNC" : "Done");
    primary.dataset.action = state === "prompt" ? "install" : "close";
    const link = dialog.querySelector(".sync-install-link");
    link.hidden = !(state === "other-app" && isAndroid);
    if (!link.hidden) { link.href = chromeIntent(); link.textContent = t("Open in Chrome to install"); }
  }
  async function primaryAction(event) {
    if (event.currentTarget.dataset.action !== "install" || !deferred) { dialog.close(); return; }
    const prompt = deferred; deferred = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") added = true;
    } catch { /* the browser refused: fall back to the steps */ }
    waited = true; render();
  }
  function openInstall() {
    if (!inSyncApp) { location.href = `${HOME}?install=1`; return; } // SYNC's own page, where SYNC's manifest applies
    ensureDialog();
    waited = false; render();
    if (!dialog.open) dialog.showModal();
    clearTimeout(waitTimer);
    // Browsers fire their install offer shortly after load; if none comes, show the phone's own steps.
    if (currentState() === "waiting") waitTimer = setTimeout(() => { waited = true; render(); }, 1500);
    if (!knownInstalled && !deferred) installedRelatedApp().then(yes => { if (yes) { knownInstalled = true; render(); } });
  }

  window.danzstakSyncApp = Object.freeze({ openInstall, inSyncApp, home: HOME });
  if (inSyncApp && new URLSearchParams(location.search).get("install") === "1") {
    const params = new URLSearchParams(location.search); params.delete("install");
    history.replaceState(history.state, "", `${HOME}${params.size ? `?${params}` : ""}${location.hash}`);
    const start = () => openInstall();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  }
})();
