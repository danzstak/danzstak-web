"use strict";

(() => {
  const API = "https://api.danzstak.com";
  let current = null;
  let polling = false;
  let callDeviceRegistrationRequired = false, registrationBackoffUntil = 0;
  let previousFocus = null;
  let ringtoneContext = null;
  let ringtoneTimer = null;
  let ringtoneStopTimer = null;
  let ringtoneDeadline = 0;
  const RINGTONE_DURATION_MS = 25000;
  const ringtonePulses = new Set();
  const handledCalls = new Map();
  const t = value => window.danzstakTranslate?.(value) || value;
  const tf = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

  const popup = document.createElement("section");
  popup.className = "global-incoming-call";
  popup.hidden = true;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-labelledby", "globalIncomingTitle");
  popup.innerHTML = '<span class="global-call-icon" aria-hidden="true">📞</span><div data-ringer-slot><strong id="globalIncomingTitle">Incoming call</strong><p id="globalIncomingLabel"></p></div><div class="global-call-actions"><button type="button" data-answer>Answer</button><button type="button" class="global-call-decline" data-decline>Decline</button></div>';
  document.body.appendChild(popup);

  const label = popup.querySelector("#globalIncomingLabel");
  const answer = popup.querySelector("[data-answer]");
  const decline = popup.querySelector("[data-decline]");

  async function unlockRingtone() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!ringtoneContext || ringtoneContext.state === "closed") ringtoneContext = new AudioContextClass();
      if (ringtoneContext.state === "suspended") await ringtoneContext.resume();
      if (current && !document.hidden && !ringtoneTimer) startRingtone();
    } catch { /* The visible incoming-call screen remains the fallback. */ }
  }

  function playRingtonePulse(frequency, delay = 0) {
    const timeout = setTimeout(() => {
      ringtonePulses.delete(timeout);
      if (!current || document.hidden || ringtoneContext?.state !== "running") return;
      const oscillator = ringtoneContext.createOscillator();
      const gain = ringtoneContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = window.danzstakCallSetup?.ringVolume?.() ?? 0.4; // owner 2026-11-17: louder ring (was 0.055); the member's ring-volume setting on computers
      oscillator.connect(gain).connect(ringtoneContext.destination);
      oscillator.start();
      oscillator.stop(ringtoneContext.currentTime + 0.24);
    }, delay);
    ringtonePulses.add(timeout);
  }

  function stopRingtone() {
    window.danzstakCallRinger?.stop?.();
    if (ringtoneTimer?.stop) ringtoneTimer.stop(); // 16-B2: the member's chosen ringtone
    else if (ringtoneTimer) clearInterval(ringtoneTimer);
    ringtoneTimer = null;
    if (ringtoneStopTimer) clearTimeout(ringtoneStopTimer);
    ringtoneStopTimer = null;
    for (const timeout of ringtonePulses) clearTimeout(timeout);
    ringtonePulses.clear();
  }

  function startRingtone() {
    stopRingtone();
    const remaining = ringtoneDeadline - Date.now();
    if (!current || document.hidden || remaining <= 0) return;
    // 5a00: the shared ringer tries an <audio> ringtone, then Web Audio, then shows "Tap to hear the ringer" (call-ringer.js).
    if (window.danzstakCallRinger?.start) { ringtoneTimer = window.danzstakCallRinger.start({ contact: current.senderEmail || "", durationMs: remaining, surface: popup, audioContext: ringtoneContext }); return; }
    // Task 31 (owner 2026-11-18: "the ringer does not work"): ring without a prior tap where the browser allows it
    // (installed app); otherwise vibrate and ask for one tap on the call card.
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if ((!ringtoneContext || ringtoneContext.state === "closed") && AudioContextClass) { try { ringtoneContext = new AudioContextClass(); } catch { ringtoneContext = null; } }
    if (ringtoneContext?.state === "suspended") ringtoneContext.resume().then(() => { if (current && !ringtoneTimer && ringtoneContext?.state === "running") startRingtone(); }).catch(() => {});
    if (ringtoneContext?.state !== "running") { window.danzstakCallRinger?.vibrateStart?.(remaining); window.danzstakCallRinger?.needsTap?.(popup, unlockRingtone); return; }
    window.danzstakCallRinger?.stop?.();
    if (window.danzstakSyncTones) { ringtoneTimer = window.danzstakSyncTones.startRing(ringtoneContext, { contact: current.senderEmail || "", durationMs: remaining }); return; }
    const pulse = () => {
      playRingtonePulse(720);
      playRingtonePulse(880, 320);
    };
    pulse();
    ringtoneTimer = setInterval(pulse, 2400);
    ringtoneStopTimer = setTimeout(stopRingtone, remaining);
  }

  function renderCurrentCall() {
    if (!current) return;
    label.textContent = tf("{name} is calling by {mode}.", {
      name: current.senderName || t("DanzStak member"),
      mode: t(current.mode === "video" ? "video" : "phone")
    });
    // L1: this device isn't registered, so the call can't be answered here yet. Say how, instead of staying silent.
    answer.textContent = t(current.register ? "Register this device to answer" : "Answer");
    popup.classList.toggle("needs-registration", Boolean(current.register));
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const deviceHeaders = path.startsWith("/calls/")
        ? await globalThis.danzstakCallingDeviceHeaders?.() || {}
        : {};
      const response = await fetch(API + path, {
        credentials: "include",
        cache: "no-store",
        ...options,
        signal: controller.signal,
        headers: { "content-type": "application/json", ...deviceHeaders, ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || "Call service unavailable");
        error.code = data.code || "";
        error.data = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Call service took too long. Try again.");
      if (error.code || error.message === "Call service unavailable") throw error;
      throw new Error("DanzStak cannot connect to calls right now. Check your connection and try again.");
    } finally { clearTimeout(timeout); }
  }

  // L1 (owner 2026-11-19: a tester's MacBook "didn't ring" when called). An unregistered device gets no call details, only who is
  // calling (the server's "ringing" list on its registration-required answer). Show it, ring, and on a computer whose window isn't
  // in front, put up a desktop notification once notifications are allowed. Answer opens registration; Decline still works.
  function desktopNotice(call, close = false) {
    const tag = `call-${call.callId}`;
    const ready = navigator.serviceWorker?.ready;
    if (close) { ready?.then(registration => registration.getNotifications({ tag })).then(list => list?.forEach(note => note.close())).catch(() => {}); return; }
    if (globalThis.Notification?.permission !== "granted" || document.hasFocus?.()) return;
    const title = t("Incoming call"), body = tf("{name} is calling. Register this device to answer.", { name: call.senderName || t("DanzStak member") });
    const fallback = () => { try { new Notification(title, { body, tag }); } catch { /* notifications are optional */ } };
    if (!ready) { fallback(); return; }
    ready.then(registration => registration.showNotification(title, { body, tag, icon: "/assets/favicon-192.png", data: { url: "/messages.html", type: "notification" } })).catch(fallback);
  }

  function showRegistrationCall(ringing) {
    const live = ringing.filter(call => /^[a-f0-9-]{36}$/.test(String(call.callId || "")) && ["phone", "video"].includes(call.mode));
    if (current) {
      if (current.register && !live.some(call => call.callId === current.callId)) { desktopNotice(current, true); resolveCall(current.callId); }
      return;
    }
    const call = live.find(item => !handledCalls.has(item.callId));
    if (!call) return;
    current = { ...call, register: true };
    ringtoneDeadline = Date.now() + RINGTONE_DURATION_MS;
    renderCurrentCall();
    popup.hidden = false;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    answer.focus();
    if (!window.danzstakSyncTones && !window.danzstakCallRinger) navigator.vibrate?.([400, 180, 400, 180, 400]);
    startRingtone();
    desktopNotice(call);
  }

  async function showCall(event) {
    if (current?.callId === event.callId || handledCalls.has(event.callId)) return;
    // The inbox only answers registered devices, so wait for the device check to finish
    // instead of reading its "not loaded yet" state (owner 2026-11-17: a registration
    // window kept reopening on every poll and could not be closed).
    if (window.danzstakSyncDeviceRegistered?.() !== true) await window.danzstakSyncDeviceReady?.catch?.(() => false);
    if (current?.callId === event.callId || handledCalls.has(event.callId)) return;
    if (window.danzstakSyncDeviceRegistered?.() !== true) {
      // Prompt once per call. Re-prompting on every 2s poll reopened the window the moment the member closed it,
      // so its × looked dead (owner SYNC call test 2026-11-17).
      handledCalls.set(event.callId, Date.now() + 120000);
      window.danzstakRequireCallingDevice?.({ incoming: true });
      return;
    }
    current = event;
    ringtoneDeadline = Date.now() + RINGTONE_DURATION_MS;
    renderCurrentCall();
    popup.hidden = false;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    answer.focus();
    if (!window.danzstakSyncTones && !window.danzstakCallRinger) navigator.vibrate?.([400, 180, 400, 180, 400]); // 16-B2: the tone module vibrates per the member's Vibrate setting
    startRingtone();
    // The service worker owns background notifications; polling only updates this page.
  }

  function resolveCall(callId) {
    if (!current || current.callId !== callId) return false;
    handledCalls.set(current.callId, Date.now() + 120000);
    popup.hidden = true;
    current = null;
    stopRingtone();
    ringtoneDeadline = 0;
    navigator.vibrate?.(0);
    previousFocus?.focus();
    previousFocus = null;
    return true;
  }

  navigator.serviceWorker?.addEventListener?.("message", event => {
    if (event.data?.type === "DANZSTAK_CALL_RESOLVED") resolveCall(String(event.data.callId || ""));
  });
  // Answered or declined in another window on this phone (SYNC, or DanzStak open twice): stop ringing it here.
  globalThis.addEventListener?.("danzstak:call-handled-elsewhere", event => resolveCall(String(event.detail?.callId || "")));

  async function acknowledge(eventId) {
    await api("/calls/ack", { method: "POST", body: JSON.stringify({ eventIds: [eventId] }) });
  }

  answer.addEventListener("click", () => {
    if (!current) return;
    if (current.register || window.danzstakSyncDeviceRegistered?.() !== true) {
      handledCalls.set(current.callId, Date.now() + 120000);
      desktopNotice(current, true);
      stopRingtone();
      navigator.vibrate?.(0);
      popup.hidden = true;
      current = null;
      // Only SYNC has the device panel; from any other page, go there and open it with the accept-the-call reason.
      if (document.getElementById("callingDevicesDialog")) window.danzstakRequireCallingDevice?.({ incoming: true });
      else location.assign(new URL("messages.html?device=answer", location.href).href);
      return;
    }
    const event = current;
    handledCalls.set(event.callId, Date.now() + 120000);
    window.danzstakCallRinger?.handled(event.callId);
    if (typeof window.openMessageDrawer === "function") {
      stopRingtone();
      ringtoneDeadline = 0;
      navigator.vibrate?.(0);
      popup.hidden = true;
      current = null;
      window.openMessageDrawer(event.senderEmail, true, event.callId);
      return;
    }
    const destination = new URL("messages.html", location.href);
    destination.searchParams.set("contact", event.senderEmail);
    destination.searchParams.set("answer", "1");
    destination.searchParams.set("callId", event.callId);
    stopRingtone();
    ringtoneDeadline = 0;
    navigator.vibrate?.(0);
    location.assign(destination.href);
  });

  decline.addEventListener("click", async () => {
    if (!current) return;
    const event = current;
    decline.disabled = true;
    window.danzstakCallRinger?.handled(event.callId);
    try {
      if (event.register) {
        await api("/calls/decline", { method: "POST", body: JSON.stringify({ callId: event.callId }) }).catch(error => { if (error.code !== "CALL_GONE") throw error; });
        desktopNotice(event, true);
      } else {
        await api("/calls/signal", { method: "POST", body: JSON.stringify({ recipientEmail: event.senderEmail, callId: event.callId, mode: event.mode, signalType: "hangup", payload: null }) });
        await acknowledge(event.eventId).catch(() => {});
      }
      handledCalls.set(event.callId, Date.now() + 120000);
      popup.hidden = true;
      current = null;
      stopRingtone();
      ringtoneDeadline = 0;
      navigator.vibrate?.(0);
      previousFocus?.focus();
      previousFocus = null;
    } catch { label.textContent = t("Could not decline the call. Please try again."); }
    finally { decline.disabled = false; }
  });

  popup.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); decline.click(); return; }
    if (event.key !== "Tab") return;
    const controls = [answer, decline].filter(control => !control.disabled);
    const currentIndex = controls.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    controls[(currentIndex + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });

  async function poll() {
    // Owner SYNC call test 2026-11-17: "registration required" used to stop this poller for good, so a call offer only
    // appeared after a reload. Now it backs off and keeps listening; it never stops on one bad answer.
    if (document.hidden || polling || Date.now() < registrationBackoffUntil) return;
    polling = true;
    for (const [callId, expiry] of handledCalls) if (expiry <= Date.now()) handledCalls.delete(callId);
    try {
      const inbox = await api("/calls/inbox");
      if (current?.register) { desktopNotice(current, true); resolveCall(current.callId); }
      if (current) {
        const ended = (inbox.events || []).find(event => event.signalType === "hangup" && event.callId === current.callId);
        const activeOffer = (inbox.events || []).some(event => event.signalType === "offer" && event.callId === current.callId);
        if (ended || !activeOffer) {
          const resolvedCallId = current.callId;
          await acknowledge(current.eventId).catch(() => {});
          if (ended) await acknowledge(ended.eventId).catch(() => {});
          resolveCall(resolvedCallId);
        }
        return;
      }
      const offer = (inbox.events || []).find(event => event.signalType === "offer" && ["phone", "video"].includes(event.mode) && !handledCalls.has(event.callId));
      if (offer) await showCall(offer);
      callDeviceRegistrationRequired = false;
      registrationBackoffUntil = 0;
    } catch (error) {
      if (error.code === "CALL_DEVICE_REGISTRATION_REQUIRED") {
        callDeviceRegistrationRequired = true;
        const ringing = Array.isArray(error.data?.ringing) ? error.data.ringing : [];
        showRegistrationCall(ringing);
        // Listen again soon: every 3 s while a call rings here (to stop when it ends), every 6 s otherwise.
        registrationBackoffUntil = Date.now() + (ringing.length || current?.register ? 3000 : 6000);
      }
      /* Other transient failures retry quietly while the user remains on the site. */
    }
    finally { polling = false; }
  }

  document.addEventListener("pointerdown", unlockRingtone, { capture: true, passive: true });
  // Touch screens grant sound on pointerup/touchend/click, not pointerdown (5a00).
  for (const type of ["pointerup", "touchend", "click"]) document.addEventListener(type, unlockRingtone, { capture: true, passive: true });
  document.addEventListener("keydown", unlockRingtone, { capture: true });
  window.addEventListener?.("danzstak:call-device-registered", () => {
    callDeviceRegistrationRequired = false;
    registrationBackoffUntil = 0;
    poll();
  });
  // The device credential loads asynchronously; poll again as soon as it is ready instead of waiting out a backoff.
  window.addEventListener?.("danzstak:call-device-ready", event => { if (event.detail?.registered !== true) return; registrationBackoffUntil = 0; callDeviceRegistrationRequired = false; poll(); });
  poll();
  setInterval(poll, 2000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRingtone();
    else { if (current) startRingtone(); poll(); }
  });
  window.addEventListener?.("pagehide", stopRingtone);
  if (typeof MutationObserver === "function") new MutationObserver(renderCurrentCall).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
