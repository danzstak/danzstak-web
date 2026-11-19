"use strict";

(() => {
  try {
    const root = document.documentElement;
    if (location.pathname.endsWith("/messages.html") && new URLSearchParams(location.search).get("embedded") === "1") root.classList.add("embedded-messages-document");
    root.classList.remove("dark-mode");
    localStorage.removeItem("danzstak_dark_mode");
    root.classList.toggle("reduce-motion", localStorage.getItem("danzstak_reduce_motion") === "1");
    root.lang = localStorage.getItem("danzstak_language") || navigator.language || "en";
  } catch {
    // Storage may be unavailable in private browsing; the default display remains usable.
  }
})();
