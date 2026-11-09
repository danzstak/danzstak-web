"use strict";

const api = "https://api.danzstak.com";
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const status = document.getElementById("sessionStatus");
const signupBtn = document.getElementById("signupBtn");
const legalConsent = document.getElementById("legalConsent");
const legalAgreement = document.getElementById("legalAgreement");
const legalVersion = "2026-10-26";

async function homeFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(api + path, { ...options, signal: controller.signal }); }
  catch (error) { if (error?.name === "AbortError") throw new Error("DanzStak took too long to respond. Check your connection and try again."); throw new Error("DanzStak cannot connect right now. Check your connection and try again."); }
  finally { clearTimeout(timer); }
}

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
    const response = await homeFetch("/auth/legal-acceptance", {
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
  signupBtn.hidden = loggedIn;
  legalConsent.hidden = loggedIn;
  status.textContent = message;
  status.hidden = !message;
  if (message) status.scrollIntoView?.({ block: "center", behavior: "instant" });
}

function signInMessage(params) {
  if (params.get("legal") === "required") {
    return "Agree to the Terms of Service and acknowledge the Privacy Policy before signing up.";
  }
  if (params.get("signin") === "expired") {
    return "Sign-in took too long to finish. Tap Log In to try again.";
  }
  if (params.get("signin") === "failed") {
    return "Email or password is incorrect. Check both and try again.";
  }
  if (params.get("signin") === "unavailable") {
    return "Sign-in is temporarily unavailable. Please try again.";
  }
  return "";
}

async function checkSession() {
  const params = new URLSearchParams(location.search);
  const issue = signInMessage(params);
  try {
    const response = await homeFetch("/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    if (response.status === 200) {
      const data = await response.json();

      if (data.authenticated === true) {
        try { sessionStorage.removeItem("danzstak_install_prompt_shown"); } catch { /* Optional device hint must not block sign-in. */ }
        if (issue) {
          showSession(true, issue + " Log out to use a different account.");
          return;
        }
        showSession(true, "");
        window.location.replace("feed.html");
        return;
      }
    }

    if (response.status === 401) {
      showSession(false, issue || "Not signed in. Click Log In or Sign Up.");
      return;
    }

    showSession(false, "Unable to verify your session. Please try again.");
  } catch (error) {
    showSession(false, "Unable to check login. Please try again.");
  }
}

logoutBtn.addEventListener("click", async () => {
  if (!(await window.danzstakConfirm("You will need to sign in again on this device.", { title: "Log out of DanzStak?", confirmLabel: "Log out", danger: true }))) return;

  logoutBtn.disabled = true;

  try {
    await window.danzstakDisablePush?.().catch(() => false);
    const response = await homeFetch("/auth/logout", {
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
