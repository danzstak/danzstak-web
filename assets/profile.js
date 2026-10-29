"use strict";

const status = document.getElementById("profileStatus");
const content = document.getElementById("profileContent");
const requestedUser = new URLSearchParams(location.search).get("user")?.trim().toLowerCase() || "";

const requestedMember = new URLSearchParams(location.search).get("member") || "";

async function profileFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) { if (error?.name === "AbortError") throw new Error("Profile loading took too long. Check your connection and try again."); throw error; }
  finally { clearTimeout(timer); }
}

function firstString(source, keys) {
  for (const key of keys) {
    if (typeof source?.[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return "";
}

function loadProfileImage(target, url, onReady) {
  const nextUrl = String(url || "");
  target.dataset.pendingImage = nextUrl;
  target.classList.remove("has-photo");
  if (!nextUrl) { target.style.backgroundImage = ""; return; }
  const image = new Image();
  image.onload = () => {
    if (target.dataset.pendingImage !== nextUrl) return;
    target.style.backgroundImage = `url("${nextUrl}")`;
    target.classList.add("has-photo");
    onReady?.();
  };
  image.onerror = () => {
    if (target.dataset.pendingImage !== nextUrl) return;
    target.style.backgroundImage = "";
    target.classList.remove("has-photo");
  };
  image.src = nextUrl;
}

async function loadProfile() {
  try {
    const response = await profileFetch("/profiles" + (requestedMember ? "?member=" + encodeURIComponent(requestedMember) : requestedUser ? "?email=" + encodeURIComponent(requestedUser) : ""), {
      credentials: "include",
      cache: "no-store"
    });

    if (response.status === 401) {
      window.location.replace("./");
      return;
    }

    if (response.status === 403) { status.textContent = "This profile is available to accepted friends and members who share a Tribe."; return; }
    if (response.status === 404) { status.textContent = "This profile is no longer available."; return; }
    if (!response.ok) throw new Error("Session unavailable");

    const data = await response.json();
    const profile = data.profile || data;
    const isOther = profile.isOwner === false || (profile.isOwner !== true && Boolean(requestedUser || requestedMember));
    const email = firstString(profile, ["email", "username"]);
    const name = firstString(profile, ["name", "displayName", "given_name", "preferred_username"]) || "DanzStak member";
    const handle = firstString(profile, ["handle", "preferred_username", "username"]) || name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "member";

    document.getElementById("profileName").textContent = name;
    document.title = isOther ? name + " | DanzStak" : "My Profile | DanzStak";
    document.getElementById("profileHandle").textContent = "@" + handle;
    document.getElementById("profileEmail").textContent = isOther ? "Private" : (email || "Not available");
    const avatar = document.getElementById("profileInitial");
    avatar.textContent = name.charAt(0).toUpperCase() || "D";
    avatar.classList.remove("has-photo");
    loadProfileImage(avatar, profile.picture, () => { avatar.textContent = ""; });
    const cover = document.querySelector(".cover");
    cover.classList.remove("has-photo");
    if (profile.cover) {
      cover.style.backgroundPosition = `${profile.coverX ?? 50}% ${profile.coverY ?? 50}%`;
      cover.style.backgroundSize = profile.coverFit ? "contain" : "cover";
      cover.style.backgroundRepeat = "no-repeat";
    }
    loadProfileImage(cover, profile.cover);
    const message = document.getElementById("profileMessage");
    const memberId = String(profile.memberId || "");
    if (isOther && /^[a-f0-9-]{36}$/.test(memberId)) { message.href = "feed.html?messageMember=" + encodeURIComponent(memberId); message.hidden = false; }
    status.hidden = true;
    content.hidden = false;
    window.danzstakCurrentProfile = profile;
    window.dispatchEvent(new CustomEvent("danzstak:profile-loaded", { detail: profile }));
  } catch (error) {
    status.textContent = error.message || "Unable to load your profile. Please return to the feed and try again.";
  }
}

loadProfile();
