"use strict";

const api = "https://api.danzstak.com";
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const feedBtn = document.getElementById("feedBtn");
const status = document.getElementById("sessionStatus");

function showSession(loggedIn, message) {
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  feedBtn.hidden = !loggedIn;
  status.textContent = message;
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
        showSession(true, "Secure session active. Opening your feed...");
        window.location.replace("feed-secure-test.html");
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

    showSession(false, "Logged out of your secure session.");
  } catch (error) {
    status.textContent = "Logout failed. Please try again.";
  } finally {
    logoutBtn.disabled = false;
  }
});

checkSession();
