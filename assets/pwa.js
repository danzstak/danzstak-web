"use strict";

let installPrompt = null;
let installDismissTimer = null;
const installStateKey = "danzstak_app_installed";
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let knownInstalled = standalone;
try {
  knownInstalled ||= localStorage.getItem(installStateKey) === "1";
  if (standalone) localStorage.setItem(installStateKey, "1");
} catch { /* Install detection still works through display mode. */ }
const signedInPage = /(?:feed|profile|messages)\.html$/i.test(window.location.pathname);
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DanzStak";
installButton.hidden = true;
document.body.appendChild(installButton);

function showInstallButtonTemporarily() {
  if (!signedInPage || knownInstalled) return;
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
      const checkForUpdate = () => registration.update().catch(() => {});
      checkForUpdate();
      setInterval(checkForUpdate, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
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
  knownInstalled = false;
  try { localStorage.removeItem(installStateKey); } catch { /* Storage is optional. */ }
  installPrompt = event;
  showInstallButtonTemporarily();
});

installButton.addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    clearTimeout(installDismissTimer);
    installButton.hidden = true;
    return;
  }
  alert("On iPhone or iPad, open the Share menu and choose Add to Home Screen. On desktop, use your browser's Install option.");
});

window.addEventListener("appinstalled", () => {
  knownInstalled = true;
  try { localStorage.setItem(installStateKey, "1"); } catch { /* Display mode remains authoritative. */ }
  clearTimeout(installDismissTimer);
  installButton.hidden = true;
});

window.addEventListener("danzstak:show-install", () => {
  if (knownInstalled) return;
  installButton.hidden = false;
  installButton.classList.remove("install-app-button--leaving");
  clearTimeout(installDismissTimer);
});

if (!knownInstalled && signedInPage) setTimeout(showInstallButtonTemporarily, 0);
