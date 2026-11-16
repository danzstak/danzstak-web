"use strict";
// Add friend + Message on another member's profile (owner 2026-11-16): the familiar Facebook pattern.
(() => {
  const API = "https://api.danzstak.com";
  let installedFor = "";
  const icon = (name, label, el = "button") => { const b = document.createElement(el); if (el === "button") b.type = "button"; b.className = "button profile-friend-action"; b.dataset.icon = name; b.textContent = label; b.setAttribute("aria-label", label); b.title = label; return b; };

  async function install(profile) {
    const actions = document.querySelector(".profile-actions");
    if (!actions || !profile || profile.isOwner || !/^[a-f0-9-]{36}$/.test(profile.memberId || "") || installedFor === profile.memberId) return;
    installedFor = profile.memberId;
    actions.querySelectorAll(".profile-friend-action").forEach(el => el.remove());
    const name = profile.name || "this member";
    const friend = icon("person-add", "Add friend");
    friend.classList.add("primary");
    const message = icon("chat", "Message", "a");
    message.href = "messages.html";
    message.setAttribute("role", "button");
    message.hidden = true; // SYNC messaging is open between friends
    actions.prepend(friend, message);
    const setState = state => {
      friend.disabled = state !== "none";
      friend.dataset.icon = state === "friends" ? "person-check" : state === "requested" ? "clock" : "person-add";
      const label = state === "friends" ? "Friends" : state === "requested" ? "Requested" : state === "incoming" ? "Respond in Friends" : "Add friend";
      friend.textContent = label; friend.setAttribute("aria-label", state === "none" ? "Send friend request to " + name : label); friend.title = friend.getAttribute("aria-label");
      friend.classList.toggle("primary", state === "none");
      friend.dataset.state = state; message.hidden = state !== "friends";
    };
    setState("none");
    try {
      const response = await fetch(API + "/friends", { credentials: "include", cache: "no-store" });
      const data = response.ok ? await response.json() : {};
      if ((data.friends || []).some(f => f.memberId === profile.memberId)) setState("friends");
    } catch {}
    friend.addEventListener("click", async () => {
      if (friend.dataset.state === "incoming") { location.href = "feed.html#friends"; return; }
      friend.disabled = true; friend.textContent = "Sending…";
      try {
        const response = await fetch(API + "/friends/request", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: profile.memberId }) });
        const result = await response.json().catch(() => ({}));
        if (response.status === 409) { setState("incoming"); friend.disabled = false; return; }
        if (!response.ok) throw new Error(result.error || "Friend request could not be sent.");
        setState(result.alreadyFriends ? "friends" : "requested");
        window.danzstakShowFeedback?.(result.alreadyFriends ? "You are now friends." : "Friend request sent to " + name + ".");
      } catch (error) { setState("none"); window.danzstakShowFeedback?.(error.message, { urgent: true }); }
    });
  }
  window.addEventListener("danzstak:profile-loaded", event => install(event.detail || window.danzstakCurrentProfile));
  if (window.danzstakCurrentProfile) install(window.danzstakCurrentProfile);
})();
