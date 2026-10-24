"use strict";

const status = document.getElementById("profileStatus");
const content = document.getElementById("profileContent");

function firstString(source, keys) {
  for (const key of keys) {
    if (typeof source?.[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return "";
}

async function loadProfile() {
  try {
    const response = await fetch("https://api.danzstak.com/auth/session", {
      credentials: "include",
      cache: "no-store"
    });

    if (response.status === 401) {
      window.location.replace("./");
      return;
    }

    if (!response.ok) throw new Error("Session unavailable");

    const data = await response.json();
    const profile = data.user || data.claims || data.profile || data;
    const email = firstString(profile, ["email", "username"]);
    const name = firstString(profile, ["name", "displayName", "given_name", "preferred_username"]) || (email ? email.split("@")[0] : "DanzStak Member");
    const handle = firstString(profile, ["preferred_username", "username"]) || name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "member";

    document.getElementById("profileName").textContent = name;
    document.getElementById("profileHandle").textContent = "@" + handle;
    document.getElementById("profileEmail").textContent = email || "Not available";
    document.getElementById("profileInitial").textContent = name.charAt(0).toUpperCase() || "D";
    status.hidden = true;
    content.hidden = false;
    window.dispatchEvent(new CustomEvent("danzstak:profile-loaded"));
  } catch (error) {
    status.textContent = "Unable to load your profile. Please return to the feed and try again.";
  }
}

loadProfile();
