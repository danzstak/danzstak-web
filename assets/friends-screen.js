"use strict";
// Queue 5a3 (owner 2026-11-18): the one Friends screen. The profile's friends row, its Friends tab and Menu → Friends
// all open this page: ← back, the member's name, search, then Friends · Following · Things in common. On your own
// screen friend requests sit on top as list rows, Find friends is the first row and Invite is the bar's person icon.
// UI kit screen 4a (docs/tasks/39-modern-look.md, CLAUDE.md F9): kit list rows (56px photo, name, one grey line, the
// whole row opens the profile), Message behind ⋯ in a sheet. No nagging, no infinite list.
(() => {
  const API = "https://api.danzstak.com";
  const MEMBER = /^[a-f0-9-]{36}$/;
  const byId = id => document.getElementById(id);
  const member = (() => { const value = new URLSearchParams(location.search).get("member") || ""; return MEMBER.test(value) ? value : ""; })();
  const status = byId("friendsStatus");
  let people = [], everyone = [], presence = new Map(), viewerFriends = new Set(), state = null;

  // Every word goes through the translation layer; {name}-style values are filled in after translating.
  const t = (text, values = {}) => String(window.danzstakTranslate?.(text) || text).replace(/\{(\w+)\}/g, (all, key) => key in values ? String(values[key]) : all);
  const el = (tag, className = "", text = "") => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
  const profileUrl = memberId => `profile.html?member=${encodeURIComponent(memberId)}`;
  const initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
  const hue = text => [...String(text || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  const icon = (name, size) => window.danzstakIcon ? window.danzstakIcon(name, size ? { size } : undefined) : document.createElement("span");
  function photo(person, className) {
    const holder = el("span", className);
    const fallback = () => { holder.textContent = initials(person.name); holder.style.background = `hsl(${hue(person.memberId || person.name)} 45% 38%)`; holder.style.color = "#fff"; };
    if (person.picture) {
      const img = document.createElement("img");
      img.src = person.picture; img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.remove(); fallback(); }, { once: true });
      holder.append(img);
    } else fallback();
    return holder;
  }
  // One kit list row: the whole row opens `href`; the avatar is decoration (the row already opens the profile).
  function personRow(person, { href, sub = "", subClass = "", more = null, actions = null }) {
    const row = el("article", `ds-row${more ? " ds-row--more" : ""} friends-row`);
    const target = el("a", "ds-row__target"); target.href = href; target.setAttribute("aria-label", person.name);
    const face = el("span", "ds-row__avatar"); face.setAttribute("aria-hidden", "true"); face.append(photo(person, "ds-row__photo"));
    const body = el("span", "ds-row__body"); body.append(el("strong", "ds-row__name", person.name));
    if (sub) body.append(el("span", `ds-row__sub ${subClass}`.trim(), sub));
    if (actions) { const holder = el("span", "ds-row__actions"); actions(holder); body.append(holder); }
    row.append(target, face, body);
    if (more) row.append(more);
    return row;
  }
  function skeleton(count = 4) {
    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const row = el("div", "ds-row ds-row--skeleton"); row.setAttribute("aria-hidden", "true");
      const face = el("span", "ds-row__avatar"); face.append(el("span", "ds-row__photo ds-shimmer"));
      const body = el("span", "ds-row__body"); body.append(el("span", "ds-shimmer ds-shimmer--line"), el("span", "ds-shimmer ds-shimmer--short"));
      row.append(face, body); rows.push(row);
    }
    return rows;
  }
  async function api(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal, ...options, ...(options.body ? { headers: { "content-type": "application/json" } } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || t("DanzStak could not load this right now.")), { status: response.status });
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
    if (live?.online) return t("Online now");
    if (state && !state.isOwner && person.mutual) return t("Mutual friend");
    return "";
  }
  // ⋯ on a row: Message (only for my own friends) and View profile, in a kit sheet.
  function moreButton(person) {
    const button = el("button", "ds-icon-btn ds-row__more"); button.type = "button";
    button.setAttribute("aria-label", t("More options for {name}", { name: person.name })); button.append(icon("ellipsis"));
    button.addEventListener("click", () => {
      const list = el("div");
      const choice = (iconName, label, href) => { const link = el("a", "ds-choice"); link.href = href; link.append(icon(iconName), el("span", "ds-choice__text", label)); list.append(link); };
      if (state?.isOwner || viewerFriends.has(person.memberId)) choice("message-circle", t("Message {name}", { name: person.name }), `feed.html?messageMember=${encodeURIComponent(person.memberId)}`);
      choice("users", t("View profile"), profileUrl(person.memberId));
      window.danzstakSheet?.open({ title: person.name, content: list, opener: button });
    });
    return button;
  }
  function renderFriends() {
    const list = byId("friendsList"), term = search.value.trim().toLocaleLowerCase();
    const shown = term ? people.filter(person => person.name.toLocaleLowerCase().includes(term)) : people;
    list.replaceChildren(...shown.map(person => {
      const line = nowLine(person);
      return personRow(person, { href: profileUrl(person.memberId), sub: line, subClass: presence.get(person.memberId)?.online ? "is-online" : "", more: moreButton(person) });
    }));
    // Owner 2026-11-18: "members should be able to see all the users that have signed up until we get a ton of users."
    // On your own screen, everyone else on DanzStak follows your friends (online first, from GET /people?all=1).
    const others = term ? everyone.filter(person => person.name.toLocaleLowerCase().includes(term)) : everyone;
    byId("friendsEveryone").hidden = !others.length;
    byId("friendsEveryoneTitle").textContent = t("Everyone on DanzStak · {count}", { count: others.length });
    byId("friendsEveryoneList").replaceChildren(...others.map(person => personRow(person, { href: profileUrl(person.memberId), sub: person.online ? t("Online now") : person.handle ? "@" + person.handle : "", subClass: person.online ? "is-online" : "" })));
    const friendsCount = count => t(count === 1 ? "1 friend" : "{count} friends", { count });
    if (!people.length) status.textContent = t(state?.isOwner ? "No friends yet. Find friends or invite your people." : state && !state.listVisible ? "No mutual friends yet." : "No friends to show yet.");
    else if (!shown.length) status.textContent = t("No friends match \"{term}\".", { term: search.value.trim() });
    else status.textContent = state?.isOwner ? friendsCount(state.count) : state?.listVisible ? (state.mutualCount ? t(state.count === 1 ? "1 friend · {mutual} mutual" : "{count} friends · {mutual} mutual", { count: state.count, mutual: state.mutualCount }) : friendsCount(state.count)) : t(state.mutualCount === 1 ? "1 mutual friend" : "{count} mutual friends", { count: state.mutualCount });
  }

  // ---------- Things in common ----------
  function alsoLine(item) {
    const names = (item.friends || []).map(friend => friend.name.split(/\s+/)[0]).filter(Boolean), others = Number(item.others || 0);
    if (!names.length) return t("You both have this.");
    if (others) return t("{names} and {count} others also have this", { names: names.slice(0, 2).join(", "), count: others + Math.max(0, names.length - 2) });
    if (names.length === 1) return t("{name} also has this", { name: names[0] });
    return t("{names} and {name} also have this", { names: names.slice(0, -1).join(", "), name: names.at(-1) });
  }
  function renderCommon(items) {
    const list = byId("commonList");
    list.replaceChildren();
    if (!items.length) { list.append(el("p", "ds-empty", t("Nothing in common yet. A city on your profile and the Tribes you join show up here."))); return; }
    for (const item of items) {
      const row = el("article", "ds-row friends-common-item"); row.dataset.kind = item.kind;
      const face = el("span", "ds-row__avatar"); face.setAttribute("aria-hidden", "true");
      const badge = el("span", "ds-row__photo is-icon"); badge.append(icon(item.kind === "place" ? "map-pin" : "users")); face.append(badge);
      const body = el("span", "ds-row__body");
      body.append(el("strong", "ds-row__name", item.kind === "place" ? t("Lives in {place}", { place: item.label }) : t("{name} Tribe", { name: item.label })));
      body.append(el("span", "ds-row__sub", alsoLine(item)));
      if ((item.friends || []).length) { const faces = el("span", "ds-facepile"); faces.setAttribute("aria-hidden", "true"); for (const friend of item.friends.slice(0, 5)) faces.append(photo(friend, "ds-facepile__face")); body.append(faces); }
      row.append(face, body);
      list.append(row);
    }
  }

  // ---------- owner row: requests, find friends, invite ----------
  async function respond(button, person, accept) {
    button.disabled = true;
    try {
      await api("/friends/respond", { method: "POST", body: JSON.stringify({ email: person.email, accept }) });
      window.danzstakShowFeedback?.(accept ? t("You and {name} are friends.", { name: person.name }) : t("Request deleted."));
      await load();
    } catch (error) { button.disabled = false; window.danzstakShowFeedback?.(error.message, { urgent: true }); }
  }
  async function cancel(button, person) {
    button.disabled = true;
    try { await api("/friends/cancel", { method: "POST", body: JSON.stringify({ memberId: person.memberId }) }); window.danzstakShowFeedback?.(t("Friend request cancelled.")); await load(); }
    catch (error) { button.disabled = false; window.danzstakShowFeedback?.(error.message, { urgent: true }); }
  }
  function renderRequests(incoming, outgoing) {
    const box = byId("friendsRequests");
    box.replaceChildren();
    box.hidden = !incoming.length && !outgoing.length;
    const group = (title, list, actions) => {
      if (!list.length) return;
      box.append(el("h2", "ds-section__title", t(title)));
      for (const person of list) {
        const named = { ...person, name: person.name || t("DanzStak member") };
        box.append(personRow(named, { href: MEMBER.test(person.memberId || "") ? profileUrl(person.memberId) : "#", actions: holder => actions(named, holder) }));
      }
    };
    group("Friend requests", incoming, (person, holder) => {
      const accept = el("button", "ds-btn ds-btn--go", t("Accept")), remove = el("button", "ds-btn ds-btn--quiet", t("Delete"));
      accept.type = remove.type = "button";
      accept.addEventListener("click", () => respond(accept, person, true));
      remove.addEventListener("click", () => respond(remove, person, false));
      holder.append(accept, remove);
    });
    group("Requests sent", outgoing, (person, holder) => {
      const undo = el("button", "ds-btn ds-btn--quiet", t("Cancel")); undo.type = "button"; undo.setAttribute("aria-label", t("Cancel friend request to {name}", { name: person.name }));
      undo.addEventListener("click", () => cancel(undo, person)); holder.append(undo);
    });
  }
  byId("friendsFind").addEventListener("click", event => {
    // The kit search field, handed to the shared people finder (it searches every member by name or @username).
    const box = el("div", "friends-find"), field = el("label", "ds-search"), input = document.createElement("input");
    field.append(el("span", "ds-sr-only", t("Find friends")), icon("search", "sm"), input);
    input.placeholder = t("Search everyone on DanzStak"); input.enterKeyHint = "search";
    box.append(field);
    if (typeof window.danzstakMountPeopleFinder === "function") window.danzstakMountPeopleFinder(box, { compact: true, searchInput: input });
    window.danzstakSheet?.open({ title: t("Find friends"), content: box, opener: event.currentTarget });
    requestAnimationFrame(() => box.querySelector("input")?.focus());
  });
  byId("friendsInvite").addEventListener("click", event => window.danzstakInvitePeople?.(event.currentTarget));

  // ---------- load ----------
  async function load() {
    status.textContent = ""; byId("friendsList").replaceChildren(...skeleton()); byId("friendsList").setAttribute("aria-busy", "true");
    try {
      const [of, profile] = await Promise.all([
        api(`/friends/of${member ? `?member=${encodeURIComponent(member)}` : ""}`),
        api(`/profiles${member ? `?member=${encodeURIComponent(member)}` : ""}`).catch(() => null)
      ]);
      state = of;
      people = (of.friends || []).filter(person => MEMBER.test(person.memberId || "")).map(person => ({ ...person, name: String(person.name || "DanzStak member") }));
      const record = profile?.profile || profile, name = record?.name || t("Friends");
      byId("friendsTitle").textContent = name; document.title = `${name} · ${t("Friends")} | DanzStak`;
      byId("tab-common").hidden = of.isOwner; // things in common are between you and someone else
      byId("friendsFindRow").hidden = byId("friendsInvite").hidden = byId("friendsMore").hidden = !of.isOwner;
      const [mine, directory, all] = await Promise.all([
        api("/friends").catch(() => null),
        api("/calls/directory").catch(() => null),
        of.isOwner ? api("/people?all=1").catch(() => null) : null
      ]);
      const friendIds = new Set(people.map(person => person.memberId));
      everyone = (all?.users || []).filter(user => MEMBER.test(user.memberId || "") && user.friendStatus !== "friends" && !friendIds.has(user.memberId)).map(user => ({ ...user, name: String(user.name || "DanzStak member") }));
      viewerFriends = new Set((mine?.friends || []).map(friend => friend.memberId));
      presence = new Map((directory?.users || []).filter(user => MEMBER.test(user.memberId || "")).map(user => [user.memberId, user]));
      if (of.isOwner && mine) renderRequests(mine.incoming || [], mine.outgoing || []);
      // Online friends first on your own screen, then real photos, then name.
      if (of.isOwner) people.sort((a, b) => Number(Boolean(presence.get(b.memberId)?.online)) - Number(Boolean(presence.get(a.memberId)?.online)) || Number(Boolean(b.picture)) - Number(Boolean(a.picture)) || a.name.localeCompare(b.name));
      byId("friendsList").removeAttribute("aria-busy");
      renderFriends();
      renderCommon(of.common || []);
    } catch (error) {
      people = []; everyone = []; byId("friendsEveryone").hidden = true; byId("friendsList").replaceChildren(); byId("friendsList").removeAttribute("aria-busy");
      if (error.status === 401) { status.textContent = t("Sign in to see friends.") + " "; const link = el("a", "", t("Sign in")); link.href = `${API}/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`; status.append(link); }
      else if (error.status === 403) status.textContent = t("Friends are shown to this member's friends and people in their Tribes.");
      else status.textContent = error.message;
    }
  }
  const requested = location.hash === "#common" ? byId("tab-common") : location.hash === "#following" ? byId("tab-following") : null;
  if (requested) selectTab(requested);
  load();
  window.DanzStakFriendsScreen = { alsoLine }; // read by tests
})();
