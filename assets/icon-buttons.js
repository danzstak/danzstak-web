"use strict";

(() => {
  const namespace = "http://www.w3.org/2000/svg";
  const paths = {
    expand: ["M8 3H3v5", "m3 3 6-6", "m16 6-6-6", "h5v5", "m16 10 6 6", "v-5h-5", "M8 21H3v-5", "m3 3 6-6"],
    minimize: ["M4 14h6v6", "m10 14-6 6", "m6-10 6-6", "v6h6"],
    close: ["M18 6 6 18", "m6-12 12 12"],
    trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6", "M10 11v5", "M14 11v5"],
    edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"],
    reply: ["m9 17-5-5 5-5", "M4 12h9a7 7 0 0 1 7 7"],
    send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
    search: ["m21 21-4.3-4.3", "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"],
    settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.3l-.5.3a1.7 1.7 0 0 0-.8 1.6v.1h-4v-.1a1.7 1.7 0 0 0-.8-1.6l-.5-.3a1.7 1.7 0 0 0-1.9.3l-.2.1L5 17l.1-.1a1.7 1.7 0 0 0 .3-1.9l-.3-.5a1.7 1.7 0 0 0-1.6-.8H3v-4h.5a1.7 1.7 0 0 0 1.6-.8l.3-.5a1.7 1.7 0 0 0-.3-1.9L5 6.4 7 3l.2.1a1.7 1.7 0 0 0 1.9.3l.5-.3a1.7 1.7 0 0 0 .8-1.6V1h4v.5a1.7 1.7 0 0 0 .8 1.6l.5.3a1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9l.3.5a1.7 1.7 0 0 0 1.6.8h.5v4h-.5a1.7 1.7 0 0 0-1.6.8Z"],
    bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
    share: ["M4 12v8h16v-8", "m16 6-4-4-4 4", "M12 2v14"],
    download: ["M12 3v12", "m7-5 5 5 5-5", "M5 21h14"],
    upload: ["M12 15V3", "m7 8 5-5 5 5", "M5 21h14"],
    paperclip: ["m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9"],
    camera: ["M14.5 4 16 7h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4l1.5-3Z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
    calendar: ["M6 2v4", "M18 2v4", "M3 9h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"],
    map: ["m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z", "M9 3v15", "M15 6v15"],
    phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z"],
    video: ["M15 10 21 6v12l-6-4", "M3 6h12v12H3Z"],
    more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
    back: ["M19 12H5", "M12 19 5 12l7-7"],
    refresh: ["M20 6v5h-5", "M4 18v-5h5", "M6.1 9A7 7 0 0 1 18 6l2 5", "M17.9 15A7 7 0 0 1 6 18l-2-5"],
    save: ["M5 3h12l2 2v16H5Z", "M8 3v6h8V3", "M8 21v-7h8v7"],
    eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    link: ["M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1", "M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"],
    menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
    chevron: ["m9 18 6-6-6-6"],
    chat: ["M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"],
    "thumbs-up": ["M7 10v11H3V10Z", "M7 10l4-8 2 1v6h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7"],
    "thumbs-down": ["M7 14V3H3v11Z", "M7 14l4 8 2-1v-6h6a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H7"],
    home: ["m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"],
    user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
    users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
    image: ["M3 5h18v14H3Z", "m3 16 5-5 4 4 3-3 6 6", "M16 9h.01"],
    film: ["M3 3h18v18H3Z", "M7 3v18", "M17 3v18", "M3 8h4", "M3 16h4", "M17 8h4", "M17 16h4"],
    microphone: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3", "M8 22h8"],
    bus: ["M5 16V5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11", "M4 12h16", "M6 16h12v3H6Z", "M8 19v2", "M16 19v2", "M8 7h8"],
    disc: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M12 12h.01"],
    folder: ["M3 5h7l2 2h9v12H3Z"],
    bookmark: ["M6 3h12v18l-6-4-6 4Z"],
    help: ["M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4", "M12 18h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"],
    lock: ["M5 10h14v11H5Z", "M8 10V7a4 4 0 0 1 8 0v3"],
    file: ["M6 2h8l4 4v16H6Z", "M14 2v5h5"],
    logout: ["M10 17l5-5-5-5", "M15 12H3", "M21 3v18h-6"],
    tag: ["M20 13 13 20 4 11V4h7Z", "M8.5 8.5h.01"],
    moon: ["M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"],
    sparkles: ["m12 3-1.2 3.3L7.5 7.5l3.3 1.2L12 12l1.2-3.3 3.3-1.2-3.3-1.2Z", "m19 14-.8 2.2-2.2.8 2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z", "m5 13-.8 2.2-2.2.8 2.2.8L5 19l.8-2.2L8 16l-2.2-.8Z"],
    wifi: ["M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 20h.01"],
    globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M2 12h20", "M12 2a15 15 0 0 1 0 20", "M12 2a15 15 0 0 0 0 20"],
    smartphone: ["M7 2h10v20H7Z", "M11 18h2"],
    activity: ["M3 12h4l2-7 4 14 2-7h6"],
    clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"]
    ,"volume-2": ["M11 5 6 9H2v6h4l5 4Z", "M15.5 8.5a5 5 0 0 1 0 7", "M18.5 5.5a9 9 0 0 1 0 13"]
    ,"volume-x": ["M11 5 6 9H2v6h4l5 4Z", "m16 9 5 5", "m21 9-5 5"]
  };
  const labels = new Map([
    ["open full screen", "expand"], ["open fullscreen", "expand"], ["exit full screen", "minimize"], ["exit fullscreen", "minimize"],
    ["close", "close"], ["delete", "trash"], ["edit", "edit"], ["reply", "reply"], ["send", "send"], ["search", "search"],
    ["settings", "settings"], ["notifications", "bell"], ["share", "share"], ["download", "download"], ["upload", "upload"],
    ["attach file", "paperclip"], ["add photo", "camera"], ["calendar", "calendar"], ["map", "map"], ["route", "map"],
    ["phone", "phone"], ["call", "phone"], ["video call", "video"], ["more options", "more"], ["back", "back"],
    ["refresh", "refresh"], ["save", "save"], ["view details", "eye"], ["copy link", "link"], ["expand menu", "menu"],
    ["collapse menu", "chevron"], ["open chat", "chat"]
  ]);

  function svg(name) {
    const node = document.createElementNS(namespace, "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "2");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    node.setAttribute("aria-hidden", "true");
    node.classList.add("ds-action-icon");
    node.setAttribute("data-ds-icon", name);
    for (const data of paths[name] || paths.more) {
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", data);
      node.append(path);
    }
    return node;
  }

  function readableLabel(control, visible) {
    return (control.getAttribute("aria-label") || control.getAttribute("title") || visible || "Action").trim();
  }

  function iconFromAccessibleName(control, visible) {
    if (/^[\p{P}\p{S}\s]+$/u.test(visible) || !visible) {
      const name = readableLabel(control, visible).toLocaleLowerCase("en-US");
      for (const [prefix, icon] of [["delete", "trash"], ["remove", "trash"], ["close", "close"], ["cancel", "close"], ["minimize", "minimize"], ["more", "more"], ["send", "send"], ["attach", "paperclip"], ["take a photo", "camera"], ["open camera", "camera"], ["phone", "phone"], ["video", "video"], ["reply", "reply"]]) if (name.startsWith(prefix)) return icon;
    }
    return "";
  }

  function upgrade(control) {
    if (!(control instanceof HTMLElement) || !control.matches("button, a.button, a[role='button'], label[data-icon]")) return;
    const visible = control.textContent.replace(/\s+/g, " ").trim();
    const requested = control.dataset.icon || labels.get(visible.toLocaleLowerCase("en-US")) || iconFromAccessibleName(control, visible);
    if (!requested || !paths[requested]) return;
    const label = readableLabel(control, visible);
    if (!control.hasAttribute("aria-label")) control.setAttribute("aria-label", label);
    if (!control.hasAttribute("title")) control.setAttribute("title", label);
    control.dataset.icon = requested;
    control.classList.add("ds-icon-button");
    const currentIcon = control.firstElementChild;
    if (control.childElementCount !== 1 || !currentIcon?.classList.contains("ds-action-icon") || currentIcon.getAttribute("data-ds-icon") !== requested) control.replaceChildren(svg(requested));
  }

  function upgradeMenuIcon(container) {
    if (!(container instanceof HTMLElement) || !container.matches("[data-menu-icon]")) return;
    const requested = container.dataset.menuIcon;
    if (!requested || !paths[requested]) return;
    container.replaceChildren(svg(requested));
    container.classList.add("ds-menu-icon");
  }

  function enhance(root = document) {
    if (root instanceof Element) upgrade(root);
    root.querySelectorAll?.("button, a.button, a[role='button'], label[data-icon]").forEach(upgrade);
    if (root instanceof Element) upgradeMenuIcon(root);
    root.querySelectorAll?.("[data-menu-icon]").forEach(upgradeMenuIcon);
  }

  window.danzstakIcons = { create: svg, enhance, upgrade };
  const start = () => {
    enhance();
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData") upgrade(record.target.parentElement?.closest("button, a.button, a[role='button'], label[data-icon]"));
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
