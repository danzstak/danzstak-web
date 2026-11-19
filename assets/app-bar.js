"use strict";
// One top bar on every page (fix-it 18, owner 2026-11-17): the same slim bar everywhere — logo, search, bell, SYNC.
// - Tool pages (Bazaar, Booking, EPK, Record shops, shop, Moving Day): their header becomes that bar. The old desktop
//   link rows go; the Bazaar's "Bazaar / My Shop" links become tabs under the bar.
// - Mix / Music HQ / Events keep their search box and bell and gain the SYNC icon.
// - The orange install arrow leaves the header (Menu → Install DanzStak, only when the browser offers it) and Pivot moves
//   into the Menu (and later HQ's Pivot card) instead of taking header space.
(() => {
  const t = value => window.danzstakTranslate?.(value) || value;
  const icons = {
    bell: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    sync: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>'
  };
  function iconLink(className, href, label, svg) {
    const a = document.createElement("a");
    a.className = `ds-app-bar-icon ${className}`; a.href = href; a.innerHTML = svg;
    a.setAttribute("aria-label", t(label)); a.title = t(label);
    return a;
  }

  // ---- tool pages ----
  function mountToolBar(header) {
    if (header.classList.contains("ds-app-bar")) return;
    header.classList.add("ds-app-bar");
    const brand = header.querySelector("a[href*='feed.html']") || header.querySelector("a");
    if (brand) { brand.classList.add("ds-app-bar-brand"); brand.setAttribute("href", "feed.html?view=feed"); if (!brand.getAttribute("aria-label")) brand.setAttribute("aria-label", t("DanzStak home")); }
    const nav = header.querySelector("nav");
    if (nav && /bazaar|store\.html/.test(nav.innerHTML) && document.body.matches(".bazaar-page, :has(.market-header)")) {
      nav.classList.add("ds-app-tabs"); nav.setAttribute("role", "tablist");
      nav.querySelectorAll("a").forEach(link => link.setAttribute("role", "tab"));
      header.after(nav);
    } else if (nav) nav.classList.add("ds-app-bar-links");
    const actions = document.createElement("div");
    actions.className = "ds-app-bar-actions";
    actions.append(iconLink("ds-app-bar-bell", "feed.html#notifications", "Notifications", icons.bell), iconLink("ds-app-bar-sync", "messages.html", "SYNC", icons.sync));
    header.appendChild(actions);
    // top-search.js puts its search icon in the header; keep it first among the actions.
    const adoptSearch = () => { const search = header.querySelector(".ds-top-search-button, .top-search-toggle, [data-top-search]"); if (search && search.parentElement !== actions) actions.prepend(search); return Boolean(search); };
    if (!adoptSearch()) new MutationObserver((records, observer) => { if (adoptSearch()) observer.disconnect(); }).observe(header, { childList: true, subtree: true });
  }

  // ---- Mix / Music HQ / Events (feed.html) ----
  function mountFeedBar(topbar) {
    if (topbar.querySelector(".ds-app-bar-sync")) return;
    topbar.classList.add("ds-feed-bar");
    const sync = iconLink("ds-app-bar-sync", "messages.html", "SYNC", icons.sync);
    sync.addEventListener("click", event => { const drawer = document.getElementById("messagesNav"); if (drawer) { event.preventDefault(); drawer.click(); } });
    const bell = topbar.querySelector(".header-notifications");
    (bell || topbar.lastElementChild).after(sync);
  }

  // ---- Menu: Pivot and Install move here ----
  function mountMenu() {
    const menu = document.getElementById("mobileNavMenu");
    if (!menu || menu.querySelector(".menu-pivot")) return;
    const anchor = menu.querySelector("a[data-feature='Settings']");
    const pivot = document.createElement("a");
    pivot.href = "#pivot"; pivot.className = "menu-pivot"; pivot.setAttribute("data-pivot-trigger", "");
    pivot.innerHTML = '<span class="menu-icon" data-menu-icon="refresh" aria-hidden="true"></span><span class="menu-label"></span>';
    pivot.querySelector(".menu-label").textContent = t("Pivot your data");
    pivot.addEventListener("click", event => event.preventDefault());
    const install = document.createElement("a");
    install.href = "#install"; install.className = "menu-install"; install.hidden = true;
    install.innerHTML = '<span class="menu-icon" aria-hidden="true">' + icons.download + '</span><span class="menu-label"></span>';
    install.querySelector(".menu-label").textContent = t("Install DanzStak");
    // One install item (owner 2026-11-18): the browser's one-tap install where offered, the Add to Home Screen steps on iPhone/iPad.
    install.addEventListener("click", event => {
      event.preventDefault();
      void (async () => {
        if (window.danzstakIsAppleMobile !== true && typeof window.danzstakRequestInstall === "function") {
          const result = await window.danzstakRequestInstall();
          if (result === "accepted" || result === "dismissed") return;
          if (result === "installed") { window.danzstakShowFeedback?.(t("DanzStak is already installed on this device."), { timeout: 4000 }); return; }
        }
        // No one-tap install here (iPhone/iPad, or the browser didn't offer it): show the steps.
        window.danzstakOpenInstallHelp?.();
      })();
    });
    if (anchor) { anchor.before(pivot); anchor.before(install); } else menu.append(pivot, install);
    window.danzstakIcons?.enhance?.(pivot);
    // Show "Install DanzStak" only while the browser offers installation (pwa.js toggles its own hidden button).
    // Only write when it changes: writing `hidden` fires this observer again (a same-value write still counts).
    const standalone = (() => { try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } })();
    const appleNeedsSteps = () => !standalone && window.danzstakIsAppleMobile === true && typeof window.danzstakOpenInstallHelp === "function";
    // Owner 2026-11-18: always offer "Install DanzStak" until it is installed, for members who don't know how to add a PWA.
    const sync = () => { const button = document.querySelector(".install-app-button"), next = standalone || ((!button || button.hidden) && !appleNeedsSteps() && typeof window.danzstakOpenInstallHelp !== "function"); if (install.hidden !== next) install.hidden = next; };
    sync();
    const button = document.querySelector(".install-app-button");
    if (button) new MutationObserver(sync).observe(button, { attributes: true, attributeFilter: ["hidden"] });
    else new MutationObserver((records, observer) => { if (document.querySelector(".install-app-button")) { observer.disconnect(); sync(); new MutationObserver(sync).observe(document.querySelector(".install-app-button"), { attributes: true, attributeFilter: ["hidden"] }); } }).observe(document.body, { childList: true });
  }

  function start() {
    document.body.classList.add("ds-has-app-bar");
    const topbar = document.querySelector("header.topbar");
    if (topbar) { mountFeedBar(topbar); mountMenu(); return; }
    const header = document.querySelector("body > header");
    if (header) mountToolBar(header);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
