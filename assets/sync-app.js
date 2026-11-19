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
  const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua);
  const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

  // Which installed app is this window? A standalone window's first page tells: the SYNC app starts at /sync/. A SYNC icon
  // (SYNC's own app, or DanzStak's SYNC shortcut dragged to the home screen) always opens /sync/?app=sync.
  const startParams = new URLSearchParams(location.search);
  const fromSyncIcon = inSyncApp && startParams.get("app") === "sync";
  let launchApp = "";
  try {
    launchApp = sessionStorage.getItem(LAUNCH_KEY) || "";
    if (standalone() && (fromSyncIcon || !launchApp)) { launchApp = inSyncApp ? "sync" : "danzstak"; sessionStorage.setItem(LAUNCH_KEY, launchApp); }
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
      placeVerifiedInstall();
    });
  }
  async function installedRelatedApp() {
    if (typeof navigator.getInstalledRelatedApps !== "function") return false;
    try { return (await navigator.getInstalledRelatedApps()).some(app => app?.platform === "webapp" && /\/sync\.webmanifest$/.test(String(app.url || ""))); }
    catch { return false; }
  }
  // Sign-up's "Set up SYNC" (owner 2026-11-19: "it needs to be easy to verify the device and save the app"): SYNC's page
  // with ?install=1&device=register saves the app first, then goes straight into verifying the number (call-devices.js
  // waits for afterInstall()). An iPhone keeps a home-screen app's storage apart from Safari's, so there the number is
  // verified inside the SYNC icon instead (its first open goes straight to it, below).
  const verifyAfter = inSyncApp && startParams.get("install") === "1" && startParams.get("device") === "register";
  const verifyInApp = isIOS && !standalone();

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
    // Inside the DanzStak app, Android saves SYNC from DanzStak's own icon: its SYNC shortcut opens SYNC inside DanzStak.
    "other-app": isAndroid ? ["Save SYNC to your home screen", "SYNC opens inside DanzStak, straight to your chats."]
      : ["Install SYNC from your browser", "Apps can't install other apps, so this step happens in your browser."],
    waiting: ["Get SYNC as its own app", "Getting SYNC ready…"],
    steps: ["Get SYNC as its own app", "Its own icon on your home screen, straight to your chats. Same account, no second login."]
  };
  function stepsFor(state) {
    if (state === "other-app") return isIOS
      ? ["Open danzstak.com/sync in Safari.", "Tap Share.", "Tap Add to Home Screen."]
      : isAndroid ? ["Press and hold the DanzStak icon on your home screen.", "Drag SYNC to an empty spot."]
      : ["Open danzstak.com/sync in your browser.", "Use its install icon in the address bar, or its menu → Install SYNC."];
    if (state !== "steps") return [];
    if (isIOS) return ["Tap Share.", "Tap Add to Home Screen.", ...(verifyAfter ? ["Open SYNC from your home screen to verify your number."] : [])];
    if (isAndroid) return ["Tap ⋮ at the top right of Chrome.", "Tap Install app (or Add to Home screen)."];
    if (isMacSafari) return ["In Safari's menu bar, choose File → Add to Dock."];
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
      + '<button type="button" class="sync-install-primary"></button></div>';
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
    primary.hidden = state === "waiting";
    const next = state !== "prompt" && verifyAfter && !verifyInApp; // sign-up's flow carries on to the number
    primary.textContent = t(state === "prompt" ? "Install SYNC" : next ? "Next: verify your number" : "Done");
    primary.toggleAttribute("data-next", next);
    primary.dataset.action = state === "prompt" ? "install" : "close";
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

  // ---- T3 (owner 2026-11-19): right after this device registers for SYNC calls, offer SYNC as its own app once ----
  // "Save the SYNC app to your home screen": Save app / Not now. Never inside the SYNC app, never once SYNC is installed,
  // never after two "Not now", and never in the way of a call (registering to answer one goes straight to the call).
  // The "set up this phone" flow (phone-setup.js) waits until this closes.
  const OFFER_DISMISSED = "danzstak_sync_offer_dismissed";
  let offer = null, offerClosed = Promise.resolve();
  const dismissals = () => { try { return Number(localStorage.getItem(OFFER_DISMISSED) || 0); } catch { return 0; } };
  const inCall = () => Boolean(document.body?.dataset.callMode) || /[?&](invite|invited|answer|callId)=/.test(location.search) || document.getElementById("incomingCall")?.hidden === false;
  function offerApp() {
    if (inInstalledSync() || knownInstalled || added || dismissals() >= 2 || inCall() || offer?.open || verifyAfter) return false;
    if (!offer) {
      offer = document.createElement("dialog");
      offer.id = "syncAppOffer";
      offer.className = "call-setup-dialog sync-install-dialog sync-app-offer";
      offer.setAttribute("aria-labelledby", "syncAppOfferTitle");
      offer.innerHTML = '<header><h2 id="syncAppOfferTitle"></h2></header><div class="sync-install-body"><img class="sync-install-icon" src="assets/sync-icon-192.png?v=1" alt="" width="72" height="72">'
        + '<p class="sync-install-text"></p><button type="button" class="sync-install-primary" data-action="install"></button><button type="button" class="sync-install-primary sync-offer-later" data-action="close"></button></div>';
      offer.querySelector('[data-action="install"]').addEventListener("click", () => { offer.close(); installSync({ resumeSetup: true }); });
      offer.querySelector(".sync-offer-later").addEventListener("click", () => {
        try { localStorage.setItem(OFFER_DISMISSED, String(dismissals() + 1)); } catch { /* optional */ }
        offer.close();
      });
      offer.addEventListener("cancel", event => { event.preventDefault(); offer.querySelector(".sync-offer-later").click(); });
      document.body.appendChild(offer);
    }
    // F16 (owner 2026-11-19): "Save the SYNC app to your home screen" — Save app / Not now.
    offer.querySelector("h2").textContent = t("Save the SYNC app to your home screen");
    offer.querySelector(".sync-install-text").textContent = t("Get a SYNC icon on your home screen, straight to your chats.");
    offer.querySelector('[data-action="install"]').textContent = t("Save app");
    offer.querySelector(".sync-offer-later").textContent = t("Not now");
    offerClosed = new Promise(resolve => offer.addEventListener("close", () => resolve(), { once: true }));
    offer.showModal();
    return true;
  }
  // One tap: SYNC's own install prompt when this page has it; otherwise the phone's own steps, or SYNC's page (where its
  // own manifest applies) when this is the main DanzStak page.
  async function installSync({ resumeSetup = false } = {}) {
    if (inSyncApp && deferred) {
      const prompt = deferred; deferred = null;
      try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice?.outcome === "accepted") { added = true; knownInstalled = true; } } catch { /* fall back to the sheet */ }
      if (added) placeVerifiedInstall(); else openInstall();
      return;
    }
    if (inSyncApp) openInstall(); // no prompt (iPhone, or the browser has not offered one): the phone's own steps
    else location.href = `${HOME}?install=1${resumeSetup ? "&setup=1" : ""}`; // setup continues there after the offer
  }

  // F16 (owner 2026-11-19): "right under the verification text". Once this device is registered, the same choice stays
  // directly under "This device is registered for calls and voice messages." until SYNC is installed — after "Not now"
  // too. Never inside the installed SYNC app.
  function placeVerifiedInstall() {
    const status = document.getElementById("deviceStatus");
    let button = document.getElementById("syncVerifiedInstall");
    const show = Boolean(status && document.body?.classList.contains("sync-device-registered") && !inInstalledSync() && !knownInstalled && !added);
    if (!show) { if (button) button.hidden = true; return; }
    if (!button) {
      button = document.createElement("button");
      button.type = "button"; button.id = "syncVerifiedInstall"; button.className = "sync-verified-install";
      button.addEventListener("click", () => installSync());
    }
    button.textContent = t("Add SYNC to home screen");
    if (status.nextElementSibling !== button) status.after(button);
    button.hidden = false;
  }
  const watchRegistered = () => {
    placeVerifiedInstall();
    if (document.body) new MutationObserver(placeVerifiedInstall).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    installedRelatedApp().then(found => { if (found) { knownInstalled = true; placeVerifiedInstall(); } });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchRegistered, { once: true }); else watchRegistered();
  addEventListener("danzstak:call-device-registered", () => { placeVerifiedInstall(); setTimeout(offerApp, 150); });
  // Arrived from the offer on messages.html: once the install sheet closes, carry on with "set up this phone".
  if (inSyncApp && new URLSearchParams(location.search).get("setup") === "1") {
    const params = new URLSearchParams(location.search); params.delete("setup");
    history.replaceState(history.state, "", `${HOME}${params.size ? `?${params}` : ""}${location.hash}`);
    const resume = () => { const sheet = document.getElementById("syncInstallDialog"); if (sheet?.open) sheet.addEventListener("close", () => window.danzstakPhoneSetup?.open?.(), { once: true }); else window.danzstakPhoneSetup?.open?.(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(resume, 300), { once: true }); else setTimeout(resume, 300);
  }

  // The SYNC icon's first open on a device that isn't verified yet goes straight to "verify your number", once.
  const FIRST_RUN_KEY = "danzstak_sync_first_run";
  if (inInstalledSync() && !inCall() && startParams.get("device") !== "register") {
    let first = false;
    try { first = localStorage.getItem(FIRST_RUN_KEY) !== "1"; localStorage.setItem(FIRST_RUN_KEY, "1"); } catch { /* optional */ }
    if (first) { const params = new URLSearchParams(location.search); params.set("device", "register"); history.replaceState(history.state, "", `${HOME}?${params}${location.hash}`); }
  }

  // call-devices.js asks before it opens "verify your number" from ?device=register: after the install sheet, and not in
  // iPhone Safari during sign-up's flow (the SYNC icon verifies instead).
  let afterInstall = Promise.resolve(true);
  window.danzstakSyncApp = Object.freeze({ openInstall, inSyncApp, home: HOME, offerApp, offerClosed: () => offerClosed, afterInstall: () => afterInstall });
  if (inSyncApp && new URLSearchParams(location.search).get("install") === "1") {
    const params = new URLSearchParams(location.search); params.delete("install");
    history.replaceState(history.state, "", `${HOME}${params.size ? `?${params}` : ""}${location.hash}`);
    let closed = () => {};
    afterInstall = new Promise(resolve => { closed = () => resolve(!(verifyAfter && verifyInApp)); });
    const start = () => { openInstall(); dialog.addEventListener("close", closed, { once: true }); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  }
})();
