"use strict";
// Add friend + Message on another member's profile (owner 2026-11-16): the familiar Facebook pattern.
(() => {
  const API = "https://api.danzstak.com";
  let installedFor = "";
  // Deferred scripts run before DOMContentLoaded (readyState is already "interactive"), so track parsing ourselves.
  let parsed = false; document.addEventListener("DOMContentLoaded", () => { parsed = true; }, { once: true });
  const icon = (name, label, el = "button") => { const b = document.createElement(el); if (el === "button") b.type = "button"; b.className = "button profile-friend-action"; b.dataset.icon = name; b.textContent = label; b.setAttribute("aria-label", label); b.title = label; return b; };

  async function install(profile, target) {
    const actions = target || document.querySelector(".profile-actions");
    // A fast profile load can finish before profile-editor.js builds the action row; try again once the page is parsed.
    if (!actions && !target && !parsed) { document.addEventListener("DOMContentLoaded", () => install(profile), { once: true }); return; }
    if (!actions || !profile || profile.isOwner || !/^[a-f0-9-]{36}$/.test(profile.memberId || "") || installedFor === profile.memberId) return;
    installedFor = profile.memberId;
    actions.querySelectorAll(".profile-friend-action").forEach(el => el.remove());
    const name = profile.name || "this member";
    const friend = icon("person-add", "Add friend");
    friend.classList.add("primary");
    actions.prepend(friend);
    const setState = state => {
      friend.disabled = state !== "none";
      friend.dataset.icon = state === "friends" ? "person-check" : state === "requested" ? "clock" : "person-add";
      const label = state === "friends" ? "Friends" : state === "requested" ? "Requested" : state === "incoming" ? "Respond in Friends" : "Add friend";
      friend.textContent = label; friend.setAttribute("aria-label", state === "none" ? "Send friend request to " + name : label); friend.title = friend.getAttribute("aria-label");
      friend.classList.toggle("primary", state === "none");
      friend.dataset.state = state;
    };
    setState("none");
    // Owner SYNC call test 2026-11-17: the button stayed on "Requested" after the other member accepted. Re-check the
    // relationship whenever the page comes back into view, not only on first load.
    const refresh = async () => {
      try {
        const response = await fetch(API + "/friends", { credentials: "include", cache: "no-store" });
        const data = response.ok ? await response.json() : {};
        if ((data.friends || []).some(f => f.memberId === profile.memberId)) setState("friends");
      } catch {}
    };
    await refresh();
    const onReturn = () => { if (!document.hidden && friend.isConnected && friend.dataset.state !== "friends") refresh(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
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
  // Locked profile (not friends yet): still offer Add friend, like Facebook.
  window.addEventListener("danzstak:profile-locked", event => {
    const { memberId, status } = event.detail || {};
    if (!status || document.querySelector(".profile-locked-friend")) return;
    const holder = document.createElement("div"); holder.className = "profile-actions profile-locked-friend";
    status.insertAdjacentElement("afterend", holder);
    install({ memberId, name: "this member", isOwner: false }, holder);
  });
  window.addEventListener("danzstak:profile-loaded", event => install(event.detail || window.danzstakCurrentProfile));
  if (window.danzstakCurrentProfile) install(window.danzstakCurrentProfile);
})();
