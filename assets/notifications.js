"use strict";
// Notifications on the UI kit (docs/tasks/39-modern-look.md, screen 1; CLAUDE.md F8 "Example, Notifications").
// The familiar pattern: New / Earlier sections, unread rows on a soft tint, a 56px avatar with a small round type badge,
// the name in bold inside one running sentence, a relative time ("12h", "3d"), and the whole row tappable (no "View
// post" buttons). Friend requests keep their Accept / Decline buttons under the sentence, as people expect.
// feed-enhancements.js loads the notifications and writes each sentence; this file only draws them.
(() => {
  const t = key => window.danzstakTranslate?.(key) || key;
  const icon = name => window.danzstakIcon ? window.danzstakIcon(name, { size: "sm" }) : document.createElement("span");
  // Type → Lucide icon in the badge and its colour (tokens only: accent, go, danger, ink).
  const BADGES = {
    reaction: ["thumbs-up", "accent"], comment: ["message-circle", "go"], reply: ["message-circle", "go"], tag: ["bell", "ink"],
    friend_request: ["user-plus", "ink"], friend_accepted: ["check", "go"], message: ["send", "accent"], plan: ["calendar", "accent"],
    booking_reply: ["ticket", "accent"], group_everyone: ["users", "ink"], device: ["phone", "accent"]
  };

  // "{name} commented: {preview}" → [<strong>name</strong>, " commented: …"]. Only the values named in `bold` are bold.
  function sentence(template, values = {}, bold = ["name"]) {
    const p = document.createElement("p");
    p.className = "ds-row__text";
    for (const part of String(template).split(/(\{[a-z]+\})/)) {
      const key = part.match(/^\{([a-z]+)\}$/)?.[1];
      if (key && key in values) {
        if (bold.includes(key)) { const strong = document.createElement("strong"); strong.textContent = String(values[key]); p.append(strong); }
        else p.append(String(values[key]));
      } else if (part) p.append(part);
    }
    return p;
  }

  // One list row. `open` is either { href } (a link) or { onClick } (a button: chats open in a drawer).
  function row({ kind, unread, text, time, avatar = {}, open = {}, actions = [], extraClass = "" }) {
    const article = document.createElement("article");
    article.className = ["ds-row", "notification-row", unread ? "is-unread" : "is-read", extraClass].filter(Boolean).join(" ");
    article.dataset.kind = kind;
    // The whole row is one tap target, drawn over everything except the avatar link and the action buttons.
    const target = document.createElement(open.href ? "a" : "button");
    target.className = "ds-row__target";
    if (open.href) target.href = open.href;
    else { target.type = "button"; if (open.onClick) target.addEventListener("click", open.onClick); }
    target.setAttribute("aria-label", text.textContent.trim());
    if (!open.href && !open.onClick) target.disabled = true;

    const face = document.createElement(avatar.profileHref ? "a" : "span");
    face.className = "ds-row__avatar";
    if (avatar.profileHref) { face.href = avatar.profileHref; face.setAttribute("aria-label", avatar.profileLabel || ""); }
    else face.setAttribute("aria-hidden", "true");
    const photo = document.createElement("span");
    photo.className = "ds-row__photo";
    if (avatar.picture) {
      const img = document.createElement("img");
      img.src = avatar.picture; img.alt = ""; img.width = 56; img.height = 56; img.referrerPolicy = "no-referrer"; img.decoding = "async";
      if (avatar.person) window.danzstakIdentityMedia?.install(img, avatar.person);
      photo.append(img);
    } else photo.textContent = String(avatar.initial || "").charAt(0).toUpperCase();
    const [iconName, tone] = BADGES[kind] || ["bell", "ink"];
    const badge = document.createElement("span");
    badge.className = `ds-row__badge ds-row__badge--${tone}`;
    badge.append(icon(iconName));
    face.append(photo, badge);

    const body = document.createElement("div");
    body.className = "ds-row__body";
    body.append(text);
    if (time) {
      const stamp = document.createElement("time");
      stamp.className = "ds-row__time";
      stamp.dateTime = time;
      // One time label everywhere (B4): "now", "5m", "12h", "3d", then "Nov 16".
      if (!window.danzstakTimeLabel?.paint(stamp, time)) stamp.textContent = t("now");
      body.append(stamp);
    }
    if (actions.length) {
      const bar = document.createElement("div");
      bar.className = "ds-row__actions notification-actions";
      bar.append(...actions);
      body.append(bar);
    }
    article.append(target, face, body);
    if (unread) { const dot = document.createElement("span"); dot.className = "ds-row__dot"; dot.setAttribute("aria-hidden", "true"); article.append(dot); }
    return article;
  }

  // A button for a row's own actions (friend requests): "go" is the green pill, "quiet" the grey one.
  function action(label, tone, onClick, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ds-btn ds-btn--${tone}`;
    button.textContent = label;
    if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", onClick);
    return button;
  }

  // New (unread) first, then Earlier; each section keeps the server's newest-first order.
  function place(list, rows) {
    const groups = [["New", rows.filter(item => item.unread)], ["Earlier", rows.filter(item => !item.unread)]];
    for (const [title, items] of groups) {
      if (!items.length) continue;
      const section = document.createElement("section");
      section.className = "ds-section";
      const heading = document.createElement("h3");
      heading.className = "ds-section__title";
      heading.textContent = t(title);
      section.append(heading, ...items.flatMap(item => [item.node, ...(item.after || [])]));
      list.append(section);
    }
  }

  // Shimmer rows shaped like the content, instead of "Loading…" (the words stay for screen readers).
  function skeleton(list, label) {
    const status = document.createElement("p");
    status.className = "ds-sr-only";
    status.setAttribute("role", "status");
    status.textContent = label;
    list.append(status);
    for (let i = 0; i < 4; i += 1) {
      const ghost = document.createElement("div");
      ghost.className = "ds-row ds-row--skeleton";
      ghost.setAttribute("aria-hidden", "true");
      ghost.innerHTML = '<span class="ds-row__avatar"><span class="ds-row__photo ds-shimmer"></span></span><span class="ds-row__body"><span class="ds-shimmer ds-shimmer--line"></span><span class="ds-shimmer ds-shimmer--short"></span></span>';
      list.append(ghost);
    }
  }

  window.danzstakNotifications = Object.freeze({ sentence, row, action, place, skeleton });
})();
