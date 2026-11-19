"use strict";
// SYNC as its own app (task 16-G). The installed "SYNC by DanzStak" app starts straight in the chat list
// (sync.webmanifest start_url); this page is its install/landing page. Same origin and session, so no second login.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) { location.replace("messages.html?app=sync"); return; }
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  const install = document.getElementById("syncInstall");
  let deferred = null;
  addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferred = event; install.hidden = false; });
  install.addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; install.hidden = true; });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) document.getElementById("syncInstallIos").hidden = false;
})();
