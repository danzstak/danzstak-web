"use strict";

const api = "https://api.danzstak.com";
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const feedBtn = document.getElementById("feedBtn");
const status = document.getElementById("sessionStatus");
const signupBtn = document.getElementById("signupBtn");
const legalAgreement = document.getElementById("legalAgreement");
const legalVersion = "2026-10-24";

legalAgreement.addEventListener("change", () => {
  signupBtn.disabled = !legalAgreement.checked;
});

signupBtn.addEventListener("click", () => {
  if (!legalAgreement.checked) {
    status.textContent = "You must agree to the Terms of Service and acknowledge the Privacy Policy before signing up.";
    status.hidden = false;
    legalAgreement.focus();
    return;
  }

  localStorage.setItem("danzstak_legal_acceptance", JSON.stringify({
    version: legalVersion,
    acceptedAt: new Date().toISOString()
  }));

  window.location.assign(signupBtn.dataset.signupUrl);
});

function showSession(loggedIn, message) {
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  feedBtn.hidden = !loggedIn;
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
        sessionStorage.removeItem("danzstak_install_prompt_shown");
        window.location.replace("feed.html");
        return;
      }
    }

    if (response.status === 401) {
      showSession(false, "Not signed in. Click Log In or Sign Up.");
      return;
    }

    showSession(false, "Unable to verify your session. Please try again.");
  } catch (error) {
    showSession(false, "Unable to check login. Please try again.");
  }
}

logoutBtn.addEventListener("click", async () => {
  if (!confirm("Log out of your DANZSTAK session?")) return;

  logoutBtn.disabled = true;

  try {
    const response = await fetch(api + "/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });

    if (!response.ok) throw new Error("Logout failed");

    sessionStorage.removeItem("danzstak_install_prompt_shown");
    showSession(false, "Logged out of your secure session.");
  } catch (error) {
    status.textContent = "Logout failed. Please try again.";
  } finally {
    logoutBtn.disabled = false;
  }
});

checkSession();
