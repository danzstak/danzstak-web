"use strict";
(() => {
  const input = document.querySelector(".search");
  const feed = document.getElementById("feed");
  if (!input || !feed) return;

  const section = document.createElement("section");
  section.className = "panel user-search-results";
  section.hidden = true;
  section.setAttribute("aria-label", "Matching users");
  const heading = document.createElement("h3");
  heading.textContent = "People";
  const help = document.createElement("p");
  help.className = "muted user-search-help";
  help.textContent = "Find a DanzStak member by name and send a friend request, even when they are offline.";
  const status = document.createElement("p");
  status.className = "muted";
  status.setAttribute("role", "status");
  const list = document.createElement("div");
  list.className = "user-search-list";
  section.append(heading, help, status, list);
  feed.insertAdjacentElement("beforebegin", section);

  let generation = 0;
  let timer;
  let requestController;

  function memberId(value) {
    const id = String(value || "");
    return /^[a-f0-9-]{36}$/.test(id) ? id : "";
  }

  function visibleAuthors(query) {
    const authors = [];
    for (const anchor of document.querySelectorAll("#feed .post .post-header a")) {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin || !url.pathname.endsWith("/profile.html")) continue;
        const id = memberId(url.searchParams.get("member"));
        const name = anchor.textContent.trim();
        if (!id || !name.toLocaleLowerCase().includes(query)) continue;
        authors.push({ memberId: id, name, friendStatus: "visible-author", online: false });
      } catch { /* Ignore malformed author links. */ }
    }
    return authors;
  }

  function personRow(person) {
    const id = memberId(person.memberId);
    const row = document.createElement("div");
    row.className = "user-search-result";
    const avatar = person.picture ? document.createElement("img") : document.createElement("span");
    avatar.className = "user-search-avatar";
    if (person.picture) {
      avatar.src = person.picture;
      avatar.alt = "";
      avatar.referrerPolicy = "no-referrer";
    } else {
      avatar.textContent = String(person.name || "D").charAt(0).toUpperCase();
      avatar.setAttribute("aria-hidden", "true");
    }
    const identity = document.createElement("span");
    identity.className = "user-search-identity";
    const name = person.friendStatus === "friends" || person.friendStatus === "visible-author" ? document.createElement("a") : document.createElement("strong");
    if (name.tagName === "A" && id) name.href = "profile.html?member=" + encodeURIComponent(id);
    name.textContent = person.name || "DanzStak member";
    name.setAttribute("data-no-translate", "");
    identity.appendChild(name);
    const detail = document.createElement("small");
    detail.textContent = [person.handle ? "@" + person.handle.replace(/^@/, "") : "", person.online ? "Online" : ""].filter(Boolean).join(" · ");
    if (detail.textContent) identity.appendChild(detail);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "user-search-action";
    if (person.friendStatus === "friends") {
      action.textContent = "Friends";
      action.addEventListener("click", () => { location.href = "profile.html?member=" + encodeURIComponent(id); });
    } else if (person.friendStatus === "outgoing") {
      action.textContent = "Requested";
      action.disabled = true;
    } else if (person.friendStatus === "incoming") {
      action.textContent = "Respond";
      action.addEventListener("click", () => { location.href = "feed.html#notifications"; });
    } else if (person.friendStatus === "visible-author") {
      action.textContent = "View Profile";
      action.addEventListener("click", () => { location.href = "profile.html?member=" + encodeURIComponent(id); });
    } else {
      action.textContent = "Add Friend";
      action.setAttribute("aria-label", "Send friend request to " + name.textContent);
      action.addEventListener("click", async () => {
        action.disabled = true;
        action.textContent = "Sending…";
        try {
          const response = await fetch("https://api.danzstak.com/friends/request", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: id })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Friend request could not be sent.");
          action.textContent = data.alreadyFriends ? "Friends" : "Requested";
          window.danzstakShowFeedback?.(data.alreadyFriends ? `You and ${name.textContent} are already friends.` : `Friend request sent to ${name.textContent}.`);
        } catch (error) {
          action.disabled = false;
          action.textContent = "Add Friend";
          window.danzstakShowFeedback?.(error.message || "Friend request could not be sent.", { urgent: true });
        }
      });
    }
    row.append(avatar, identity, action);
    return row;
  }

  async function runSearch(version, query) {
    requestController?.abort();
    requestController = new AbortController();
    const timeout = setTimeout(() => requestController.abort(), 10000);
    let people = [], failed = false;
    try {
      const response = await fetch("https://api.danzstak.com/people?query=" + encodeURIComponent(query), { credentials: "include", cache: "no-store", signal: requestController.signal });
      if (!response.ok) throw new Error("User search unavailable");
      people = (await response.json()).users || [];
    } catch { failed = true; }
    finally { clearTimeout(timeout); }
    if (version !== generation) return;
    const merged = new Map();
    for (const person of [...people, ...visibleAuthors(query)]) {
      const id = memberId(person.memberId);
      if (id && !merged.has(id)) merged.set(id, person);
    }
    list.replaceChildren();
    for (const person of [...merged.values()].slice(0, 20)) list.appendChild(personRow(person));
    const count = merged.size;
    status.textContent = count ? `${count} matching member${count === 1 ? "" : "s"}.` : failed ? "Member search is temporarily unavailable. Matching people in Your Mix will still appear here." : "No matching members yet. Check the spelling or try their profile name.";
  }

  function searchPeople() {
    const version = ++generation;
    const query = input.value.trim().toLocaleLowerCase();
    clearTimeout(timer);
    requestController?.abort();
    section.hidden = !query;
    list.replaceChildren();
    if (!query) { status.textContent = ""; return; }
    window.dispatchEvent(new CustomEvent("danzstak:show-search"));
    if (query.length < 2) { status.textContent = "Type at least 2 letters to find a member."; return; }
    status.textContent = "Searching members…";
    timer = setTimeout(() => runSearch(version, query), 250);
  }

  input.addEventListener("input", searchPeople);
  window.addEventListener("danzstak:posts-loaded", searchPeople);
})();
