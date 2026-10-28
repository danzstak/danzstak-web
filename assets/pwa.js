"use strict";

let installPrompt = null;
let installDismissTimer = null;
let updateDismissTimer = null;
const installStateKey = "danzstak_app_installed";
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
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
      const installed = apps.some(app =>
        app?.id === "com.danzstak.app" ||
        app?.platform === "webapp"
      );
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
const signedInPage = /(?:feed|profile|messages)\.html$/i.test(window.location.pathname);
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DanzStak";
installButton.hidden = true;
document.body.appendChild(installButton);
const updateButton = document.createElement("button");
updateButton.type = "button";
updateButton.className = "app-update-button";
updateButton.textContent = "Update DanzStak";
updateButton.hidden = true;
document.body.appendChild(updateButton);
let waitingWorker = null;
let safeUpdateTimer = null;

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

function activateWaitingWorker(worker) {
  if (!worker) return;
  clearTimeout(safeUpdateTimer);
  updateButton.disabled = true;
  updateButton.textContent = "Updating…";
  worker.postMessage({ type: "SKIP_WAITING" });
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
  waitingWorker = worker;
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
  activateWaitingWorker(waitingWorker);
});

function showInstallButtonTemporarily() {
  if (!signedInPage || knownInstalled || waitingWorker) return;
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
      const registration = await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
      if (registration.waiting) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(registration.waiting || installing);
        });
      });
      const checkForUpdate = () => registration.update().catch(() => {});
      checkForUpdate();
      setInterval(checkForUpdate, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkForUpdate();
          if (waitingWorker) scheduleSafeUpdate(waitingWorker);
        }
      });
    } catch (error) {
      console.warn("DanzStak app updates are temporarily unavailable.", error);
    }
  });
  let refreshingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    location.reload();
  });
}

window.addEventListener("beforeinstallprompt", event => {
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
  if (result === "manual") alert("Use your browser's Install option. On iPhone or iPad, open Share and choose Add to Home Screen.");
});

window.addEventListener("appinstalled", () => {
  knownInstalled = true;
  try { localStorage.setItem(installStateKey, "1"); } catch { /* Display mode remains authoritative. */ }
  clearTimeout(installDismissTimer);
  installButton.hidden = true;
});

window.addEventListener("danzstak:show-install", () => {
  void detectInstalledDanzStak().then(installed => {
    if (installed) return;
    installButton.hidden = false;
    installButton.classList.remove("install-app-button--leaving");
    clearTimeout(installDismissTimer);
  });
});

if (!knownInstalled && signedInPage) {
  void detectInstalledDanzStak().then(installed => {
    if (!installed) showInstallButtonTemporarily();
  });
}
