"use strict";
// People search in the top bar on every page (owner 2026-11-17: "I can't see other accounts").
// Mix, Music HQ and Events already have the header search box (feed.html); every other page gets the same search
// behind a standard search icon in its top bar. Name or @username, results as familiar person rows
// (people-search.js), never an email or phone number.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const HEADERS = [".market-header", ".tool-header", "body > header"];
  const icon = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>';
  const back = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"/></svg>';

  // Debounced search that renders person rows into `results` and messages into `status`.
  function searchInto(input, status, results) {
    let generation = 0, timer = 0, controller = null;
    return () => {
      const version = ++generation, query = input.value.trim();
      clearTimeout(timer); controller?.abort(); results.replaceChildren();
      if (!query) { status.textContent = ""; return false; }
      if (query.replace(/^@+/, "").length < 2) { status.textContent = t("Type at least 2 letters."); return true; }
      status.textContent = t("Searching members…");
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const people = await window.danzstakSearchPeople(query, controller.signal);
          if (version !== generation) return;
          results.replaceChildren(...people.slice(0, 20).map(person => window.danzstakPersonRow(person)));
          status.textContent = people.length ? "" : t("No one found. Try their name or @username.");
        } catch (error) {
          if (version !== generation || error.name === "AbortError") return;
          status.textContent = t("Member search is temporarily unavailable.");
        }
      }, 250);
      return true;
    };
  }

  // SYNC: like WhatsApp, the chat search box also finds people (its top bar is already full of call icons).
  function mountSync(chatSearch) {
    if (document.querySelector(".sync-people-results")) return;
    const section = document.createElement("section"), heading = document.createElement("h2"), status = document.createElement("p"), results = document.createElement("div");
    section.className = "sync-people-results"; section.hidden = true; section.setAttribute("aria-labelledby", "syncPeopleTitle");
    heading.id = "syncPeopleTitle"; heading.textContent = t("People");
    status.className = "ds-top-search-status"; status.setAttribute("role", "status");
    results.className = "user-search-list";
    section.append(heading, status, results);
    (chatSearch.closest("label") || chatSearch).insertAdjacentElement("afterend", section);
    chatSearch.placeholder = t("Search chats and people");
    chatSearch.setAttribute("aria-label", t("Search chats and people"));
    const run = searchInto(chatSearch, status, results);
    chatSearch.addEventListener("input", () => { section.hidden = !run(); });
  }

  function mount() {
    if (document.querySelector(".ds-top-search-button")) return;
    if (document.querySelector("input.search, .profile-header-search")) return; // this page already has the header search
    const chatSearch = document.getElementById("chatSearch");
    if (chatSearch) { mountSync(chatSearch); return; }
    const header = HEADERS.map(selector => document.querySelector(selector)).find(Boolean);
    if (!header) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ds-top-search-button";
    button.innerHTML = icon;
    button.setAttribute("aria-label", t("Search people"));
    button.title = t("Search people");
    header.append(button);

    const dialog = document.createElement("dialog");
    dialog.className = "ds-top-search";
    dialog.setAttribute("aria-label", t("Search people"));
    dialog.innerHTML = `<div class="ds-top-search-bar"><button type="button" class="ds-top-search-close">${back}</button><input type="search" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false"></div><p class="ds-top-search-status" role="status"></p><div class="ds-top-search-results user-search-list"></div>`;
    const close = dialog.querySelector(".ds-top-search-close"), input = dialog.querySelector("input"), status = dialog.querySelector(".ds-top-search-status"), results = dialog.querySelector(".ds-top-search-results");
    close.setAttribute("aria-label", t("Close search"));
    input.placeholder = t("Search name or @username");
    input.setAttribute("aria-label", t("Search name or @username"));
    document.body.append(dialog);

    let pushed = false;
    const run = searchInto(input, status, results);
    const open = () => {
      if (dialog.open) return;
      dialog.showModal(); input.focus();
      // Device Back closes search and returns to the page underneath.
      try { history.pushState({ dsTopSearch: true }, ""); pushed = true; } catch { pushed = false; }
    };
    const shut = fromHistory => {
      if (!dialog.open) return;
      dialog.close(); button.focus();
      if (!fromHistory && pushed) { pushed = false; history.back(); }
      pushed = false;
    };
    button.addEventListener("click", open);
    close.addEventListener("click", () => shut(false));
    dialog.addEventListener("cancel", event => { event.preventDefault(); shut(false); });
    window.addEventListener("popstate", () => shut(true));
    input.addEventListener("input", run);
    window.danzstakOpenTopSearch = open;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
