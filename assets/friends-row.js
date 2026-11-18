"use strict";
// Queue 5a3 (owner 2026-11-18): a Facebook-style friends row under the profile name. Small overlapping friend photos
// and one short line ("128 friends" on your own profile, "12 mutual friends" or "Friends with things in common" on
// someone else's). The whole row is one tap target that opens the one Friends screen (friends.html), and so does the
// profile's Friends tab. The separate people button is gone from the action row (profile-sharing.js); inviting lives
// on the Friends screen.
(() => {
  const API = "https://api.danzstak.com";
  const MEMBER = /^[a-f0-9-]{36}$/;
  let drawnFor = "";

  const screenUrl = profile => profile?.isOwner || !MEMBER.test(profile?.memberId || "") ? "friends.html" : `friends.html?member=${encodeURIComponent(profile.memberId)}`;
  const initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
  const hue = text => [...String(text || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);

  function face(person) {
    if (person.picture) {
      const img = document.createElement("img");
      img.src = person.picture; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.replaceWith(fallback(person)), { once: true });
      return img;
    }
    return fallback(person);
  }
  function fallback(person) {
    const span = document.createElement("span");
    span.className = "profile-friends-initials"; span.textContent = initials(person.name);
    span.style.setProperty("--friend-hue", String(hue(person.memberId || person.name)));
    return span;
  }

  // One short line, never a count of zero for a visitor.
  function line(data) {
    if (data.isOwner) return data.count ? `${data.count} friend${data.count === 1 ? "" : "s"}` : "Find your friends on DanzStak";
    if (data.mutualCount) return `${data.mutualCount} mutual friend${data.mutualCount === 1 ? "" : "s"}`;
    if ((data.common || []).length) return "Friends with things in common";
    if (data.listVisible && data.count) return `${data.count} friend${data.count === 1 ? "" : "s"}`;
    return "";
  }

  async function draw(profile) {
    if (!profile || !(profile.isOwner || MEMBER.test(profile.memberId || ""))) return;
    const key = profile.isOwner ? "me" : profile.memberId;
    if (drawnFor === key && document.querySelector(".profile-friends-row")) return;
    drawnFor = key;
    let data;
    try {
      const response = await fetch(`${API}/friends/of${profile.isOwner ? "" : `?member=${encodeURIComponent(profile.memberId)}`}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      data = await response.json();
    } catch { return; }
    const text = line(data);
    document.querySelector(".profile-friends-row")?.remove();
    if (!text) return;
    const row = document.createElement("a");
    row.className = "profile-friends-row";
    row.href = screenUrl(profile);
    row.setAttribute("aria-label", `${text}. Open Friends`);
    const faces = document.createElement("span");
    faces.className = "profile-friends-faces"; faces.setAttribute("aria-hidden", "true");
    const people = [...(data.friends || [])].sort((a, b) => Number(Boolean(b.picture)) - Number(Boolean(a.picture))).slice(0, 6);
    for (const person of people) faces.append(face(person));
    if (!people.length) faces.hidden = true;
    const words = document.createElement("span");
    words.className = "profile-friends-line"; words.textContent = text;
    row.append(faces, words);
    const anchor = document.querySelector("#profileContent .profile-actions:not(.profile-locked-friend)") || document.querySelector(".profile-actions");
    if (anchor) anchor.before(row);
    else document.getElementById("profileHandle")?.after(row);
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
