"use strict";
// One bottom tab bar on every signed-in page (audit 36 B2 + E11, directive F6). Before: Mix drew its own bar (.topnav)
// and every other page carried a hand-written copy (.ds-mobile-nav) with different spacing, a few pages lit the wrong
// tab (Moving Day lit Bazaar, Friends lit nothing), and Tour Manager, Support, Trusted contacts, Privacy and Terms had no
// bar at all. Now this file is the only definition: the six tabs, one page -> tab map, one stylesheet (app-tabs.css),
// the same markup and geometry everywhere. On Mix the tabs hand off to Mix's own screens (no page reload).
(() => {
  if (window.danzstakAppTabs) return;
  const t = value => window.danzstakTranslate?.(value) || value;
  const icon = paths => `<svg class="ds-tab-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths.map(d => `<path d="${d}"/>`).join("")}</svg>`;
  const TABS = [
    { id: "mix", label: "Mix", href: "feed.html?view=feed", feed: '[data-route="home"]', paths: ["m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"] },
    { id: "hq", label: "Music HQ", href: "feed.html?view=hq", feed: '.topnav [data-feature="HQ"]', paths: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M12 12h.01"] },
    { id: "events", label: "Events", href: "feed.html?view=events", feed: '.topnav [data-feature="Events"]', paths: ["M6 2v4", "M18 2v4", "M3 9h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"] },
    { id: "bazaar", label: "Bazaar", href: "bazaar.html", paths: ["M3 9h18", "m4 9 1-6h14l1 6", "M5 9v12h14V9", "M9 21v-7h6v7", "M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"] },
    { id: "sync", label: "SYNC", href: "messages.html", feed: "#messagesNav", paths: ["M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"] },
    { id: "menu", label: "Menu", href: "feed.html?view=feed&menu=1", feed: ".mobile-menu-control", paths: ["M4 6h16", "M4 12h16", "M4 18h16"] }
  ];
  // The one page -> tab map. Music HQ holds the musician tools; the Menu holds you, your people and your settings.
  const PAGE_TABS = {
    "feed.html": "mix", "": "mix",
    "epk.html": "hq", "booking.html": "hq", "booking-selections.html": "hq", "record-stores.html": "hq",
    "event.html": "events",
    "bazaar.html": "bazaar", "product.html": "bazaar", "store.html": "bazaar", "shop-example.html": "bazaar",
    "messages.html": "sync",
    "profile.html": "menu", "friends.html": "menu", "moving-day.html": "menu", "support.html": "menu", "trusted-contacts.html": "menu", "privacy.html": "menu", "terms.html": "menu"
  };
  // Pages that had no bar before (their layout leaves no room for it yet).
  const NEW_TO_THE_BAR = new Set(["booking-selections.html", "support.html", "trusted-contacts.html", "privacy.html", "terms.html"]);
  // Screens inside Mix (feed.html#name or ?view=name).
  const FEED_SCREENS = { feed: "mix", notifications: "mix", hq: "hq", events: "events", friends: "menu", groups: "menu", photos: "menu", videos: "menu", saved: "menu", settings: "menu" };
  const page = () => location.pathname.split("/").pop();
  const onFeed = () => PAGE_TABS[page()] === "mix";

  function tabFor(url = location.href, state = {}) {
    const target = new URL(url, location.href), name = target.pathname.split("/").pop();
    if (PAGE_TABS[name] !== "mix") return PAGE_TABS[name] ?? null;
    if (state.menuOpen) return "menu";
    if (state.syncOpen) return "sync";
    const screen = String(state.screen || target.hash.slice(1) || target.searchParams.get("view") || "feed").toLowerCase();
    return FEED_SCREENS[screen] || "mix"; // posts (#post-…) and anything else inside Mix
  }

  // What Mix is showing right now: the menu, the SYNC drawer, or one of its screens.
  function feedState() {
    const panel = document.getElementById("featureView"), drawer = document.getElementById("messageDrawer");
    return {
      menuOpen: document.body.classList.contains("mobile-menu-open"),
      syncOpen: Boolean(drawer && !drawer.hidden),
      screen: panel && !panel.hidden ? String(panel.dataset.workspaceName || "") : ""
    };
  }

  function light(nav) {
    const current = tabFor(location.href, onFeed() ? feedState() : {});
    for (const link of nav.querySelectorAll("a[data-tab]")) {
      if (link.dataset.tab === current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function render(nav) {
    nav.classList.add("ds-mobile-nav");
    nav.setAttribute("aria-label", t("DanzStak mobile navigation"));
    nav.replaceChildren(...TABS.map(tab => {
      const link = document.createElement("a");
      link.href = tab.href; link.dataset.tab = tab.id; link.innerHTML = icon(tab.paths);
      link.setAttribute("aria-label", t(tab.label)); link.title = t(tab.label);
      return link;
    }));
    light(nav);
    return nav;
  }

  // On Mix the tabs open Mix's own screens (menu drawer, SYNC, Music HQ, Events) instead of reloading the page.
  function handOff(nav) {
    nav.addEventListener("click", event => {
      const link = event.target.closest("a[data-tab]");
      const tab = TABS.find(item => item.id === link?.dataset.tab);
      const control = tab?.feed && document.querySelector(tab.feed);
      if (!control) return;
      event.preventDefault();
      control.click();
      requestAnimationFrame(() => light(nav));
    });
    for (const tab of TABS.filter(item => item.feed)) {
      const control = document.querySelector(tab.feed), link = nav.querySelector(`a[data-tab="${tab.id}"]`);
      if (!control || !link || !control.hasAttribute("aria-controls")) continue;
      link.setAttribute("aria-controls", control.getAttribute("aria-controls"));
      const mirror = () => link.setAttribute("aria-expanded", control.getAttribute("aria-expanded") || "false");
      mirror();
      new MutationObserver(mirror).observe(control, { attributes: true, attributeFilter: ["aria-expanded"] });
    }
    const relight = () => requestAnimationFrame(() => light(nav));
    const watch = (node, options) => node && new MutationObserver(relight).observe(node, options);
    watch(document.body, { attributes: true, attributeFilter: ["class", "data-mobile-screen"] });
    watch(document.getElementById("featureView"), { attributes: true, attributeFilter: ["hidden", "data-workspace-name"] });
    const drawerWatch = () => watch(document.getElementById("messageDrawer"), { attributes: true, attributeFilter: ["hidden"] });
    if (!drawerWatch()) new MutationObserver((records, observer) => { if (document.getElementById("messageDrawer")) { drawerWatch(); relight(); observer.disconnect(); } }).observe(document.body, { childList: true });
  }

  async function signedIn() {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("https://api.danzstak.com/auth/session", { credentials: "include", cache: "no-store", signal: controller.signal });
      return response.ok && (await response.json().catch(() => ({}))).authenticated === true;
    } catch { return false; }
    finally { clearTimeout(timer); }
  }

  const signedInOnly = document.currentScript?.hasAttribute("data-signed-in-only");
  async function mount() {
    if (document.querySelector("nav.ds-mobile-nav[data-app-tabs]")) return;
    if (signedInOnly && !(await signedIn())) return;
    const nav = document.querySelector("nav.ds-mobile-nav") || document.createElement("nav");
    nav.dataset.appTabs = "";
    render(nav);
    if (!nav.isConnected) document.body.append(nav);
    document.body.classList.add("has-app-tabs");
    if (NEW_TO_THE_BAR.has(page())) document.body.classList.add("app-tabs-pad");
    if (onFeed()) handOff(nav);
    addEventListener("hashchange", () => light(nav));
    addEventListener("popstate", () => light(nav));
  }

  window.danzstakAppTabs = { TABS, PAGE_TABS, FEED_SCREENS, tabFor };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void mount(), { once: true });
  else void mount();
})();
