"use strict";
// Owner directive 2026-11-16: no "DanzStak member" placeholder names. New members choose their name and
// username before using DanzStak, then are offered SYNC device registration. Without registering, SYNC
// works for text only (calls, video and voice messages need a registered device).
(() => {
  const API = "https://api.danzstak.com";
  const PLACEHOLDER_NAMES = new Set(["danzstak member", ""]);
  const DEVICE_PROMPT_KEY = "danzstak_device_prompt_seen";
  // Owner 2026-11-17: also any account with no @username, or whose "name" is really an email address, names itself on its next visit.
  const needsName = profile => profile?.isOwner === true && (PLACEHOLDER_NAMES.has(String(profile.name || "").trim().toLowerCase()) || String(profile.name || "").includes("@") || !String(profile.handle || "").trim() || /^danzstak-member/i.test(String(profile.handle || "")));
  const t = value => window.danzstakTranslate?.(value) || value;
  const suggestHandle = name => String(name || "").normalize("NFKD").replace(/[^\w.]+/g, "").replace(/_/g, "").toLowerCase().slice(0, 24);

  function style() {
    if (document.getElementById("dsOnboardStyle") || document.querySelector('link[href*="signup-onboarding.css"]')) return;
    const s = document.createElement("style"); s.id = "dsOnboardStyle";
    s.textContent = `.ds-onboard{max-width:min(420px,calc(100vw - 24px));width:100%;border:0;border-radius:16px;padding:22px 20px;background:#0b0b0c;color:#ededea;font:inherit}
.ds-onboard::backdrop{background:rgba(5,5,6,.82)}
.ds-onboard h2{margin:0 0 6px;font-size:1.35rem;font-weight:900;letter-spacing:-.02em}
.ds-onboard p{margin:0 0 14px;color:#b9bcc4;line-height:1.4}
.ds-onboard label{display:grid;gap:6px;margin:0 0 12px;font-weight:700;font-size:.9rem}
.ds-onboard input{min-height:46px;padding:0 12px;border:1px solid #2e2f34;border-radius:10px;background:#16171a;color:#fff;font:inherit;font-size:1rem}
.ds-onboard input:focus{outline:2px solid #ff5a1f;outline-offset:1px;border-color:#ff5a1f}
.ds-onboard .ds-at{display:flex;align-items:center;gap:0}.ds-onboard .ds-at span{padding:0 10px;color:#8b8f99}
.ds-onboard .ds-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px}
.ds-onboard button{min-height:46px;padding:0 18px;border-radius:10px;border:1px solid #2e2f34;background:transparent;color:#ededea;font:inherit;font-weight:800;cursor:pointer}
.ds-onboard button.ds-go{background:#ff5a1f;border-color:#ff5a1f;color:#0b0b0c}
.ds-onboard button:disabled{opacity:.5;cursor:wait}
.ds-onboard .ds-err{min-height:1.2em;margin:0 0 6px;color:#ff8a6b;font-size:.88rem}
.ds-onboard .ds-kicker{font:700 .72rem/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#ff5a1f;margin:0 0 10px}`;
    document.head.append(s);
  }

  function nameStep(profile) {
    return new Promise(resolve => {
      style();
      const d = document.createElement("dialog"); d.className = "ds-onboard"; d.setAttribute("aria-labelledby", "dsOnboardTitle");
      d.innerHTML = `<p class="ds-kicker">${t("Welcome to DanzStak")}</p><h2 id="dsOnboardTitle">${t("What should people call you?")}</h2>
<p>${t("Your name and username show on your posts, your EPK and in SYNC. People find you by them.")}</p>
<form method="dialog" novalidate><label>${t("Name")}<input name="name" autocomplete="name" maxlength="80" required></label>
<label>${t("Username")}<span class="ds-at"><span>@</span><input name="handle" autocomplete="username" maxlength="24" pattern="[A-Za-z0-9._]{3,24}" required></span></label>
<p class="ds-err" role="alert"></p><div class="ds-row"><button class="ds-go" type="submit">${t("Continue")}</button></div></form>`;
      document.body.append(d);
      const form = d.querySelector("form"), name = form.elements.name, handle = form.elements.handle, err = d.querySelector(".ds-err"), go = d.querySelector(".ds-go");
      let handleTouched = false;
      handle.addEventListener("input", () => { handleTouched = true; });
      name.addEventListener("input", () => { if (!handleTouched) handle.value = suggestHandle(name.value); });
      d.addEventListener("cancel", event => event.preventDefault()); // a name is required
      form.addEventListener("submit", async event => {
        event.preventDefault(); err.textContent = "";
        const chosen = name.value.trim(), user = handle.value.trim();
        if (chosen.length < 2 || chosen.toLowerCase() === "danzstak member" || chosen.includes("@")) { err.textContent = t("Enter the name you want people to see."); name.focus(); return; }
        if (!/^[A-Za-z0-9._]{3,24}$/.test(user) || /^danzstak[-_.]?member/i.test(user)) { err.textContent = t("Username: 3–24 letters, numbers, dots or underscores."); handle.focus(); return; }
        go.disabled = true;
        try {
          const response = await fetch(API + "/profiles", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: chosen, handle: user }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(t(data.error || "That didn't save. Try again."));
          window.danzstakCurrentProfile = data.profile || { ...profile, name: chosen, handle: user };
          window.dispatchEvent(new CustomEvent("danzstak:profile-name-chosen", { detail: window.danzstakCurrentProfile }));
          d.close(); d.remove(); resolve(true);
        } catch (error) { err.textContent = error.message; go.disabled = false; }
      });
      d.showModal(); name.focus();
    });
  }

  function deviceStep() {
    try { if (localStorage.getItem(DEVICE_PROMPT_KEY) === "1") return; localStorage.setItem(DEVICE_PROMPT_KEY, "1"); } catch {}
    style();
    const d = document.createElement("dialog"); d.className = "ds-onboard"; d.setAttribute("aria-labelledby", "dsDeviceTitle");
    d.innerHTML = `<p class="ds-kicker">SYNC</p><h2 id="dsDeviceTitle">Register this device?</h2>
<p>Texting works right away. To make or answer calls, video calls and voice messages, verify this device with a code sent to your phone. You can do it any time in SYNC.</p>
<div class="ds-row"><button type="button" data-later>Later — text only</button><button type="button" class="ds-go" data-now>Register now</button></div>`;
    document.body.append(d);
    d.querySelector("[data-later]").addEventListener("click", () => { d.close(); d.remove(); });
    d.querySelector("[data-now]").addEventListener("click", () => { d.close(); d.remove(); location.href = "messages.html?device=register"; });
    d.showModal();
  }

  async function start() {
    try {
      const response = await fetch(API + "/profiles", { credentials: "include", cache: "no-store" });
      if (!response.ok) return; // signed out: nothing to do
      const profile = (await response.json()).profile || {};
      if (!needsName(profile)) return;
      await nameStep(profile);
      // Answer to join (owner 2026-11-18): a call invitee is walked through device verification by call-invite.js.
      if (!/[?&](invite|invited)=/.test(location.search)) deviceStep();
    } catch { /* never block the page on a network error */ }
  }
  window.danzstakSignupOnboarding = { needsName, suggestHandle };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
