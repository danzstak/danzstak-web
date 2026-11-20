"use strict";
// Queue 5a3 (owner 2026-11-18) + owner 2026-11-19 ("Friends should be a 50% stacked to the right of the 3 buttons as
// Facebook has"): the profile's friends facepile. Up to four friends' photos, each overlapping the next by half, at the
// right end of the action row (train h's .profile-facepile spot and styles). It is one 44px link named "128 friends" on
// your own profile, "12 mutual friends" or "Friends with things in common" on someone else's, and it opens the one
// Friends screen (friends.html), as does the profile's Friends tab. Someone else's pile needs GET /friends/of (the
// call-signaling deploy); until then your own profile falls back to GET /friends, so your pile never disappears.
(() => {
  const API = "https://api.danzstak.com";
  const MEMBER = /^[a-f0-9-]{36}$/;
  const t = value => window.danzstakTranslate?.(value) || value;
  let drawnFor = "";

  const screenUrl = profile => profile?.isOwner || !MEMBER.test(profile?.memberId || "") ? "friends.html" : `friends.html?member=${encodeURIComponent(profile.memberId)}`;
  // A face is the friend's photo, or the first letter of their name (never of an email: privacy).
  function face(person) {
    const span = document.createElement("span");
    span.className = "profile-facepile-face";
    if (person.picture) {
      const img = document.createElement("img");
      img.src = person.picture; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.remove(); span.textContent = initial(person); }, { once: true });
      span.append(img);
    } else span.textContent = initial(person);
    return span;
  }
  const initial = person => String(person.name || "").trim().charAt(0).toUpperCase() || "•";

  // The pile's name, never a count of zero for a visitor.
  const count = (n, one, many) => n === 1 ? t(one) : t(many).replace("{count}", String(n));
  function line(data) {
    if (data.isOwner) return data.count ? count(data.count, "1 friend", "{count} friends") : "";
    if (data.mutualCount) return count(data.mutualCount, "1 mutual friend", "{count} mutual friends");
    if ((data.common || []).length) return t("Friends with things in common");
    if (data.listVisible && data.count) return count(data.count, "1 friend", "{count} friends");
    return "";
  }

  async function json(path) {
    try {
      const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }
  async function friendsOf(profile) {
    const data = await json(`/friends/of${profile.isOwner ? "" : `?member=${encodeURIComponent(profile.memberId)}`}`);
    if (Array.isArray(data?.friends)) return data;
    if (!profile.isOwner) return null;
    const own = (await json("/friends"))?.friends;
    return Array.isArray(own) ? { isOwner: true, count: own.filter(Boolean).length, friends: own.filter(Boolean) } : null;
  }

  async function draw(profile) {
    if (!profile || !(profile.isOwner || MEMBER.test(profile.memberId || ""))) return;
    const key = profile.isOwner ? "me" : profile.memberId;
    if (drawnFor === key && document.querySelector(".profile-actions .profile-facepile")) return;
    drawnFor = key;
    const data = await friendsOf(profile);
    document.querySelector(".profile-actions .profile-facepile")?.remove();
    const text = data ? line(data) : "";
    const people = [...(data?.friends || [])].sort((a, b) => Number(Boolean(b.mutual)) - Number(Boolean(a.mutual)) || Number(Boolean(b.picture)) - Number(Boolean(a.picture))).slice(0, 4);
    if (!text || !people.length) return;
    const actions = document.querySelector("#profileContent .profile-actions:not(.profile-locked-friend)") || document.querySelector(".profile-actions");
    if (!actions) return;
    const pile = document.createElement("a");
    pile.className = "profile-facepile"; pile.href = screenUrl(profile);
    pile.setAttribute("aria-label", text); pile.title = text;
    pile.append(...people.map(face));
    actions.append(pile);
  }

  // The profile's Friends tab opens the same Friends screen. Only real taps and Enter (trusted clicks): arrow keys
  // move through the tabs with scripted clicks and stay on the profile.
  document.addEventListener("click", event => {
    const tab = event.target.closest?.('[data-profile-tab="Friends"]');
    if (!tab || !event.isTrusted) return;
    const profile = window.danzstakCurrentProfile;
    if (!profile) return;
    event.preventDefault(); event.stopPropagation();
    location.assign(screenUrl(profile));
  }, true);

  window.addEventListener("danzstak:profile-loaded", event => draw(event.detail || window.danzstakCurrentProfile));
  if (window.danzstakCurrentProfile) draw(window.danzstakCurrentProfile);
  window.DanzStakFriendsRow = { line, screenUrl }; // read by tests
})();
