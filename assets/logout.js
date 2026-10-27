"use strict";

async function logoutFetch(options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch("https://api.danzstak.com/auth/logout", { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === "AbortError") throw new Error("Logout took too long. Check your connection and try again."); throw error; }
    finally { clearTimeout(timer); }
}

document.addEventListener("click", async event => {
    const button = event.target.closest("[data-logout]");
    if (!button) return;
    event.preventDefault();
    if (!confirm("Log out of your DanzStak account?")) return;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    const original = button.textContent;
    button.textContent = "Logging out…";
    try {
      await window.danzstakDisablePush?.().catch(() => false);
      const response = await logoutFetch({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!response.ok) throw new Error("Logout failed");
      window.danzstakClearAccountData?.();
      location.replace("./");
    } catch (error) {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.textContent = original;
      alert(error.message || "Logout failed. Please try again.");
    }
});
