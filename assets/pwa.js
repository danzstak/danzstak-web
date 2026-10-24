"use strict";

let installPrompt = null;
const installButton = document.createElement("button");
installButton.type = "button";
installButton.className = "install-app-button";
installButton.textContent = "Install DANZSTAK";
installButton.hidden = true;
document.body.appendChild(installButton);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js"));
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
    return;
  }
  alert("On iPhone or iPad, open the Share menu and choose Add to Home Screen. On desktop, use your browser's Install option.");
});

window.addEventListener("appinstalled", () => { installButton.hidden = true; });

const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (isiOS && !standalone) installButton.hidden = false;
