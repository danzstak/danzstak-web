"use strict";
// Answer to join (owner 2026-11-18). Signing up for SYNC makes someone a DanzStak member.
//
// Invitee: answer.html → signup → messages.html?invite=<token>. After they choose a name, the invite is
// redeemed (it makes them friends with the caller) and SYNC opens the caller's conversation. Calls still
// need this device verified by SMS, so the next sheet asks for that, then one tap connects the call.
// Caller: inside the Invite a friend dialog, "Voice call" / "Video call" create a one-time link and show
// "Waiting for your friend to join…" instead of a ring timeout. Nothing here touches phone numbers.
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const t = value => window.danzstakTranslate?.(value) || value;
  const tf = (value, values) => Object.entries(values).reduce((text, [key, replacement]) => text.replaceAll(`{${key}}`, replacement), t(value));

  async function api(path, options = {}, device = false) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    if (device && typeof window.danzstakCallingDeviceHeaders === "function") Object.assign(headers, await window.danzstakCallingDeviceHeaders().catch(() => ({})));
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API + path, { credentials: "include", cache: "no-store", ...options, headers, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch { return { ok: false, status: 0, data: { error: "DanzStak can't connect right now. Check your connection and try again." } }; }
    finally { clearTimeout(timer); }
  }

  function sheet({ kicker = "SYNC", title, body, primary, secondary }) {
    document.querySelector(".call-invite-sheet")?.remove();
    const dialog = document.createElement("dialog");
    dialog.className = "call-invite-sheet";
    dialog.setAttribute("aria-labelledby", "callInviteSheetTitle");
    const k = document.createElement("p"); k.className = "call-invite-kicker"; k.textContent = kicker;
    const h = document.createElement("h2"); h.id = "callInviteSheetTitle"; h.textContent = title;
    const p = document.createElement("p"); p.textContent = body;
    const row = document.createElement("div"); row.className = "call-invite-row";
    for (const action of [secondary, primary].filter(Boolean)) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = action.label;
      if (action === primary) button.className = "call-invite-go";
      button.addEventListener("click", () => { dialog.close(); dialog.remove(); action.run?.(); });
      row.append(button);
    }
    dialog.append(k, h, p, row);
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector(".call-invite-go")?.focus();
    return dialog;
  }

  const cleanUrl = keep => { const next = new URLSearchParams(); for (const key of keep) if (params.get(key)) next.set(key, params.get(key)); history.replaceState(null, "", location.pathname + (next.size ? `?${next}` : "")); };

  // ---------- Invitee ----------
  async function nameChosen() {
    const result = await api("/profiles");
    if (!result.ok) return false;
    if (!window.danzstakSignupOnboarding?.needsName?.(result.data.profile || {})) return true;
    await new Promise(resolve => window.addEventListener("danzstak:profile-name-chosen", resolve, { once: true }));
    return true;
  }

  async function redeem(token) {
    if (!(await nameChosen())) return;
    const result = await api("/calls/invites/redeem", { method: "POST", body: JSON.stringify({ token }) });
    if (result.ok && /^[a-f0-9-]{36}$/.test(result.data.caller?.memberId || "")) {
      const next = new URLSearchParams({ member: result.data.caller.memberId, invited: result.data.kind === "video" ? "video" : "audio" });
      if (result.data.live === false) next.set("missed", "1");
      location.replace(`${location.pathname.startsWith("/sync/") ? "/sync/" : "messages.html"}?${next}`); // task 34: stay in the SYNC app
      return;
    }
    cleanUrl([]);
    const gone = result.data.code === "CALL_INVITE_CANCELLED" ? "Your friend cancelled this call invite." : t(result.data.error || "This call invite has ended. Ask your friend to send a new one.");
    sheet({ title: t("Welcome to DanzStak"), body: `${t(gone)} ${t("You're a member now: SYNC, Mix and the rest are yours.")}`, primary: { label: t("Open SYNC") } });
  }

  async function contactName() {
    for (let i = 0; i < 25; i++) { if (window.danzstakActiveContactName) return window.danzstakActiveContactName; await new Promise(r => setTimeout(r, 200)); }
    return t("your friend");
  }

  async function connect(kind, missed) {
    const name = await contactName();
    const button = document.getElementById(kind === "video" ? "startVideo" : "startPhone");
    const callNow = () => { cleanUrl(["member"]); button?.click(); };
    sheet({
      title: missed ? tf("Missed call from {name}", { name }) : tf("{name} is waiting", { name }),
      body: missed ? t("The call invite timed out, but you're connected now. Call them back.") : t("You're in. Tap to connect the call."),
      primary: { label: missed ? t("Call back") : t("Connect call"), run: callNow },
      secondary: { label: t("Not now"), run: () => cleanUrl(["member"]) }
    });
  }

  async function afterRedeem(kind, missed) {
    let registered = await window.danzstakRefreshCallingDevice?.().catch(() => null);
    if (registered === true) { connect(kind, missed); return; }
    const name = await contactName();
    window.addEventListener("danzstak:call-device-registered", () => connect(kind, missed), { once: true });
    sheet({
      title: tf("Verify this phone to talk to {name}", { name }),
      body: t("We text a code to your number once. Your number stays private: nobody on DanzStak can see or search it."),
      primary: { label: t("Text me a code"), run: () => window.danzstakRequireCallingDevice?.() },
      secondary: { label: t("Later — text only"), run: () => cleanUrl(["member"]) }
    });
  }

  // ---------- Caller ----------
  let poll = null;
  function callSection(dialog) {
    if (!dialog || dialog.querySelector(".invite-call") || typeof window.danzstakCallingDeviceHeaders !== "function") return;
    const section = document.createElement("section");
    section.className = "invite-call";
    section.innerHTML = `<h3>${t("Call someone who isn't on DanzStak yet")}</h3>
<p>${t("Send a call link. They tap Answer, join DanzStak, verify their phone and you're talking.")}</p>
<div class="invite-call-kinds"><button type="button" class="invite-action" data-call-kind="audio">${t("Voice call link")}</button><button type="button" class="invite-action" data-call-kind="video">${t("Video call link")}</button></div>
<div class="invite-call-live" hidden><p class="invite-link invite-call-url"></p>
<div class="invite-actions"><a class="invite-action invite-sms invite-call-sms" href="#">${t("Text message")}</a><button type="button" class="invite-action invite-call-share">${t("Share via apps")}</button><button type="button" class="invite-action invite-call-copy">${t("Copy call link")}</button></div>
<p class="invite-call-wait" role="status" aria-live="polite"></p><div class="invite-call-after"></div><button type="button" class="invite-action invite-call-cancel">${t("Cancel invite")}</button></div>`;
    dialog.querySelector(".invite-friend-card")?.insertBefore(section, dialog.querySelector(".invite-status"));
    const live = section.querySelector(".invite-call-live"), wait = section.querySelector(".invite-call-wait"), after = section.querySelector(".invite-call-after");
    let current = null;
    const message = () => `${t("Pick up! I'm calling you on DanzStak SYNC. Tap to answer:")}\n${current.url}`;
    const stop = () => { clearInterval(poll); poll = null; };
    async function check() {
      if (!current || !dialog.open) { stop(); return; }
      const result = await api("/calls/invites");
      const invite = (result.data.invites || []).find(item => item.inviteId === current.inviteId);
      if (!invite) return;
      if (invite.status === "redeemed" && invite.joined) {
        stop();
        wait.textContent = tf("{name} joined DanzStak! They'll call you as soon as their phone is verified.", { name: invite.joined.name });
        section.querySelector(".invite-call-cancel").hidden = true;
        after.replaceChildren();
        if (/^[a-f0-9-]{36}$/.test(invite.joined.memberId)) { const open = document.createElement("a"); open.className = "invite-action"; open.href = `messages.html?member=${encodeURIComponent(invite.joined.memberId)}`; open.textContent = t("Open chat"); after.append(open); }
      } else if (invite.status !== "open") { stop(); wait.textContent = t("This call invite has ended."); section.querySelector(".invite-call-cancel").hidden = true; }
    }
    section.addEventListener("click", async event => {
      const kindButton = event.target.closest("[data-call-kind]");
      if (kindButton) {
        for (const b of section.querySelectorAll("[data-call-kind]")) b.disabled = true;
        const result = await api("/calls/invites", { method: "POST", body: JSON.stringify({ kind: kindButton.dataset.callKind }) }, true);
        for (const b of section.querySelectorAll("[data-call-kind]")) b.disabled = false;
        if (!result.ok) {
          wait.textContent = t(result.data.error || "Request failed");
          live.hidden = false; section.querySelector(".invite-call-url").textContent = ""; section.querySelector(".invite-actions").hidden = true; section.querySelector(".invite-call-cancel").hidden = true;
          if (result.data.code === "CALL_DEVICE_REGISTRATION_REQUIRED") { dialog.close(); window.danzstakRequireCallingDevice?.(); }
          return;
        }
        current = result.data;
        section.querySelector(".invite-call-kinds").hidden = true;
        section.querySelector(".invite-call-url").textContent = current.url;
        section.querySelector(".invite-actions").hidden = false;
        section.querySelector(".invite-call-cancel").hidden = false;
        section.querySelector(".invite-call-sms").href = `sms:${/iPad|iPhone|iPod/.test(navigator.userAgent || "") ? "&" : "?"}body=${encodeURIComponent(message())}`;
        live.hidden = false;
        wait.textContent = t("Waiting for your friend to join… The link works once, for 24 hours.");
        stop(); poll = setInterval(check, 5000);
        return;
      }
      if (!current) return;
      if (event.target.closest(".invite-call-share")) {
        if (!navigator.share) { wait.textContent = t("Your device could not open the share sheet. Copy the call link instead."); return; }
        try { await navigator.share({ title: "DanzStak SYNC", text: t("Pick up! I'm calling you on DanzStak SYNC. Tap to answer:"), url: current.url }); } catch { /* cancelled */ }
      } else if (event.target.closest(".invite-call-copy")) {
        try { await navigator.clipboard.writeText(current.url); wait.textContent = t("Call link copied. Waiting for your friend to join…"); }
        catch { wait.textContent = t("Select and copy the call link above."); }
      } else if (event.target.closest(".invite-call-cancel")) {
        const result = await api("/calls/invites", { method: "DELETE", body: JSON.stringify({ inviteId: current.inviteId }) });
        stop();
        wait.textContent = result.ok ? t("Call invite cancelled. The link no longer works.") : t(result.data.error || "Request failed");
        section.querySelector(".invite-call-cancel").hidden = true;
        section.querySelector(".invite-actions").hidden = true;
      }
    });
    dialog.addEventListener("close", () => {
      stop();
      current = null;
      section.querySelector(".invite-call-kinds").hidden = false;
      live.hidden = true; wait.textContent = ""; after.replaceChildren();
    });
  }

  function start() {
    document.addEventListener("click", event => {
      if (!event.target.closest?.("[data-invite-friend]")) return;
      setTimeout(() => callSection(document.querySelector(".invite-friend-dialog")), 0);
    });
    const token = params.get("invite") || "";
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) { redeem(token); return; }
    const invited = params.get("invited");
    if ((invited === "audio" || invited === "video") && /^[a-f0-9-]{36}$/.test(params.get("member") || "")) afterRedeem(invited, params.get("missed") === "1");
  }

  window.danzstakCallInvite = { redeem, sheet };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
