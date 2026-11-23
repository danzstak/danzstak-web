"use strict";

let installPrompt = null;
let installDismissTimer = null;
let updateDismissTimer = null;
let automaticInstallPromptShown = false;
const installStateKey = "danzstak_app_installed";
// Task 34: /sync/ is SYNC's own installable app. There its install offer belongs to SYNC (sync-app.js), and a standalone
// window there may be the SYNC app, so it must not mark DanzStak itself as installed.
const syncAppPage = window.location.pathname.startsWith("/sync/");
const standalone = (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) && !syncAppPage;
let knownInstalled = standalone;
try {
  knownInstalled ||= localStorage.getItem(installStateKey) === "1";
  if (standalone) localStorage.setItem(installStateKey, "1");
} catch { /* Install detection still works through display mode. */ }
let installedAppCheck = null;
async function detectInstalledDanzStak(recheck = false) {
  if (knownInstalled && !recheck) return true;
  if (recheck) installedAppCheck = null;
  if (installedAppCheck) return installedAppCheck;
  installedAppCheck = (async () => {
    if (typeof navigator.getInstalledRelatedApps !== "function") return false;
    try {
      const apps = await navigator.getInstalledRelatedApps();
      const installed = apps.some(app => app?.platform === "webapp");
      if (installed) {
        knownInstalled = true;
        try { localStorage.setItem(installStateKey, "1"); } catch { /* Storage is optional. */ }
      } else if (recheck && !standalone) {
        knownInstalled = false;
        try { localStorage.removeItem(installStateKey); } catch { /* Storage is optional. */ }
      }
      return installed;
    } catch {
      return false;
    }
  })();
  return installedAppCheck;
}
const signedInPage = syncAppPage || /(?:feed|profile|messages)\.html$/i.test(window.location.pathname);
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DanzStak";
installButton.hidden = true;
// Fix-it 18 (owner 2026-11-18): no install arrow in any signed-in top bar; install lives in Menu → Install DanzStak,
// which clicks this (never visible) button. The signed-out homepage keeps its own install links.
if (signedInPage) installButton.style.setProperty("display", "none", "important");
const updateButton = document.createElement("button");
updateButton.type = "button";
updateButton.className = "app-update-button";
updateButton.textContent = "Update DanzStak";
updateButton.hidden = true;
const appPromptAnchor = document.querySelector("body > header");
const appPromptHost = signedInPage && appPromptAnchor
  ? appPromptAnchor.querySelector(".topnav, .header-actions, :scope > div:last-child")
  : null;
const headerPromptQuery = window.matchMedia("(min-width: 701px)");
function placeAppPrompts() {
  const useHeader = Boolean(appPromptHost && headerPromptQuery.matches);
  for (const button of [installButton, updateButton]) {
    button.classList.toggle("app-header-prompt", useHeader);
    button.classList.toggle("button", useHeader);
  }
  if (useHeader) {
    appPromptHost.append(installButton, updateButton);
  } else if (appPromptAnchor) {
    appPromptAnchor.insertAdjacentElement("afterend", updateButton);
    appPromptAnchor.insertAdjacentElement("afterend", installButton);
  } else {
    document.body.prepend(updateButton);
    document.body.prepend(installButton);
  }
}
placeAppPrompts();
headerPromptQuery.addEventListener?.("change", placeAppPrompts);
let waitingWorker = null;
let safeUpdateTimer = null;
let memberAskedUpdate = false;

function hasPendingUserWork() {
  const draft = document.querySelector("#postText, #messageInput");
  const incomingCall = document.getElementById("incomingCall");
  return Boolean(
    draft?.value.trim() ||
    window.danzstakSelectedMedia ||
    document.body.dataset.callMode ||
    (incomingCall && !incomingCall.hidden)
  );
}

// Owner 2026-11-23 ("Update is hanging"): the old worker was busy re-downloading the whole app (7 MB, no-store) every
// time the app came back to the front, and the browser waits for the old worker to finish before the new one takes over.
// So: the old worker is told to stop that refresh, a refresh never starts while an update is pending (refreshOfflineShell),
// and the button never stays on "Updating…": a worker that's replaced while waiting hands over to its replacement.
function activateWaitingWorker(worker) {
  if (!worker) return;
  clearTimeout(safeUpdateTimer);
  updateButton.disabled = true;
  updateButton.textContent = "Updating…";
  navigator.serviceWorker.controller?.postMessage({ type: "STOP_SHELL_REFRESH" });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function resetUpdateButton() {
  updateButton.disabled = false;
  updateButton.textContent = "Update DanzStak";
}

function scheduleSafeUpdate(worker) {
  clearTimeout(safeUpdateTimer);
  if (!/(?:feed|messages)\.html$/i.test(window.location.pathname)) return;
  safeUpdateTimer = setTimeout(() => {
    if (waitingWorker !== worker || document.visibilityState !== "visible" || hasPendingUserWork()) return;
    activateWaitingWorker(worker);
  }, 3000);
}

function offerUpdate(worker) {
  if (!worker) return;
  if (worker === waitingWorker && !updateButton.hidden) return;
  waitingWorker = worker;
  resetUpdateButton();
  worker.addEventListener("statechange", () => {
    if (worker.state !== "redundant" || waitingWorker !== worker) return;
    // A newer version replaced this one while it waited: offer that one, or stand down.
    waitingWorker = null;
    resetUpdateButton();
    clearTimeout(safeUpdateTimer);
    navigator.serviceWorker.getRegistration().then(registration => {
      if (!registration?.waiting) { updateButton.hidden = true; return; }
      offerUpdate(registration.waiting);
      if (memberAskedUpdate) activateWaitingWorker(registration.waiting); // they already tapped Update
    }).catch(() => { updateButton.hidden = true; });
  });
  clearTimeout(installDismissTimer);
  clearTimeout(updateDismissTimer);
  installButton.hidden = true;
  updateButton.hidden = false;
  updateButton.classList.remove("app-update-button--leaving");
  updateDismissTimer = setTimeout(() => {
    updateButton.classList.add("app-update-button--leaving");
    setTimeout(() => {
      updateButton.hidden = true;
      updateButton.classList.remove("app-update-button--leaving");
    }, 250);
  }, 15000);
  scheduleSafeUpdate(worker);
}

updateButton.addEventListener("click", () => {
  clearTimeout(updateDismissTimer);
  memberAskedUpdate = true;
  activateWaitingWorker(waitingWorker);
});

function showInstallButtonTemporarily() {
  if (!signedInPage || knownInstalled || waitingWorker || automaticInstallPromptShown) return;
  automaticInstallPromptShown = true;
  installButton.hidden = false;
  installButton.classList.remove("install-app-button--leaving");
  clearTimeout(installDismissTimer);
  installDismissTimer = setTimeout(() => {
    installButton.classList.add("install-app-button--leaving");
    setTimeout(() => {
      installButton.hidden = true;
      installButton.classList.remove("install-app-button--leaving");
    }, 250);
  }, 15000);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Version the registration URL as well as the app script. An older
      // cache-first worker can otherwise keep a phone on new HTML plus retired
      // CSS until every PWA window has been closed.
      const registration = await navigator.serviceWorker.register("/service-worker.js?pwa=431", { updateViaCache: "none" });
      if (registration.waiting) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(registration.waiting || installing);
        });
      });
      const checkForUpdate = () => registration.update().catch(() => {});
      // Keep the offline copy fresh only when no update is on its way: the update brings the new files itself, and a
      // refresh by the old worker makes the update wait for it.
      const refreshOfflineShell = () => {
        if (registration.installing || registration.waiting || waitingWorker) return;
        navigator.serviceWorker.controller?.postMessage({ type: "REFRESH_SHELL", allow: navigator.connection?.saveData !== true });
      };
      const checkThenRefresh = () => checkForUpdate().then(refreshOfflineShell);
      checkThenRefresh();
      setInterval(checkForUpdate, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkThenRefresh();
          if (waitingWorker) scheduleSafeUpdate(waitingWorker);
        }
      });
    } catch (error) {
      console.warn("DanzStak app updates are temporarily unavailable.", error);
    }
  });
  let refreshingForUpdate = false;
  // A first visit has no worker yet; when the first one takes over the page is already current, so it doesn't reload
  // (it used to, seconds after landing, over whatever a new visitor was typing into sign-up).
  const updatingFromOlderVersion = Boolean(navigator.serviceWorker.controller);
  // The new version took over: reload into it. An update the member didn't tap never reloads over a draft, a picked photo
  // or a call: it reloads once the member is done (checked every few seconds).
  const reloadIntoUpdate = () => {
    if (refreshingForUpdate || (!memberAskedUpdate && hasPendingUserWork())) return false;
    refreshingForUpdate = true;
    location.reload();
    return true;
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updatingFromOlderVersion) return;
    if (reloadIntoUpdate()) return;
    const retry = setInterval(() => { if (reloadIntoUpdate()) clearInterval(retry); }, 5000);
  });
}

window.addEventListener("beforeinstallprompt", event => {
  if (syncAppPage) return; // SYNC's own install sheet takes it (sync-app.js)
  event.preventDefault();
  installPrompt = event;
  void detectInstalledDanzStak(true).then(installed => {
    if (installed) {
      installPrompt = null;
      installButton.hidden = true;
      return;
    }
    knownInstalled = false;
    try { localStorage.removeItem(installStateKey); } catch { /* Storage is optional. */ }
    showInstallButtonTemporarily();
  });
});

window.danzstakRequestInstall = async () => {
  if (knownInstalled || await detectInstalledDanzStak()) return "installed";
  if (!installPrompt) return "manual";
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  clearTimeout(installDismissTimer);
  installButton.hidden = true;
  return choice.outcome;
};
installButton.addEventListener("click", async () => {
  const result = await window.danzstakRequestInstall();
  if (result === "manual") window.danzstakShowFeedback?.("Use your browser's Install option. On iPhone or iPad, open Share and choose Add to Home Screen.", { timeout: 7000 });
});

window.addEventListener("appinstalled", () => {
  if (syncAppPage) return; // that was SYNC, not DanzStak
  knownInstalled = true;
  try { localStorage.setItem(installStateKey, "1"); } catch { /* Display mode remains authoritative. */ }
  clearTimeout(installDismissTimer);
  installButton.hidden = true;
});

window.addEventListener("danzstak:show-install", () => {
  if (syncAppPage) return;
  void detectInstalledDanzStak().then(installed => {
    if (installed) return;
    automaticInstallPromptShown = false;
    showInstallButtonTemporarily();
  });
});

if (!knownInstalled && signedInPage && !syncAppPage) {
  void detectInstalledDanzStak().then(installed => {
    if (!installed) showInstallButtonTemporarily();
  });
}
