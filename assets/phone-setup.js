"use strict";
// "Set up this phone" right after SMS registration (task 16-B3, owner 2026-11-17; fix-it "close the registration window on
// success and offer the set up this phone flow"). Short and skippable, one step per screen with Back / Skip, once per
// device. Steps that exist today: alerts for messages and calls, the audio & video check (computers only), and sharing
// your SYNC with an invite link (never a phone number). Wallpaper (16-B) comes first; the ringtone step joins with 16-B2.
(() => {
  const DONE_KEY = "danzstak_phone_setup_done", API = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  let dialog = null, step = 0, steps = [], inviteLink = "";

  async function personalLink() {
    if (inviteLink) return inviteLink;
    let memberId = "";
    try { const r = await fetch(API + "/profiles", { credentials: "include", cache: "no-store" }); const d = r.ok ? await r.json() : {}; memberId = d.profile?.memberId || ""; } catch {}
    if (!/^[a-f0-9-]{36}$/i.test(memberId)) { try { const r = await fetch(API + "/auth/session", { credentials: "include", cache: "no-store" }); const d = r.ok ? await r.json() : {}; memberId = d.user?.sub || ""; } catch {} }
    const url = new URL("https://danzstak.com/feed.html");
    if (/^[a-f0-9-]{36}$/i.test(memberId)) url.searchParams.set("messageMember", memberId);
    inviteLink = url.href;
    return inviteLink;
  }

  function buildSteps() {
    const list = [];
    if (window.danzstakSyncWallpaper) list.push({ id: "wallpaper", title: "Pick a chat wallpaper", body: "Your own photo, a DanzStak wallpaper or a color. Only you see it, and your photo stays on this device.", action: "Choose wallpaper",
      run: async status => { window.danzstakSyncWallpaper.open("all"); const saved = await new Promise(resolve => { const done = ok => { window.removeEventListener("danzstak:sync-wallpaper-saved", yes); clearInterval(watch); resolve(ok); }; const yes = () => done(true); window.addEventListener("danzstak:sync-wallpaper-saved", yes); const watch = setInterval(() => { if (!document.querySelector(".sync-wallpaper-dialog")?.open) done(false); }, 300); }); if (saved) status.textContent = t("Wallpaper set."); return saved; } });
    list.push({ id: "alerts", title: "Turn on call and message alerts", body: "Get a notification for messages and calls when DanzStak is closed. When the phone is locked, its own sound and vibration settings decide how loud it rings.", action: "Turn on alerts",
      run: async status => { try { await window.danzstakEnablePush?.(); status.textContent = t("Alerts are on for this device."); return true; } catch (error) { status.textContent = error?.message || t("Alerts could not be turned on. You can do it later in SYNC."); return false; } } });
    if (window.danzstakCallSetup?.isComputer) list.push({ id: "audio", title: "Check your microphone, speaker and camera", body: "Pick the devices for calls and set how loud SYNC rings on this computer.", action: "Open audio & video check",
      run: async () => { await window.danzstakCallSetup.openCheck(); return true; } });
    list.push({ id: "share", title: "Share your SYNC", body: "Send people your SYNC link so they can message you here. Your phone number is never shared.", action: "Share my SYNC link",
      run: async status => {
        const url = await personalLink(), text = t("I'm on SYNC by DanzStak. Message me here:") + " " + url;
        try { if (navigator.share) { await navigator.share({ title: "SYNC", text, url }); return true; } } catch (error) { if (error?.name === "AbortError") return false; }
        try { await navigator.clipboard.writeText(text); status.textContent = t("Link copied."); return true; } catch { status.textContent = url; return false; }
      } });
    list.push({ id: "done", title: "You're set", body: "Calls and voice messages work on this device. You can change all of this later in SYNC.", action: "Go to chats", run: async () => { finish(); return true; } });
    return list;
  }

  function render() {
    const s = steps[step];
    dialog.querySelector(".phone-setup-count").textContent = t("Step {n} of {total}").replace("{n}", String(step + 1)).replace("{total}", String(steps.length));
    dialog.querySelector("h2").textContent = t(s.title);
    dialog.querySelector(".phone-setup-body").textContent = t(s.body);
    dialog.querySelector(".phone-setup-status").textContent = "";
    const primary = dialog.querySelector(".phone-setup-primary");
    primary.textContent = t(s.action);
    dialog.querySelector(".phone-setup-back").hidden = step === 0;
    dialog.querySelector(".phone-setup-skip").hidden = s.id === "done";
    primary.focus();
  }
  function finish() { try { localStorage.setItem(DONE_KEY, "1"); } catch {} dialog?.close(); }
  function next() { if (step < steps.length - 1) { step++; render(); } else finish(); }

  function open() {
    if (dialog?.open) return; // the registered event can arrive twice; never restart a running setup
    try { if (localStorage.getItem(DONE_KEY) === "1") return; } catch {}
    steps = buildSteps(); step = 0;
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "call-setup-dialog phone-setup-dialog";
      dialog.setAttribute("aria-labelledby", "phoneSetupTitle");
      dialog.innerHTML = '<header><div><p class="phone-setup-count"></p><h2 id="phoneSetupTitle"></h2></div><button type="button" class="call-setup-close" data-icon="close"></button></header>'
        + '<p class="phone-setup-body"></p><p class="phone-setup-status" role="status"></p>'
        + '<div class="phone-setup-actions"><button type="button" class="secondary phone-setup-back"></button><span></span><button type="button" class="phone-setup-skip"></button><button type="button" class="primary phone-setup-primary"></button></div>';
      dialog.querySelector(".call-setup-close").addEventListener("click", finish);
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(); });
      dialog.querySelector(".phone-setup-back").addEventListener("click", () => { if (step > 0) { step--; render(); } });
      dialog.querySelector(".phone-setup-skip").addEventListener("click", next);
      dialog.querySelector(".phone-setup-primary").addEventListener("click", async event => {
        const button = event.currentTarget; button.disabled = true;
        try { const ok = await steps[step].run(dialog.querySelector(".phone-setup-status")); if (ok && steps[step]?.id !== "done") setTimeout(next, 600); }
        finally { button.disabled = false; }
      });
      document.body.appendChild(dialog);
      window.danzstakIcons?.enhance?.(dialog);
    }
    dialog.querySelector(".call-setup-close").setAttribute("aria-label", t("Close"));
    dialog.querySelector(".phone-setup-back").textContent = t("Back");
    dialog.querySelector(".phone-setup-skip").textContent = t("Skip");
    if (!dialog.open) dialog.showModal();
    render();
  }

  // The registration window closes on success (call-devices.js); then offer setup once.
  window.addEventListener("danzstak:call-device-registered", () => setTimeout(open, 250));
  window.danzstakPhoneSetup = { open, reset: () => { try { localStorage.removeItem(DONE_KEY); } catch {} } };
})();
