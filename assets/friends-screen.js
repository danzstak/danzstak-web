"use strict";
// Queue 5a3 (owner 2026-11-18): the one Friends screen. The profile's friends row, its Friends tab and Menu → Friends
// all open this page: ← back, the member's name, search, then Friends · Following · Things in common. On your own
// screen a small row on top holds friend requests, Find friends and Invite. No nagging, no infinite list.
(() => {
  const API = "https://api.danzstak.com";
  const MEMBER = /^[a-f0-9-]{36}$/;
  const byId = id => document.getElementById(id);
  const member = (() => { const value = new URLSearchParams(location.search).get("member") || ""; return MEMBER.test(value) ? value : ""; })();
  const status = byId("friendsStatus");
  let people = [], presence = new Map(), viewerFriends = new Set(), state = null;

  const el = (tag, className = "", text = "") => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const profileUrl = memberId => `profile.html?member=${encodeURIComponent(memberId)}`;
  const initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
  const hue = text => [...String(text || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  function avatar(person, size = "") {
    const holder = el("span", `friends-avatar ${size}`.trim());
    const fallback = () => { holder.textContent = initials(person.name); holder.style.setProperty("--friend-hue", String(hue(person.memberId || person.name))); holder.classList.add("is-initials"); };
    if (person.picture) {
      const img = document.createElement("img");
      img.src = person.picture; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.remove(); fallback(); }, { once: true });
      holder.append(img);
    } else fallback();
    return holder;
  }
  async function api(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal, ...options, ...(options.body ? { headers: { "content-type": "application/json" } } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || "DanzStak could not load this right now."), { status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  }

  // ---------- top bar ----------
  byId("friendsBack").addEventListener("click", () => {
    let sameSite = false;
    try { sameSite = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch {}
    if (sameSite && history.length > 1) history.back(); else location.href = member ? profileUrl(member) : "profile.html";
  });
  const searchRow = byId("friendsSearchRow"), search = byId("friendsSearch"), searchToggle = byId("friendsSearchToggle");
  searchToggle.addEventListener("click", () => {
    searchRow.hidden = !searchRow.hidden; searchToggle.setAttribute("aria-expanded", String(!searchRow.hidden));
    if (!searchRow.hidden) search.focus(); else { search.value = ""; renderFriends(); }
  });
  search.addEventListener("input", () => renderFriends());

  // ---------- tabs ----------
  const tabs = [...document.querySelectorAll("#friendsTabs [role=tab]")];
  function selectTab(tab, focus = false) {
    for (const item of tabs) { const selected = item === tab; item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1; byId(item.dataset.panel).hidden = !selected; }
    if (focus) tab.focus();
  }
  for (const tab of tabs) tab.addEventListener("click", () => selectTab(tab));
  byId("friendsTabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const visible = tabs.filter(tab => !tab.hidden), index = visible.indexOf(document.activeElement); if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length;
    selectTab(visible[next], true);
  });

  // ---------- Friends ----------
  function nowLine(person) {
    const live = presence.get(person.memberId);
    if (live?.online) return "Online now";
    if (state && !state.isOwner && person.mutual) return "Mutual friend";
    return "";
  }
  function renderFriends() {
    const list = byId("friendsList"), term = search.value.trim().toLocaleLowerCase();
    const shown = term ? people.filter(person => person.name.toLocaleLowerCase().includes(term)) : people;
    list.replaceChildren();
    for (const person of shown) {
      const row = el("li", "friends-row"), link = el("a", "friends-person");
      link.href = profileUrl(person.memberId);
      const copy = el("span", "friends-copy");
      copy.append(el("strong", "", person.name));
      const line = nowLine(person);
      if (line) copy.append(el("small", line === "Online now" ? "is-online" : "", line));
      link.append(avatar(person), copy);
      row.append(link);
      if (state?.isOwner || viewerFriends.has(person.memberId)) {
        const message = el("a", "friends-message button"); message.href = `feed.html?messageMember=${encodeURIComponent(person.memberId)}`;
        message.dataset.icon = "chat"; message.setAttribute("aria-label", `Message ${person.name}`); message.title = `Message ${person.name}`; message.textContent = "Message";
        row.append(message);
      }
      list.append(row);
    }
    if (!people.length) status.textContent = state?.isOwner ? "No friends yet. Find friends or invite your people." : state && !state.listVisible ? "No mutual friends yet." : "No friends to show yet.";
    else if (!shown.length) status.textContent = `No friends match "${search.value.trim()}".`;
    else status.textContent = state?.isOwner ? `${state.count} friend${state.count === 1 ? "" : "s"}` : state?.listVisible ? `${state.count} friend${state.count === 1 ? "" : "s"}${state.mutualCount ? ` · ${state.mutualCount} mutual` : ""}` : `${state.mutualCount} mutual friend${state.mutualCount === 1 ? "" : "s"}`;
  }

  // ---------- Things in common ----------
  function alsoLine(item) {
    const names = (item.friends || []).map(friend => friend.name.split(/\s+/)[0]).filter(Boolean), others = Number(item.others || 0);
    if (!names.length) return "You both have this.";
    if (others) return `${names.slice(0, 2).join(", ")} and ${others + Math.max(0, names.length - 2)} others also have this`;
    if (names.length === 1) return `${names[0]} also has this`;
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} also have this`;
  }
  function renderCommon(items) {
    const list = byId("commonList");
    list.replaceChildren();
    if (!items.length) { list.append(el("li", "friends-empty", "Nothing in common yet. A city on your profile and the Tribes you join show up here.")); return; }
    for (const item of items) {
      const row = el("li", "friends-common-item"), icon = el("span", "friends-common-icon"); icon.dataset.kind = item.kind; icon.setAttribute("aria-hidden", "true");
      const copy = el("span", "friends-copy");
      copy.append(el("strong", "", item.kind === "place" ? `Lives in ${item.label}` : `${item.label} Tribe`));
      const faces = el("span", "friends-faces"); faces.setAttribute("aria-hidden", "true");
      for (const friend of item.friends || []) faces.append(avatar(friend, "is-small"));
      const also = el("small", "", alsoLine(item));
      copy.append(also);
      row.append(icon, copy, faces);
      list.append(row);
    }
  }

  // ---------- owner row: requests, find friends, invite ----------
  async function respond(button, person, accept) {
    button.disabled = true;
    try {
      await api("/friends/respond", { method: "POST", body: JSON.stringify({ email: person.email, accept }) });
      window.danzstakShowFeedback?.(accept ? `You and ${person.name} are friends.` : "Request deleted.");
      await load();
    } catch (error) { button.disabled = false; window.danzstakShowFeedback?.(error.message, { urgent: true }); }
  }
  async function cancel(button, person) {
    button.disabled = true;
    try { await api("/friends/cancel", { method: "POST", body: JSON.stringify({ memberId: person.memberId }) }); window.danzstakShowFeedback?.("Friend request cancelled."); await load(); }
    catch (error) { button.disabled = false; window.danzstakShowFeedback?.(error.message, { urgent: true }); }
  }
  function renderRequests(incoming, outgoing) {
    const toggle = byId("friendsRequestsToggle"), box = byId("friendsRequests");
    toggle.hidden = !incoming.length && !outgoing.length;
    toggle.textContent = incoming.length ? `${incoming.length} friend request${incoming.length === 1 ? "" : "s"}` : `Requests sent · ${outgoing.length}`;
    toggle.classList.toggle("is-alert", incoming.length > 0);
    box.replaceChildren();
    const group = (title, list, actions) => {
      if (!list.length) return;
      box.append(el("h2", "friends-subhead", title));
      const ul = el("ul", "friends-list");
      for (const person of list) {
        const row = el("li", "friends-row"), link = el("a", "friends-person"); link.href = MEMBER.test(person.memberId || "") ? profileUrl(person.memberId) : "#";
        const copy = el("span", "friends-copy"); copy.append(el("strong", "", person.name || "DanzStak member"));
        link.append(avatar(person), copy);
        const buttons = el("span", "friends-actions"); actions(person, buttons);
        row.append(link, buttons); ul.append(row);
      }
      box.append(ul);
    };
    group("Friend requests", incoming, (person, holder) => {
      const accept = el("button", "primary", "Accept"), remove = el("button", "", "Delete");
      accept.type = remove.type = "button";
      accept.addEventListener("click", () => respond(accept, person, true));
      remove.addEventListener("click", () => respond(remove, person, false));
      holder.append(accept, remove);
    });
    group("Requests sent", outgoing, (person, holder) => {
      const undo = el("button", "", "Cancel"); undo.type = "button"; undo.setAttribute("aria-label", `Cancel friend request to ${person.name}`);
      undo.addEventListener("click", () => cancel(undo, person)); holder.append(undo);
    });
    if (incoming.length && !box.dataset.opened) { box.hidden = false; toggle.setAttribute("aria-expanded", "true"); box.dataset.opened = "1"; }
  }
  byId("friendsRequestsToggle").addEventListener("click", event => { const box = byId("friendsRequests"); box.hidden = !box.hidden; event.currentTarget.setAttribute("aria-expanded", String(!box.hidden)); });
  byId("friendsFindToggle").addEventListener("click", event => {
    const box = byId("friendsFind"), button = event.currentTarget;
    box.hidden = !box.hidden; button.setAttribute("aria-expanded", String(!box.hidden));
    if (!box.hidden && !box.dataset.mounted && typeof window.danzstakMountPeopleFinder === "function") { window.danzstakMountPeopleFinder(box, { compact: true }); box.dataset.mounted = "1"; }
    box.querySelector("input")?.focus();
  });
  byId("friendsInvite").addEventListener("click", event => window.danzstakInvitePeople?.(event.currentTarget));

  // ---------- load ----------
  async function load() {
    status.textContent = "Loading friends…";
    try {
      const [of, profile] = await Promise.all([
        api(`/friends/of${member ? `?member=${encodeURIComponent(member)}` : ""}`),
        api(`/profiles${member ? `?member=${encodeURIComponent(member)}` : ""}`).catch(() => null)
      ]);
      state = of;
      people = (of.friends || []).filter(person => MEMBER.test(person.memberId || "")).map(person => ({ ...person, name: String(person.name || "DanzStak member") }));
      const record = profile?.profile || profile, name = record?.name || "Friends";
      byId("friendsTitle").textContent = name; document.title = `${name} · Friends | DanzStak`;
      byId("tab-common").hidden = of.isOwner; // things in common are between you and someone else
      byId("friendsOwnerRow").hidden = !of.isOwner;
      byId("friendsMore").hidden = !of.isOwner;
      const [mine, directory] = await Promise.all([
        api("/friends").catch(() => null),
        api("/calls/directory").catch(() => null)
      ]);
      viewerFriends = new Set((mine?.friends || []).map(friend => friend.memberId));
      presence = new Map((directory?.users || []).filter(user => MEMBER.test(user.memberId || "")).map(user => [user.memberId, user]));
      if (of.isOwner && mine) renderRequests(mine.incoming || [], mine.outgoing || []);
      // Online friends first on your own screen, then real photos, then name.
      if (of.isOwner) people.sort((a, b) => Number(Boolean(presence.get(b.memberId)?.online)) - Number(Boolean(presence.get(a.memberId)?.online)) || Number(Boolean(b.picture)) - Number(Boolean(a.picture)) || a.name.localeCompare(b.name));
      renderFriends();
      renderCommon(of.common || []);
    } catch (error) {
      people = []; byId("friendsList").replaceChildren();
      if (error.status === 401) { status.textContent = "Sign in to see friends. "; const link = el("a", "", "Sign in"); link.href = `${API}/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`; status.append(link); }
      else if (error.status === 403) status.textContent = "Friends are shown to this member's friends and people in their Tribes.";
      else status.textContent = error.message;
    }
  }
  const requested = location.hash === "#common" ? byId("tab-common") : location.hash === "#following" ? byId("tab-following") : null;
  if (requested) selectTab(requested);
  load();
  window.DanzStakFriendsScreen = { alsoLine }; // read by tests
})();
