"use strict";

let installPrompt = null;
let installDismissTimer = null;
const signedInPage = /(?:feed|profile|messages)\.html$/i.test(window.location.pathname);
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DanzStak";
installButton.hidden = true;
document.body.appendChild(installButton);

function showInstallButtonTemporarily() {
  if (!signedInPage || standalone) return;
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
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
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
  clearTimeout(installDismissTimer);
  installButton.hidden = true;
});

window.addEventListener("danzstak:show-install", () => {
  if (standalone) return;
  installButton.hidden = false;
  installButton.classList.remove("install-app-button--leaving");
  clearTimeout(installDismissTimer);
});

const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (!standalone && signedInPage) setTimeout(showInstallButtonTemporarily, 0);
