"use strict";

(() => {
  const JOIN_URL = "https://danzstak.com/";
  const DEFAULT_MESSAGE = "Hey! Come join me on DanzStak. It’s an independent social network where we can chat, call, share things, and make plans together.";
  let dialog;
  let opener;

  const translate = value => globalThis.danzstakTranslate?.(value) || value;
  const fullMessage = value => `${String(value || "").trim()}\n${JOIN_URL}`.trim();
  const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  const smsUrl = value => `sms:${isAppleMobile() ? "&" : "?"}body=${encodeURIComponent(fullMessage(value))}`;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "invite-friend-dialog";
    dialog.setAttribute("aria-labelledby", "inviteFriendTitle");
    dialog.innerHTML = `
      <form method="dialog" class="invite-friend-card">
        <header><div><span class="invite-kicker">DanzStak</span><h2 id="inviteFriendTitle">Invite a friend</h2></div><button type="submit" class="invite-close" data-icon="close" aria-label="Close">×</button></header>
        <p class="invite-explainer">Bring someone you know to DanzStak. You choose who receives it and you press Send in your own app.</p>
        <label><span>Invitation message</span><textarea class="invite-message" rows="4" maxlength="420"></textarea></label>
        <p class="invite-link">${JOIN_URL}</p>
        <div class="invite-actions">
          <a class="invite-action invite-sms" href="#">Text message</a>
          <button type="button" class="invite-action invite-share">Share via apps</button>
          <button type="button" class="invite-action invite-copy">Copy invitation link</button>
        </div>
        <p class="invite-status" role="status" aria-live="polite"></p>
      </form>`;
    document.body.appendChild(dialog);
    const message = dialog.querySelector(".invite-message");
    const sms = dialog.querySelector(".invite-sms");
    const share = dialog.querySelector(".invite-share");
    const copy = dialog.querySelector(".invite-copy");
    const status = dialog.querySelector(".invite-status");
    const syncSms = () => { sms.href = smsUrl(message.value); };
    message.addEventListener("input", syncSms);
    sms.addEventListener("click", syncSms);
    share.addEventListener("click", async () => {
      status.textContent = "";
      if (!navigator.share) {
        status.textContent = translate("Your device could not open the share sheet. Copy the invitation link instead.");
        return;
      }
      try {
        await navigator.share({ title: "DanzStak", text: String(message.value || "").trim(), url: JOIN_URL });
      } catch (error) {
        if (error?.name !== "AbortError") status.textContent = translate("Your device could not open the share sheet. Copy the invitation link instead.");
      }
    });
    copy.addEventListener("click", async () => {
      status.textContent = "";
      try {
        await navigator.clipboard.writeText(JOIN_URL);
        status.textContent = translate("Invitation link copied.");
      } catch {
        message.value = fullMessage(message.value);
        message.focus();
        message.select();
        status.textContent = translate("Select and copy the invitation above.");
      }
    });
    dialog.addEventListener("close", () => opener?.focus());
    return dialog;
  }

  function open(button) {
    opener = button || document.activeElement;
    const current = ensureDialog();
    const message = current.querySelector(".invite-message");
    message.value = translate(DEFAULT_MESSAGE);
    current.querySelector(".invite-sms").href = smsUrl(message.value);
    current.querySelector(".invite-status").textContent = "";
    current.showModal();
    message.focus();
  }

  function bind(root = document) {
    for (const button of root.querySelectorAll("[data-invite-friend]")) {
      if (button.dataset.inviteBound === "true") continue;
      button.dataset.inviteBound = "true";
      button.addEventListener("click", () => open(button));
    }
  }

  globalThis.danzstakInvite = { open, bind, smsUrl, joinUrl: JOIN_URL };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => bind(), { once: true });
  else bind();
})();
