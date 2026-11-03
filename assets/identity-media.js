"use strict";
(() => {
  const pendingProfiles = new Map();

  function memberId(value) {
    const id = String(value || "").trim();
    return /^[a-f0-9-]{36}$/.test(id) ? id : "";
  }

  function initial(person) {
    return String(person?.name || person?.displayName || "D").trim().charAt(0).toUpperCase() || "D";
  }

  async function fetchFreshProfile(person) {
    const id = memberId(person?.memberId || person?.authorMemberId);
    const email = !id ? String(person?.email || person?.contactEmail || "").trim().toLowerCase() : "";
    if (!id && !email) return null;
    const key = id ? "member:" + id : "email:" + email;
    if (pendingProfiles.has(key)) return pendingProfiles.get(key);
    const request = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const query = id ? "member=" + encodeURIComponent(id) : "email=" + encodeURIComponent(email);
        const response = await fetch("https://api.danzstak.com/profiles?" + query, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.profile || data;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    pendingProfiles.set(key, request);
    try { return await request; }
    finally { pendingProfiles.delete(key); }
  }

  function replaceWithInitial(image, person) {
    if (!image?.isConnected) return;
    const fallback = document.createElement("span");
    fallback.className = image.className;
    fallback.textContent = initial(person);
    fallback.setAttribute("aria-hidden", "true");
    image.replaceWith(fallback);
  }

  function install(image, person) {
    if (!image || image.tagName !== "IMG") return image;
    image.referrerPolicy = "no-referrer";
    let attempted = false;
    image.addEventListener("error", async () => {
      if (attempted) { replaceWithInitial(image, person); return; }
      attempted = true;
      const failedUrl = image.currentSrc || image.src;
      const profile = await fetchFreshProfile(person);
      const freshUrl = String(profile?.picture || "");
      if (!image.isConnected) return;
      if (!freshUrl || freshUrl === failedUrl) { replaceWithInitial(image, person); return; }
      image.src = freshUrl;
    });
    return image;
  }

  window.danzstakIdentityMedia = Object.freeze({ install });
})();
