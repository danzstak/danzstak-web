"use strict";
(() => {
  const menuProfileName = document.getElementById("menuProfileName");
  const menuProfileImage = document.getElementById("menuProfileImage");
  const menuProfileFallback = document.getElementById("menuProfileFallback");

  function updateMenuProfile(profile = {}) {
    const name = String(profile.name || "").trim() || "My Profile";
    if (menuProfileName) menuProfileName.textContent = name;
    if (menuProfileFallback) {
      menuProfileFallback.textContent = name.charAt(0).toUpperCase() || "D";
      menuProfileFallback.hidden = false;
    }
    if (!menuProfileImage) return;
    const picture = String(profile.picture || "").trim();
    menuProfileImage.hidden = true;
    menuProfileImage.removeAttribute("src");
    if (!picture) return;
    menuProfileImage.onload = () => {
      menuProfileImage.hidden = false;
      if (menuProfileFallback) menuProfileFallback.hidden = true;
    };
    menuProfileImage.onerror = () => {
      menuProfileImage.hidden = true;
      if (menuProfileFallback) menuProfileFallback.hidden = false;
    };
    menuProfileImage.src = picture;
    window.danzstakIdentityMedia?.install(menuProfileImage, profile);
  }

  async function loadMenuIdentity() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("https://api.danzstak.com/profiles", {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) return;
      const profile = (await response.json()).profile || {};
      updateMenuProfile(profile);
    } catch {
      // Profile editing remains available if the menu identity cannot load.
    } finally {
      clearTimeout(timeout);
    }
  }

  loadMenuIdentity();
})();
