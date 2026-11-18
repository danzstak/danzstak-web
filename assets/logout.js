"use strict";

async function logoutFetch(options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch("https://api.danzstak.com/auth/logout", { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === "AbortError") throw new Error("Logout took too long. Check your connection and try again."); throw new Error("DanzStak cannot log out right now. Check your connection and try again."); }
    finally { clearTimeout(timer); }
}

document.addEventListener("click", async event => {
    const button = event.target.closest("[data-logout]");
    if (!button) return;
    event.preventDefault();
    if (!(await window.danzstakConfirm("You will need to sign in again on this device.", { title: "Log out of DanzStak?", confirmLabel: "Log out", danger: true }))) return;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    const original = button.textContent;
    button.textContent = "Logging out…";
    try {
      // Owner 2026-11-18: Log out takes you straight out to the landing page. Turning off this device's push runs
      // alongside the logout and never holds it up for more than 1.5 s.
      const pushOff = Promise.race([Promise.resolve(window.danzstakDisablePush?.()).catch(() => false), new Promise(resolve => setTimeout(resolve, 1500))]);
      const response = await logoutFetch({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!response.ok) throw new Error("Logout failed");
      await pushOff;
      window.danzstakClearAccountData?.();
      location.replace("./?signedout=1");
    } catch (error) {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      button.textContent = original;
      window.danzstakShowFeedback?.(error.message || "Logout failed. Please try again.", { urgent: true });
    }
});
