"use strict";

const api = "https://api.danzstak.com";
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const feedBtn = document.getElementById("feedBtn");
const status = document.getElementById("sessionStatus");
const signupBtn = document.getElementById("signupBtn");
const publicExploreBtn = document.getElementById("publicExploreBtn");
const legalConsent = document.getElementById("legalConsent");
const legalAgreement = document.getElementById("legalAgreement");
const legalVersion = "2026-10-26";

legalAgreement.addEventListener("change", () => {
  signupBtn.disabled = !legalAgreement.checked;
});

signupBtn.addEventListener("click", async () => {
  if (!legalAgreement.checked) {
    status.textContent = "You must agree to the Terms of Service and acknowledge the Privacy Policy before signing up.";
    status.hidden = false;
    legalAgreement.focus();
    return;
  }

  signupBtn.disabled = true;
  status.textContent = "Saving your agreement securely...";
  status.hidden = false;
  try {
    const response = await fetch(api + "/auth/legal-acceptance", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: legalVersion, termsAccepted: true, privacyAcknowledged: true })
    });
    if (!response.ok) throw new Error("Agreement could not be saved");
    try { localStorage.setItem("danzstak_legal_acceptance", JSON.stringify({ version: legalVersion, acceptedAt: new Date().toISOString() })); }
    catch { /* The server cookie carries the confirmed agreement. */ }
    window.location.assign(signupBtn.dataset.signupUrl);
  } catch {
    status.textContent = "Your agreement could not be saved. Please try again.";
    signupBtn.disabled = false;
  }
});

function showSession(loggedIn, message) {
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  feedBtn.hidden = !loggedIn;
  signupBtn.hidden = loggedIn;
  publicExploreBtn.hidden = loggedIn;
  legalConsent.hidden = loggedIn;
  status.textContent = message;
  status.hidden = !message;
}

async function checkSession() {
  try {
    const response = await fetch(api + "/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    if (response.status === 200) {
      const data = await response.json();

      if (data.authenticated === true) {
        try { sessionStorage.removeItem("danzstak_install_prompt_shown"); } catch { /* Optional device hint must not block sign-in. */ }
        showSession(true, "");
        window.location.replace("feed.html");
        return;
      }
    }

    if (response.status === 401) {
      const legalRequired = new URLSearchParams(location.search).get("legal") === "required";
      showSession(false, legalRequired ? "Agree to the Terms of Service and acknowledge the Privacy Policy before signing up." : "Not signed in. Click Log In or Sign Up.");
      return;
    }

    showSession(false, "Unable to verify your session. Please try again.");
  } catch (error) {
    showSession(false, "Unable to check login. Please try again.");
  }
}

logoutBtn.addEventListener("click", async () => {
  if (!confirm("Log out of your DanzStak session?")) return;

  logoutBtn.disabled = true;

  try {
    await window.danzstakDisablePush?.().catch(() => false);
    const response = await fetch(api + "/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });

    if (!response.ok) throw new Error("Logout failed");

    window.danzstakClearAccountData?.();
    showSession(false, "Logged out of your secure session.");
  } catch (error) {
    status.textContent = "Logout failed. Please try again.";
  } finally {
    logoutBtn.disabled = false;
  }
});

checkSession();
