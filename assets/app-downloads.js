"use strict";

const installHelp = document.getElementById("installHelp");
const installHelpTitle = document.getElementById("installHelpTitle");
const installHelpText = document.getElementById("installHelpText");
const installHelpAction = document.getElementById("installHelpAction");
const installHelpClose = document.getElementById("installHelpClose");
// Browsers that can't install (DuckDuckGo, apps' own browsers; pwa.js) get the steps to Chrome or Safari, Copy link and a note.
const installHelpSteps = document.createElement("ol");
const installHelpNote = document.createElement("p");
const installHelpCopy = document.createElement("button");
installHelpSteps.className = "install-help-steps";
installHelpNote.className = "install-help-note";
installHelpNote.setAttribute("role", "status");
installHelpCopy.type = "button";
installHelpCopy.id = "installHelpCopy";
installHelpCopy.dataset.iconLayout = "label"; // keeps its words (icon-buttons.js would make "Copy link" a bare icon)
installHelpSteps.hidden = true;
installHelpCopy.hidden = true;
installHelpText.after(installHelpSteps, installHelpNote);
installHelpClose.before(installHelpCopy);

function openInstallHelp(platform) {
  const apple = platform === "apple", elsewhere = window.danzstakInstallElsewhere;
  installHelpNote.textContent = "";
  if (elsewhere) {
    const content = elsewhere.content("DanzStak");
    installHelp.dataset.mode = "elsewhere";
    installHelpTitle.textContent = content.title;
    installHelpText.textContent = content.text;
    installHelpSteps.replaceChildren(...content.steps.map(step => { const item = document.createElement("li"); item.textContent = step; return item; }));
    installHelpSteps.hidden = false;
    installHelpAction.textContent = content.open;
    installHelpAction.hidden = !content.open;
    installHelpCopy.textContent = content.copy;
    installHelpCopy.hidden = false;
    installHelpClose.textContent = window.danzstakTranslate?.("Close") || "Close";
    installHelp.showModal();
    return;
  }
  delete installHelp.dataset.mode;
  installHelpSteps.hidden = true;
  installHelpCopy.hidden = true;
  installHelpAction.textContent = "Install now";
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
  const elsewhere = window.danzstakInstallElsewhere;
  if (installHelp.dataset.mode === "elsewhere" && elsewhere) {
    if (!await elsewhere.openChrome()) installHelpNote.textContent = elsewhere.notOpened();
    return;
  }
  const result = await window.danzstakRequestInstall?.();
  if (result === "accepted" || result === "installed") {
    installHelp.close();
    return;
  }
  installHelpText.textContent = "Open your browser menu and choose Install app or Add to Home screen. DanzStak will continue to update from danzstak.com.";
  installHelpAction.hidden = true;
});

installHelpCopy.addEventListener("click", async () => {
  const elsewhere = window.danzstakInstallElsewhere;
  if (elsewhere) installHelpNote.textContent = await elsewhere.copy();
});

installHelpClose.addEventListener("click", () => installHelp.close());
// The signed-in Menu has one "Install DanzStak" item (owner 2026-11-18: separate Android/Apple items were redundant);
// on iPhone/iPad it opens these Add to Home Screen steps.
window.danzstakOpenInstallHelp = () => openInstallHelp(isAppleMobile ? "apple" : "android");
window.danzstakIsAppleMobile = isAppleMobile;
