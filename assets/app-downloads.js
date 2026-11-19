"use strict";

const installHelp = document.getElementById("installHelp");
const installHelpTitle = document.getElementById("installHelpTitle");
const installHelpText = document.getElementById("installHelpText");
const installHelpAction = document.getElementById("installHelpAction");
const installHelpClose = document.getElementById("installHelpClose");

function openInstallHelp(platform) {
  const apple = platform === "apple";
  installHelpTitle.textContent = apple ? "Install DanzStak on Apple" : "Install DanzStak on Android";
  installHelpText.textContent = apple
    ? "On iPhone or iPad, open this page in Safari, tap Share, then choose Add to Home Screen. DanzStak installs from danzstak.com and updates automatically."
    : "Install DanzStak directly from danzstak.com. If your browser does not show an install prompt, open its menu and choose Install app or Add to Home screen.";
  installHelpAction.hidden = apple;
  installHelp.showModal();
}

// Owner directive 2026-11-16: the install buttons install the DanzStak PWA to the home screen.
// Where the browser supports one-tap install (Android/desktop Chrome, Edge), the button opens the
// native install prompt directly; iPhone/iPad (Safari has no install prompt) get the Add to Home Screen steps.
const isAppleMobile = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
document.querySelectorAll("[data-app-platform]").forEach(link => {
  link.addEventListener("click", async event => {
    event.preventDefault();
    if (!isAppleMobile && typeof window.danzstakRequestInstall === "function") {
      const result = await window.danzstakRequestInstall();
      if (result === "accepted" || result === "dismissed") return;
      if (result === "installed") { window.danzstakShowFeedback?.("DanzStak is already installed on this device.", { timeout: 4000 }); return; }
    }
    openInstallHelp(isAppleMobile ? "apple" : link.dataset.appPlatform);
  });
});

installHelpAction.addEventListener("click", async () => {
  const result = await window.danzstakRequestInstall?.();
  if (result === "accepted" || result === "installed") {
    installHelp.close();
    return;
  }
  installHelpText.textContent = "Open your browser menu and choose Install app or Add to Home screen. DanzStak will continue to update from danzstak.com.";
  installHelpAction.hidden = true;
});

installHelpClose.addEventListener("click", () => installHelp.close());
