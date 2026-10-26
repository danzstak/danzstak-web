"use strict";

(() => {
  const API = "https://api.danzstak.com";
  let current = null;
  let polling = false;
  let previousFocus = null;
  const handledCalls = new Map();

  const popup = document.createElement("section");
  popup.className = "global-incoming-call";
  popup.hidden = true;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-labelledby", "globalIncomingTitle");
  popup.innerHTML = '<span class="global-call-icon" aria-hidden="true">📞</span><div><strong id="globalIncomingTitle">Incoming call</strong><p id="globalIncomingLabel"></p></div><div class="global-call-actions"><button type="button" data-answer>Answer</button><button type="button" class="global-call-decline" data-decline>Decline</button></div>';
  document.body.appendChild(popup);

  const label = popup.querySelector("#globalIncomingLabel");
  const answer = popup.querySelector("[data-answer]");
  const decline = popup.querySelector("[data-decline]");

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(API + path, {
        credentials: "include",
        cache: "no-store",
        ...options,
        signal: controller.signal,
        headers: { "content-type": "application/json", ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error("Call service unavailable");
      return response.json().catch(() => ({}));
    } finally { clearTimeout(timeout); }
  }

  function showCall(event) {
    if (current?.callId === event.callId || handledCalls.has(event.callId)) return;
    current = event;
    label.textContent = `${event.senderName || "DanzStak member"} is calling by ${event.mode === "video" ? "video" : "phone"}.`;
    popup.hidden = false;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    answer.focus();
    navigator.vibrate?.([400, 180, 400, 180, 400]);
    // The service worker owns background notifications; polling only updates this page.
  }

  async function acknowledge(eventId) {
    await api("/calls/ack", { method: "POST", body: JSON.stringify({ eventIds: [eventId] }) });
  }

  answer.addEventListener("click", () => {
    if (!current) return;
    const event = current;
    handledCalls.set(event.callId, Date.now() + 120000);
    if (typeof window.openMessageDrawer === "function") {
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
    navigator.vibrate?.(0);
    location.assign(destination.href);
  });

  decline.addEventListener("click", async () => {
    if (!current) return;
    const event = current;
    decline.disabled = true;
    try {
      await api("/calls/signal", { method: "POST", body: JSON.stringify({ recipientEmail: event.senderEmail, callId: event.callId, mode: event.mode, signalType: "hangup", payload: null }) });
      await acknowledge(event.eventId).catch(() => {});
      handledCalls.set(event.callId, Date.now() + 120000);
      popup.hidden = true;
      current = null;
      navigator.vibrate?.(0);
      previousFocus?.focus();
      previousFocus = null;
    } catch { label.textContent = "Could not decline the call. Please try again."; }
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
    if (document.hidden || polling) return;
    polling = true;
    for (const [callId, expiry] of handledCalls) if (expiry <= Date.now()) handledCalls.delete(callId);
    try {
      const inbox = await api("/calls/inbox");
      if (current) {
        const ended = (inbox.events || []).find(event => event.signalType === "hangup" && event.callId === current.callId);
        const activeOffer = (inbox.events || []).some(event => event.signalType === "offer" && event.callId === current.callId);
        if (ended || !activeOffer) {
          handledCalls.set(current.callId, Date.now() + 120000);
          await acknowledge(current.eventId).catch(() => {});
          if (ended) await acknowledge(ended.eventId).catch(() => {});
          popup.hidden = true;
          current = null;
          navigator.vibrate?.(0);
          previousFocus?.focus();
          previousFocus = null;
        }
        return;
      }
      const offer = (inbox.events || []).find(event => event.signalType === "offer" && ["phone", "video"].includes(event.mode) && !handledCalls.has(event.callId));
      if (offer) showCall(offer);
    } catch { /* Retry quietly while the user remains on the site. */ }
    finally { polling = false; }
  }

  poll();
  setInterval(poll, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
})();
