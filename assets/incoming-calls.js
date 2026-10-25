"use strict";

(() => {
  const API = "https://api.danzstak.com";
  let current = null;
  let polling = false;
  let previousFocus = null;

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
    const response = await fetch(API + path, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error("Call service unavailable");
    return response.json().catch(() => ({}));
  }

  function showCall(event) {
    if (current?.eventId === event.eventId) return;
    current = event;
    label.textContent = `${event.senderEmail} is calling by ${event.mode === "video" ? "video" : "phone"}.`;
    popup.hidden = false;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    answer.focus();
    navigator.vibrate?.([400, 180, 400, 180, 400]);
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      const options = { body: label.textContent, icon: "/assets/favicon-192.png", badge: "/assets/favicon-192.png", tag: "danzstak-call", renotify: true, requireInteraction: true, data: { url: `/messages.html?contact=${encodeURIComponent(event.senderEmail)}&answer=1` } };
      if (navigator.serviceWorker) navigator.serviceWorker.ready.then(registration => registration.showNotification("Incoming DanzStak call", options)).catch(() => {});
      else {
        const notice = new Notification("Incoming DanzStak call", options);
        notice.onclick = () => { window.focus(); answer.click(); notice.close(); };
      }
    }
  }

  async function acknowledge(eventId) {
    await api("/calls/ack", { method: "POST", body: JSON.stringify({ eventIds: [eventId] }) });
  }

  answer.addEventListener("click", () => {
    if (!current) return;
    const destination = new URL("messages.html", location.href);
    destination.searchParams.set("contact", current.senderEmail);
    destination.searchParams.set("answer", "1");
    navigator.vibrate?.(0);
    location.assign(destination.href);
  });

  decline.addEventListener("click", async () => {
    if (!current) return;
    const event = current;
    decline.disabled = true;
    try {
      await api("/calls/signal", { method: "POST", body: JSON.stringify({ recipientEmail: event.senderEmail, callId: event.callId, mode: event.mode, signalType: "hangup", payload: null }) });
      await acknowledge(event.eventId);
      popup.hidden = true;
      current = null;
      navigator.vibrate?.(0);
      previousFocus?.focus();
      previousFocus = null;
    } finally { decline.disabled = false; }
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
    if (polling || current) return;
    if (document.getElementById("messageDrawer")) return;
    polling = true;
    try {
      const inbox = await api("/calls/inbox");
      const offer = (inbox.events || []).find(event => event.signalType === "offer" && ["phone", "video"].includes(event.mode));
      if (offer) showCall(offer);
    } catch { /* Retry quietly while the user remains on the site. */ }
    finally { polling = false; }
  }

  poll();
  setInterval(poll, 2000);
})();
