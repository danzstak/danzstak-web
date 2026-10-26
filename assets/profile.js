"use strict";

const status = document.getElementById("profileStatus");
const content = document.getElementById("profileContent");
const requestedUser = new URLSearchParams(location.search).get("user")?.trim().toLowerCase() || "";

const requestedMember = new URLSearchParams(location.search).get("member") || "";

function firstString(source, keys) {
  for (const key of keys) {
    if (typeof source?.[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return "";
}

async function loadProfile() {
  try {
    const response = await fetch("https://api.danzstak.com/profiles" + (requestedMember ? "?member=" + encodeURIComponent(requestedMember) : requestedUser ? "?email=" + encodeURIComponent(requestedUser) : ""), {
      credentials: "include",
      cache: "no-store"
    });

    if (response.status === 401) {
      window.location.replace("./");
      return;
    }

    if (response.status === 403) { status.textContent = "This profile is available to accepted friends and shared-group members."; return; }
    if (response.status === 404) { status.textContent = "This profile is no longer available."; return; }
    if (!response.ok) throw new Error("Session unavailable");

    const data = await response.json();
    const profile = data.profile || data;
    const email = firstString(profile, ["email", "username"]);
    const name = firstString(profile, ["name", "displayName", "given_name", "preferred_username"]) || (email ? email.split("@")[0] : "DanzStak Member");
    const handle = firstString(profile, ["handle", "preferred_username", "username"]) || name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "member";

    document.getElementById("profileName").textContent = name;
    document.title = (requestedUser || requestedMember) ? name + " | DanzStak" : "My Profile | DanzStak";
    document.getElementById("profileHandle").textContent = "@" + handle;
    document.getElementById("profileEmail").textContent = (requestedUser || requestedMember) ? "Private" : (email || "Not available");
    const avatar = document.getElementById("profileInitial");
    avatar.textContent = name.charAt(0).toUpperCase() || "D";
    if (profile.picture) { avatar.style.backgroundImage = `url("${profile.picture}")`; avatar.classList.add("has-photo"); avatar.textContent = ""; }
    else { avatar.style.backgroundImage = ""; avatar.classList.remove("has-photo"); }
    const cover = document.querySelector(".cover");
    if (profile.cover) {
      cover.style.backgroundImage = `url("${profile.cover}")`;
      cover.style.backgroundPosition = `${profile.coverX ?? 50}% ${profile.coverY ?? 50}%`;
      cover.style.backgroundSize = profile.coverFit ? "contain" : "cover";
      cover.style.backgroundRepeat = "no-repeat";
      cover.classList.add("has-photo");
    } else { cover.style.backgroundImage = ""; cover.classList.remove("has-photo"); }
    const message = document.getElementById("profileMessage");
    if (requestedUser || requestedMember) { message.href = "feed.html?message=" + encodeURIComponent(email); message.hidden = false; }
    status.hidden = true;
    content.hidden = false;
    window.danzstakCurrentProfile = profile;
    window.dispatchEvent(new CustomEvent("danzstak:profile-loaded", { detail: profile }));
  } catch (error) {
    status.textContent = "Unable to load your profile. Please return to the feed and try again.";
  }
}

loadProfile();
