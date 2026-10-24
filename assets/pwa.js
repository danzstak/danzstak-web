"use strict";

let installPrompt = null;
let installDismissTimer = null;
const installShownKey = "danzstak_install_prompt_shown";
const signedInPage = /(?:feed|profile)\.html$/i.test(window.location.pathname);
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DANZSTAK";
installButton.hidden = true;
document.body.appendChild(installButton);

function showInstallButtonTemporarily() {
  if (!signedInPage || sessionStorage.getItem(installShownKey) === "1") return;
  sessionStorage.setItem(installShownKey, "1");
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

const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (isiOS && !standalone) showInstallButtonTemporarily();
