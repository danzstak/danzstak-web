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

document.querySelectorAll("[data-app-platform]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    openInstallHelp(link.dataset.appPlatform);
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
