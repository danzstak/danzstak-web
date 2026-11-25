"use strict";
// Add friend + Message on another member's profile (owner 2026-11-16): the familiar Facebook pattern.
(() => {
  const API = "https://api.danzstak.com";
  let installedFor = "";
  // Deferred scripts run before DOMContentLoaded (readyState is already "interactive"), so track parsing ourselves.
  let parsed = false; document.addEventListener("DOMContentLoaded", () => { parsed = true; }, { once: true });
  const t = value => window.danzstakTranslate?.(value) || value;
  // UIKIT 4b part 2: a kit icon button; the words are its accessible name (ds-icon.js danzstakIconButton).
  const kit = (button, icon, label, kind) => window.danzstakIconButton ? window.danzstakIconButton(button, icon, label, kind) : (button.textContent = label, button.setAttribute("aria-label", label), button);

  async function install(profile, target) {
    const actions = target || document.querySelector(".profile-actions");
    // A fast profile load can finish before profile-editor.js builds the action row; try again once the page is parsed.
    if (!actions && !target && !parsed) { document.addEventListener("DOMContentLoaded", () => install(profile), { once: true }); return; }
    if (!actions || !profile || profile.isOwner || !/^[a-f0-9-]{36}$/.test(profile.memberId || "") || installedFor === profile.memberId) return;
    installedFor = profile.memberId;
    actions.querySelectorAll(".profile-friend-action").forEach(el => el.remove());
    const name = profile.name || "this member";
    const friend = document.createElement("button");
    friend.type = "button"; friend.className = "profile-friend-action";
    actions.prepend(friend);
    // Queue 5a3: one tap to add, tap "Requested" again to cancel; an incoming request opens Friends to answer it.
    const setState = state => {
      // Audit E10 (2026-11-19): "Friends" was a dead, disabled button. Like Facebook it's "Friends ▾": tap for
      // Unfriend / Block. 5a3: tapping "Requested" cancels the request (POST /friends/cancel).
      friend.disabled = false;
      friend.setAttribute("aria-haspopup", state === "friends" ? "dialog" : "false");
      friend.dataset.icon = state === "friends" ? "person-check" : state === "requested" ? "clock" : "person-add";
      const label = state === "none" ? t("Send friend request to {name}") : state === "friends" ? t("Friends with {name}") + ". " + t("Friend options") : state === "requested" ? t("Cancel friend request to {name}") : t("Respond in Friends");
      // One primary action: Add friend is green; Friends, Requested and Respond are quiet.
      kit(friend, state === "friends" ? "user-check" : state === "requested" ? "clock" : "user-plus", label.replace("{name}", name), state === "none" ? "go" : "quiet");
      friend.dataset.state = state;
    };
    setState("none");
    // Owner SYNC call test 2026-11-17: the button stayed on "Requested" after the other member accepted. Re-check the
    // relationship whenever the page comes back into view, not only on first load.
    const refresh = async () => {
      try {
        const response = await fetch(API + "/friends", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json(), has = list => (list || []).some(f => f.memberId === profile.memberId);
        setState(has(data.friends) ? "friends" : has(data.outgoing) ? "requested" : has(data.incoming) ? "incoming" : "none");
      } catch {}
    };
    await refresh();
    const onReturn = () => { if (!document.hidden && friend.isConnected && friend.dataset.state !== "friends") refresh(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    friend.addEventListener("click", async () => {
      if (friend.dataset.state === "incoming") { location.href = "friends.html"; return; }
      if (friend.dataset.state === "friends") {
        const choice = await window.danzstakChoose?.(`You and ${name} are friends.`, { title: "Friend options", choices: [{ label: "Unfriend", value: "remove", danger: true }, { label: "Block", value: "block", danger: true }] });
        if (!["remove", "block"].includes(choice)) return;
        if (choice === "block" && !(await window.danzstakConfirm?.(`${name} won't be able to find you, message you or see your posts.`, { title: "Block " + name + "?", confirmLabel: "Block", danger: true }))) return;
        friend.disabled = true;
        try {
          const response = await fetch(API + (choice === "block" ? "/friends/block" : "/friends/remove"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: profile.memberId }) });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || (choice === "block" ? result.blocked !== true : result.removed !== true)) throw new Error(result.error || "");
          setState("none");
          window.danzstakShowFeedback?.(choice === "block" ? name + " is blocked." : "You and " + name + " are no longer friends.");
        } catch (error) { setState("friends"); window.danzstakShowFeedback?.(window.danzstakFriendlyError?.(error, "That didn't go through. Try again in a moment.") || "That didn't go through. Try again in a moment.", { urgent: true }); }
        return;
      }
      if (friend.dataset.state === "requested") {
        friend.disabled = true;
        try {
          const response = await fetch(API + "/friends/cancel", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: profile.memberId }) });
          if (!response.ok && response.status !== 404) throw new Error("");
          setState("none"); window.danzstakShowFeedback?.("Friend request cancelled.");
        } catch { setState("requested"); window.danzstakShowFeedback?.("The request could not be cancelled. Try again.", { urgent: true }); }
        return;
      }
      friend.disabled = true;
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
    const holder = document.createElement("div"); holder.className = "profile-actions profile-locked-friend ds ds--day ds-actions";
    status.insertAdjacentElement("afterend", holder);
    install({ memberId, name: "this member", isOwner: false }, holder);
  });
  window.addEventListener("danzstak:profile-loaded", event => install(event.detail || window.danzstakCurrentProfile));
  if (window.danzstakCurrentProfile) install(window.danzstakCurrentProfile);
})();
