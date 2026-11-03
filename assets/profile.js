"use strict";

const status = document.getElementById("profileStatus");
const content = document.getElementById("profileContent");
const requestedUser = new URLSearchParams(location.search).get("user")?.trim().toLowerCase() || "";

const requestedMember = new URLSearchParams(location.search).get("member") || "";
const profilePath = "/profiles" + (requestedMember ? "?member=" + encodeURIComponent(requestedMember) : requestedUser ? "?email=" + encodeURIComponent(requestedUser) : "");
const identityImageRefreshes = new WeakMap();

async function profileFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) { if (error?.name === "AbortError") throw new Error("Profile loading took too long. Check your connection and try again."); throw new Error("DanzStak cannot load this profile right now. Check your connection and try again."); }
  finally { clearTimeout(timer); }
}

function firstString(source, keys) {
  for (const key of keys) {
    if (typeof source?.[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return "";
}

function loadProfileImage(target, url, onReady, onError) {
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
    onError?.();
  };
  image.src = nextUrl;
}

async function fetchProfileRecord() {
  const response = await profileFetch(profilePath, { credentials: "include", cache: "no-store" });
  if (response.status === 401) { window.location.replace("./"); return null; }
  if (response.status === 403) throw Object.assign(new Error("This profile is available to accepted friends and members who share a Tribe."), { expected: true });
  if (response.status === 404) throw Object.assign(new Error("This profile is no longer available."), { expected: true });
  if (!response.ok) throw new Error("Session unavailable");
  const data = await response.json();
  return data.profile || data;
}

function loadRecoverableProfileImage(target, url, field, onReady) {
  loadProfileImage(target, url, onReady, async () => {
    if ((identityImageRefreshes.get(target) || 0) >= 1) return;
    identityImageRefreshes.set(target, 1);
    try {
      const refreshed = await fetchProfileRecord();
      const freshUrl = String(refreshed?.[field] || "");
      if (!freshUrl || freshUrl === String(url || "")) return;
      loadProfileImage(target, freshUrl, onReady);
    } catch (_) {
      // Keep the accessible initial or branded cover gradient when recovery is unavailable.
    }
  });
}

async function loadProfile() {
  try {
    const profile = await fetchProfileRecord();
    if (!profile) return;
    const isOther = profile.isOwner === false || (profile.isOwner !== true && Boolean(requestedUser || requestedMember));
    const name = firstString(profile, ["name", "displayName", "given_name", "preferred_username"]) || "DanzStak member";
    const handle = firstString(profile, ["handle", "preferred_username", "username"]) || name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "member";

    document.getElementById("profileName").textContent = name;
    document.title = isOther ? name + " | DanzStak" : "My Profile | DanzStak";
    document.getElementById("profileHandle").textContent = "@" + handle;
    const avatar = document.getElementById("profileInitial");
    avatar.textContent = name.charAt(0).toUpperCase() || "D";
    avatar.classList.remove("has-photo");
    loadRecoverableProfileImage(avatar, profile.picture, "picture", () => { avatar.textContent = ""; });
    const cover = document.querySelector(".cover");
    cover.classList.remove("has-photo");
    if (profile.cover) {
      cover.style.backgroundPosition = `${profile.coverX ?? 50}% ${profile.coverY ?? 50}%`;
      cover.style.backgroundSize = profile.coverFit ? "contain" : "cover";
      cover.style.backgroundRepeat = "no-repeat";
    }
    loadRecoverableProfileImage(cover, profile.cover, "cover");
    const message = document.getElementById("profileMessage");
    const memberId = String(profile.memberId || "");
    if (isOther && /^[a-f0-9-]{36}$/.test(memberId)) { message.href = "feed.html?messageMember=" + encodeURIComponent(memberId); message.hidden = false; }
    status.hidden = true;
    content.hidden = false;
    window.danzstakCurrentProfile = profile;
    window.dispatchEvent(new CustomEvent("danzstak:profile-loaded", { detail: profile }));
  } catch (error) {
    status.textContent = error.message || "Unable to load your profile. Please return to Your Mix and try again.";
  }
}

loadProfile();
