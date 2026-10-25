"use strict";

(() => {
  try {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", localStorage.getItem("danzstak_dark_mode") === "1");
    root.classList.toggle("reduce-motion", localStorage.getItem("danzstak_reduce_motion") === "1");
    root.lang = localStorage.getItem("danzstak_language") || "en";
  } catch {
    // Storage may be unavailable in private browsing; the default display remains usable.
  }
})();
