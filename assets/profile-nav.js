"use strict";
// Fix-it 18, Profile page items 4 and 5 (owner 2026-11-17): profile navigation members already know.
// Phone top bar: back arrow, the member's name, search, Pivot, and the bell (owner 2026-11-23: "There should be a
// notification icon on this page as well"). Visitor actions in one compact row: Add friend / Message / more (⋯).
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const fmt = (value, values) => t(value).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

  // ---- top bar ----
  function goBack() {
    let sameSite = false;
    try { sameSite = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch {}
    if (sameSite && history.length > 1) history.back(); else location.href = "feed.html?view=feed";
  }
  function mountHeader() {
    const header = document.querySelector("header.profile-app-header");
    if (!header || header.querySelector(".profile-back")) return;
    const back = document.createElement("button");
    back.type = "button"; back.className = "profile-back"; back.dataset.icon = "back";
    back.setAttribute("aria-label", t("Back")); back.title = t("Back");
    back.addEventListener("click", goBack);
    const name = document.createElement("strong");
    name.className = "profile-header-name";
    name.setAttribute("aria-hidden", "true"); // the page's h1 carries the name for assistive tech
    const search = document.createElement("button");
    search.type = "button"; search.className = "profile-search-toggle"; search.dataset.icon = "search";
    search.setAttribute("aria-label", t("Search")); search.title = t("Search");
    search.setAttribute("aria-expanded", "false"); search.setAttribute("aria-controls", "profileHeaderSearch");
    const form = header.querySelector(".profile-header-search"), input = form?.querySelector("input[type=search]");
    const close = () => { header.classList.remove("is-searching"); search.setAttribute("aria-expanded", "false"); };
    search.addEventListener("click", () => {
      const open = !header.classList.contains("is-searching");
      header.classList.toggle("is-searching", open); search.setAttribute("aria-expanded", String(open));
      if (open) input?.focus(); else search.focus();
    });
    input?.addEventListener("keydown", event => { if (event.key === "Escape") { close(); search.focus(); } });
    input?.addEventListener("blur", () => { if (!input.value.trim()) setTimeout(close, 120); });
    // The bell opens Notifications in Mix, like the bell on every other page, with the same count of what's new.
    const bell = document.createElement("a");
    bell.className = "profile-bell"; bell.href = "feed.html#notifications";
    bell.setAttribute("aria-label", t("Notifications")); bell.title = t("Notifications");
    const bellIcon = window.danzstakIcons?.create?.("bell");
    if (bellIcon) bell.append(bellIcon);
    const count = document.createElement("span");
    count.className = "nav-count"; count.hidden = true; count.setAttribute("aria-hidden", "true");
    header.prepend(back);
    back.after(name);
    (form || name).after(search);
    (header.querySelector(".ds-app-bar-pivot") || search).after(bell);
    watchBell(bell, count);
    const paint = () => { name.textContent = window.danzstakCurrentProfile?.name || document.getElementById("profileName")?.textContent?.trim() || ""; };
    paint();
    window.addEventListener("danzstak:profile-loaded", paint);
    window.danzstakIcons?.enhance?.(header);
  }

  // What's new: friend requests and the like (/notifications) plus unread reactions and comments
  // (/engagement-notifications), the same two lists Mix counts. Refreshed when the page comes back to the front.
  function watchBell(bell, count) {
    let loading = false;
    const paint = total => {
      count.hidden = total === 0; count.textContent = total > 99 ? "99+" : String(total);
      bell.append(count);
      const label = t("Notifications");
      const text = total ? fmt(total === 1 ? "{label}, {count} new notification" : "{label}, {count} new notifications", { label, count: total }) : label;
      bell.setAttribute("aria-label", text); bell.title = text;
    };
    const refresh = async () => {
      if (loading || document.hidden) return;
      loading = true;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
      try {
        const [social, engagement] = await Promise.all(["notifications", "engagement-notifications"].map(path =>
          fetch(`https://api.danzstak.com/${path}`, { credentials: "include", cache: "no-store", signal: controller.signal })
            .then(response => response.ok ? response.json() : null).catch(() => null)));
        if (!social && !engagement) return;
        paint((social?.notifications || []).length + (engagement?.notifications || []).filter(notice => notice.unread !== false).length);
      } finally { clearTimeout(timer); loading = false; }
    };
    void refresh();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh(); });
  }

  // ---- visitor action row: Add friend / Message / ⋯ ----
  let menu = null;
  function closeMenu() { if (menu) { menu.hidden = true; menu.previousElementSibling?.setAttribute("aria-expanded", "false"); } }
  function mountVisitorActions(profile) {
    if (!profile || profile.isOwner === true) return;
    const actions = document.querySelector(".profile-actions:not(.profile-locked-friend)");
    const message = document.getElementById("profileMessage");
    if (!actions) return;
    if (message && !message.hidden && message.parentElement !== actions) {
      const holder = message.parentElement;
      message.dataset.icon = "chat";
      message.setAttribute("role", "button");
      const label = fmt("Message {name}", { name: profile.name || t("this member") });
      message.setAttribute("aria-label", label); message.title = label;
      const friend = actions.querySelector(".profile-friend-action");
      if (friend) friend.after(message); else actions.prepend(message);
      if (holder && holder.tagName === "P" && !holder.childElementCount && !holder.textContent.trim()) holder.remove();
      window.danzstakIcons?.upgrade?.(message);
    }
    const share = [...actions.querySelectorAll("button")].find(button => button.dataset.icon === "share");
    if (!share || actions.querySelector(".profile-more")) return;
    // Share moves into ⋯ for visitors, so the row stays Add friend / Message / more.
    share.classList.add("profile-share-hidden");
    const more = document.createElement("button");
    more.type = "button"; more.className = "profile-more"; more.dataset.icon = "more";
    more.setAttribute("aria-label", t("More")); more.title = t("More");
    more.setAttribute("aria-haspopup", "menu"); more.setAttribute("aria-expanded", "false");
    menu = document.createElement("div");
    menu.className = "profile-more-menu"; menu.setAttribute("role", "menu"); menu.hidden = true;
    const item = document.createElement("button");
    item.type = "button"; item.setAttribute("role", "menuitem"); item.textContent = t("Share profile");
    item.addEventListener("click", () => { closeMenu(); share.click(); });
    menu.appendChild(item);
    more.addEventListener("click", event => {
      event.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open; more.setAttribute("aria-expanded", String(open));
      if (open) item.focus();
    });
    menu.addEventListener("keydown", event => { if (event.key === "Escape") { closeMenu(); more.focus(); } });
    document.addEventListener("click", event => { if (menu && !menu.hidden && !menu.contains(event.target)) closeMenu(); });
    const wrap = document.createElement("span");
    wrap.className = "profile-more-wrap";
    wrap.append(more, menu);
    actions.appendChild(wrap);
    window.danzstakIcons?.enhance?.(wrap);
  }

  // Defer scripts run after parsing but before DOMContentLoaded, so start there: the action row exists by then.
  const start = () => {
    mountHeader();
    // Runs after profile-friend.js has added Add friend (same event, queued after it).
    const run = () => setTimeout(() => mountVisitorActions(window.danzstakCurrentProfile), 0);
    window.addEventListener("danzstak:profile-loaded", run);
    if (window.danzstakCurrentProfile) run();
  };
  // Deferred scripts run while readyState is already "interactive" but before profile-editor.js has built the action
  // row, so always start at DOMContentLoaded (this file is only ever loaded with defer).
  if (document.readyState === "complete") start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
