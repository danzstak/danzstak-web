"use strict";
// SYNC as its own app (task 16-G; task 34). SYNC now lives under /sync/ with its own manifest scope, so it installs as
// its own app next to DanzStak. This older page forwards there: the installed app straight to the chats, everyone else
// to the install sheet. Same origin and session, so no second login.
(() => {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) { location.replace("/sync/?app=sync"); return; }
  location.replace("/sync/?install=1");
})();
