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
    back: ["m15 18-6-6 6-6"],
    refresh: ["M20 6v5h-5", "M4 18v-5h5", "M6.1 9A7 7 0 0 1 18 6l2 5", "M17.9 15A7 7 0 0 1 6 18l-2-5"],
    save: ["M5 3h12l2 2v16H5Z", "M8 3v6h8V3", "M8 21v-7h8v7"],
    eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    link: ["M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1", "M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"],
    menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
    chevron: ["m9 18 6-6-6-6"],
    chat: ["M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"]
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
    if (control.childElementCount !== 1 || !control.firstElementChild?.classList.contains("ds-action-icon")) control.replaceChildren(svg(requested));
  }

  function enhance(root = document) {
    if (root instanceof Element) upgrade(root);
    root.querySelectorAll?.("button, a.button, a[role='button'], label[data-icon]").forEach(upgrade);
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
