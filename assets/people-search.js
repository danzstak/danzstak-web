"use strict";
(() => {
  const input = document.querySelector(".search");
  const feed = document.getElementById("feed");
  const feedPanel = Boolean(input && feed); // the shared row and search helpers work on every page

  const section = document.createElement("section");
  section.className = "panel user-search-results";
  section.hidden = true;
  section.setAttribute("aria-label", "Matching users");
  const heading = document.createElement("h3");
  heading.textContent = "People";
  const help = document.createElement("p");
  help.className = "muted user-search-help";
  help.textContent = (window.danzstakTranslate?.("Find a DanzStak member by name or @username and send a friend request.") || "Find a DanzStak member by name or @username and send a friend request.");
  const status = document.createElement("p");
  status.className = "muted";
  status.setAttribute("role", "status");
  const list = document.createElement("div");
  list.className = "user-search-list";
  section.append(heading, help, status, list);
  if (feedPanel) feed.insertAdjacentElement("beforebegin", section);

  let generation = 0;
  let timer;
  let requestController;

  async function peopleFetch(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    let timedOut = false;
    const cancel = () => controller.abort();
    if (externalSignal?.aborted) cancel();
    else externalSignal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal });
    } catch (error) {
      if (error.name === "AbortError" && !timedOut) throw error;
      if (error.name === "AbortError") throw new Error("DanzStak member search took too long. Try again.");
      throw new Error("DanzStak cannot connect right now. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener?.("abort", cancel);
    }
  }

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

  // Familiar person row (owner 2026-11-17): avatar, name, @username, friend state and Message. Never an email or number.
  const t = value => window.danzstakTranslate?.(value) || value;
  const tf = (value, values) => Object.entries(values).reduce((text, [key, replacement]) => text.split("{" + key + "}").join(replacement), t(value));
  const messageIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L5 22l4-2.1c.9.2 1.9.4 3 .4 5.5 0 10-3.9 10-8.6S17.5 3 12 3Z"/></svg>';
  function personRow(person) {
    const id = memberId(person.memberId);
    const row = document.createElement("div");
    row.className = "user-search-result person-row";
    const profileHref = id ? "profile.html?member=" + encodeURIComponent(id) : "";
    const avatarLink = document.createElement(id ? "a" : "span");
    avatarLink.className = "user-search-avatar";
    if (id) { avatarLink.href = profileHref; avatarLink.tabIndex = -1; avatarLink.setAttribute("aria-hidden", "true"); }
    if (person.picture) {
      const image = document.createElement("img");
      image.src = person.picture; image.alt = ""; image.referrerPolicy = "no-referrer"; image.loading = "lazy";
      window.danzstakIdentityMedia?.install(image, person);
      avatarLink.append(image);
    } else avatarLink.textContent = String(person.name || "D").charAt(0).toUpperCase();
    const identity = document.createElement("span");
    identity.className = "user-search-identity";
    const name = document.createElement(id ? "a" : "strong");
    if (id) name.href = profileHref;
    name.textContent = person.name || "";
    if (id) name.setAttribute("aria-label", tf("Open {name} profile", { name: name.textContent }));
    name.setAttribute("data-no-translate", "");
    identity.appendChild(name);
    const handle = String(person.handle || "").replace(/^@+/, "");
    if (handle) { const detail = document.createElement("small"); detail.textContent = "@" + handle; detail.setAttribute("data-no-translate", ""); identity.appendChild(detail); }
    const actions = document.createElement("span");
    actions.className = "person-row-actions";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "user-search-action";
    const setState = state => {
      action.dataset.state = state;
      action.disabled = state === "outgoing" || state === "sending";
      action.textContent = t({ friends: "Friends", outgoing: "Requested", incoming: "Respond", "visible-author": "View profile", sending: "Sending…" }[state] || "Add friend");
      action.setAttribute("aria-label", state === "none" ? tf("Add {name} as a friend", { name: name.textContent }) : action.textContent);
    };
    setState(person.friendStatus || "none");
    action.addEventListener("click", async () => {
      const state = action.dataset.state;
      if (state === "friends" || state === "visible-author") { location.href = profileHref; return; }
      if (state === "incoming") { location.href = "feed.html#notifications"; return; }
      if (state !== "none") return;
      setState("sending");
      try {
        const response = await peopleFetch("/friends/request", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: id }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t("Friend request could not be sent."));
        setState(data.alreadyFriends ? "friends" : "outgoing");
        window.danzstakShowFeedback?.(tf(data.alreadyFriends ? "You and {name} are already friends." : "Friend request sent to {name}.", { name: name.textContent }));
      } catch (error) {
        setState("none");
        window.danzstakShowFeedback?.(t(error.message || "Friend request could not be sent."), { urgent: true });
      }
    });
    actions.append(action);
    if (id) {
      const message = document.createElement("a");
      message.className = "person-row-message";
      message.href = "messages.html?member=" + encodeURIComponent(id);
      message.innerHTML = messageIcon;
      message.setAttribute("aria-label", tf("Message {name}", { name: name.textContent }));
      message.title = t("Message");
      actions.append(message);
    }
    row.append(avatarLink, identity, actions);
    return row;
  }
  window.danzstakPersonRow = personRow;
  window.danzstakSearchPeople = async (query, signal) => {
    const response = await peopleFetch("/people?query=" + encodeURIComponent(query), { credentials: "include", cache: "no-store", signal });
    if (!response.ok) throw new Error(t("Member search is temporarily unavailable."));
    return (await response.json()).users || [];
  };

  window.danzstakMountPeopleFinder = function mountPeopleFinder(container, options = {}) {
    if (!container || container.querySelector(".friend-name-finder")) return;
    const finder = document.createElement("section");
    finder.className = "friend-name-finder" + (options.compact ? " friend-name-finder-compact" : "");
    finder.setAttribute("aria-labelledby", "friendNameFinderTitle");
    const title = document.createElement("h3");
    title.id = "friendNameFinderTitle";
    title.textContent = "Find people";
    const instructions = document.createElement("p");
    instructions.className = "muted";
    instructions.textContent = "Type their name. They do not need to be online.";
    const label = document.createElement("label");
    label.className = "friend-name-search";
    const labelText = document.createElement("span");
    labelText.textContent = "Name";
    const search = options.searchInput || document.createElement("input");
    search.type = "search";
    search.autocomplete = "off";
    search.placeholder = "Example: Sigmund";
    search.setAttribute("aria-describedby", "friendNameFinderStatus");
    const finderStatus = document.createElement("p");
    finderStatus.id = "friendNameFinderStatus";
    finderStatus.className = "muted";
    finderStatus.setAttribute("role", "status");
    const results = document.createElement("div");
    results.className = "user-search-list friend-name-results";
    if (options.compact) finder.append(finderStatus, results);
    else {
      label.append(labelText, search);
      finder.append(title, instructions, label, finderStatus, results);
    }
    container.appendChild(finder);

    let finderGeneration = 0;
    let finderTimer;
    let finderController;
    const searchMembers = () => {
      const version = ++finderGeneration;
      const query = search.value.trim();
      clearTimeout(finderTimer);
      finderController?.abort();
      results.replaceChildren();
      if (!query) { finderStatus.textContent = ""; return; }
      if (query.length < 2) { finderStatus.textContent = "Type at least 2 letters."; return; }
      finderStatus.textContent = "Searching members…";
      finderTimer = setTimeout(async () => {
        finderController = new AbortController();
        const timeout = setTimeout(() => finderController.abort(), 10000);
        try {
          const response = await peopleFetch("/people?query=" + encodeURIComponent(query), { credentials: "include", cache: "no-store", signal: finderController.signal });
          if (!response.ok) throw new Error("Member search is temporarily unavailable.");
          const people = (await response.json()).users || [];
          if (version !== finderGeneration) return;
          results.replaceChildren(...people.slice(0, 20).map(personRow));
          finderStatus.textContent = people.length ? `${people.length} matching member${people.length === 1 ? "" : "s"}.` : "No matching members. Check the spelling of their profile name.";
        } catch (error) {
          if (version !== finderGeneration || error.name === "AbortError") return;
          finderStatus.textContent = error.message || "Member search is temporarily unavailable.";
        } finally { clearTimeout(timeout); }
      }, 250);
    };
    search.addEventListener("input", searchMembers);
    if (search.value.trim()) searchMembers();
    return { search, refresh: searchMembers };
  };

  async function runSearch(version, query) {
    requestController?.abort();
    requestController = new AbortController();
    const timeout = setTimeout(() => requestController.abort(), 10000);
    let people = [], failed = false;
    try {
      const response = await peopleFetch("/people?query=" + encodeURIComponent(query), { credentials: "include", cache: "no-store", signal: requestController.signal });
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

  if (!feedPanel) return;
  input.addEventListener("input", searchPeople);
  window.addEventListener("danzstak:posts-loaded", searchPeople);
})();
