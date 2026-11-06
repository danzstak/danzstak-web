"use strict";
(() => {
  const JOIN_URL = "https://danzstak.com/";
  const DEFAULT_MESSAGE = "Hey! Come join me on DANZSTAK. It's an independent social network where we can chat, call, share things, and make plans together.";
  let dialog;
  let opener;

  const translate = value => typeof window.danzstakTranslate === "function" ? window.danzstakTranslate(value) : value;
  const isAppleMobile = userAgent => /iPad|iPhone|iPod/i.test(String(userAgent || ""));
  const buildSmsHref = (message, userAgent = navigator.userAgent) => {
    const body = `${String(message || "").trim()} ${JOIN_URL}`.trim();
    return `sms:${isAppleMobile(userAgent) ? "&" : "?"}body=${encodeURIComponent(body)}`;
  };

  function createButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = translate(label);
    button.addEventListener("click", handler);
    return button;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "invite-friends-dialog";
    dialog.setAttribute("aria-labelledby", "inviteFriendsTitle");
    const panel = document.createElement("div");
    panel.className = "invite-friends-panel";
    const header = document.createElement("header");
    const headingWrap = document.createElement("div");
    const kicker = document.createElement("span");
    kicker.className = "invite-friends-kicker";
    kicker.textContent = "DANZSTAK";
    const heading = document.createElement("h2");
    heading.id = "inviteFriendsTitle";
    heading.textContent = translate("Invite a Friend");
    headingWrap.append(kicker, heading);
    const close = createButton("Close", "invite-friends-close", () => dialog.close());
    close.textContent = "";
    close.dataset.icon = "close";
    close.setAttribute("aria-label", translate("Close invitation"));
    close.title = translate("Close");
    header.append(headingWrap, close);
    const intro = document.createElement("p");
    intro.className = "invite-friends-intro";
    intro.textContent = translate("Choose how to invite someone. You pick the recipient and send the message yourself.");
    const label = document.createElement("label");
    label.className = "invite-friends-message";
    const labelText = document.createElement("span");
    labelText.textContent = translate("Invitation message");
    const message = document.createElement("textarea");
    message.id = "inviteFriendsMessage";
    message.rows = 4;
    message.maxLength = 420;
    message.value = translate(DEFAULT_MESSAGE);
    label.append(labelText, message);
    const url = document.createElement("p");
    url.className = "invite-friends-url";
    url.textContent = JOIN_URL;
    const status = document.createElement("p");
    status.className = "invite-friends-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "invite-friends-actions";
    const sms = createButton("Text message (SMS)", "primary", () => {
      status.textContent = translate("Opening your text message app. You choose the recipient and press Send.");
      window.location.href = buildSmsHref(message.value);
    });
    const share = createButton("Share via apps", "secondary", async () => {
      const text = message.value.trim();
      if (typeof navigator.share !== "function") {
        status.textContent = translate("Sharing apps are not available here. Copy the invitation link instead.");
        return;
      }
      try {
        await navigator.share({ title: "DANZSTAK", text, url: JOIN_URL });
        status.textContent = translate("Invitation shared.");
      } catch (error) {
        if (error?.name !== "AbortError") status.textContent = translate("Sharing did not open. Copy the invitation link instead.");
      }
    });
    const copy = createButton("Copy invitation link", "secondary", async () => {
      copy.disabled = true;
      try {
        await navigator.clipboard.writeText(JOIN_URL);
        status.textContent = translate("Invitation link copied.");
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(url);
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = translate("Select and copy the invitation link shown above.");
      } finally {
        copy.disabled = false;
      }
    });
    actions.append(sms, share, copy);
    const privacy = document.createElement("p");
    privacy.className = "invite-friends-privacy";
    privacy.textContent = translate("DANZSTAK does not read your contacts, collect the recipient's number, or send the invitation for you.");
    panel.append(header, intro, label, url, status, actions, privacy);
    dialog.appendChild(panel);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => opener?.focus?.());
    document.body.appendChild(dialog);
    return dialog;
  }

  function open(source) {
    opener = source instanceof HTMLElement ? source : document.activeElement;
    const current = ensureDialog();
    const message = current.querySelector("#inviteFriendsMessage");
    const heading = current.querySelector("#inviteFriendsTitle");
    heading.textContent = translate("Invite a Friend");
    message.value = translate(DEFAULT_MESSAGE);
    current.querySelector(".invite-friends-intro").textContent = translate("Choose how to invite someone. You pick the recipient and send the message yourself.");
    current.querySelector(".invite-friends-status").textContent = "";
    current.showModal();
    message.focus({ preventScroll: true });
    message.setSelectionRange(message.value.length, message.value.length);
  }

  window.danzstakInviteFriends = Object.freeze({ open, buildSmsHref, joinUrl: JOIN_URL });
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-invite-friends]");
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });
})();
