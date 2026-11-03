"use strict";

(() => {
  const panel = document.getElementById("phonePanel");
  if (!panel) return;
  const byId = id => document.getElementById(id);
  const status = byId("phoneStatus"), number = byId("phoneNumber"), activate = byId("phoneActivate");
  const dial = byId("phoneDial"), input = byId("phoneDialNumber"), ad = byId("phoneCallAd");
  let account = null, dialedNumber = "", callStarted = 0, reportedCall = "", relayed = false;
  const t = value => window.danzstakTranslate?.(value) || value;
  const say = text => { status.textContent = t(text); };

  async function api(path, options = {}) {
    const response = await fetch("https://api.danzstak.com" + path, {
      credentials: "include", cache: "no-store", ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "DANZSTAK Phone is temporarily unavailable.");
    return data;
  }

  async function refresh() {
    try {
      account = await api("/phone");
      number.textContent = account.number || t("Not activated");
      activate.hidden = Boolean(account.number);
      activate.disabled = !account.checkoutAvailable;
      activate.textContent = t(account.testMode ? "Test $3 activation" : "Activate for $3 once");
      dial.hidden = !account.number;
      byId("phoneBlock").disabled = byId("phoneUnblock").disabled = !account.number;
      if (account.number) { say("Your DANZSTAK number is ready. Calls stay inside DANZSTAK."); await history(); }
      else say(account.checkoutAvailable ? (account.testMode ? "Test mode — no real payment will be collected." : "Pay $3 once. No monthly subscription.") : "Activation will open after calling and payment setup is complete.");
    } catch (error) {
      activate.disabled = true;
      say(error.message);
    }
  }

  async function history() {
    const list = byId("phoneHistory");
    const data = await api("/phone/history");
    list.replaceChildren();
    for (const call of data.calls || []) {
      const row = document.createElement("li");
      row.textContent = `${call.number} · ${new Date(call.startedAt).toLocaleString()} · ${Math.ceil(call.seconds / 60)} min`;
      list.append(row);
    }
    if (!list.children.length) { const row = document.createElement("li"); row.textContent = t("No numbered calls yet."); list.append(row); }
  }

  activate.addEventListener("click", async () => {
    activate.disabled = true;
    try {
      const result = await api("/phone/checkout", { method: "POST", body: "{}" });
      if (result.activated) { await refresh(); return; }
      const destination = new URL(result.url);
      if (destination.origin !== "https://checkout.stripe.com") throw new Error("Unexpected payment destination.");
      // Embedded message drawers must not open Checkout inside an iframe.
      window.top.location.href = destination.href;
    } catch (error) { say(error.message); activate.disabled = false; }
  });

  input.addEventListener("input", () => { input.value = input.value.toUpperCase(); });
  dial.addEventListener("submit", async event => {
    event.preventDefault();
    const button = byId("phoneDialCall");
    button.disabled = true;
    try {
      const result = await api("/phone/resolve", { method: "POST", body: JSON.stringify({ number: input.value }) });
      dialedNumber = result.number;
      window.dispatchEvent(new CustomEvent("danzstak-phone-dial", { detail: { memberId: result.memberId, number: result.number } }));
      say("Connecting your DANZSTAK call…");
    } catch (error) { say(error.message); }
    finally { button.disabled = false; }
  });

  for (const [id, blocked] of [["phoneBlock", true], ["phoneUnblock", false]]) {
    byId(id).addEventListener("click", async () => {
      byId(id).disabled = true;
      try {
        await api("/phone/block", { method: "POST", body: JSON.stringify({ number: input.value, blocked }) });
        if (blocked) window.dispatchEvent(new CustomEvent("danzstak-phone-stop"));
        say(blocked ? "Number blocked for calls and messages." : "Number unblocked.");
      } catch (error) { say(error.message); }
      finally { byId(id).disabled = false; }
    });
  }

  const initial = refresh();
  window.danzstakPhone = {
    async ice() {
      await initial;
      if (!account?.number) return null; // Preserve existing unnumbered chat calls.
      const result = await api("/phone/ice");
      return { iceServers: result.iceServers, iceCandidatePoolSize: 4 };
    },
    async connected(peer, callId) {
      if (reportedCall === callId) return;
      reportedCall = callId;
      callStarted = Date.now();
      relayed = false;
      ad.hidden = false;
      // House sponsorship only. No third-party advertising requests, audio ads,
      // recording, or content analysis. Diagnostics are not billable ad impressions.
      try {
        const stats = await peer.getStats();
        stats.forEach(report => {
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
            relayed = stats.get(report.localCandidateId)?.candidateType === "relay" || stats.get(report.remoteCandidateId)?.candidateType === "relay";
          }
        });
      } catch { /* Diagnostics cannot interrupt a call. */ }
    },
    ended(callId) {
      ad.hidden = true;
      if (callStarted && dialedNumber && account?.number && reportedCall === callId) {
        api("/phone/events", { method: "POST", body: JSON.stringify({ callId, number: dialedNumber, seconds: Math.min(86400, (Date.now() - callStarted) / 1000), relayed }) }).then(history).catch(() => {});
      }
      callStarted = 0;
      reportedCall = "";
      dialedNumber = "";
    }
  };
  if (new URLSearchParams(location.search).has("phone")) panel.open = true;
  // A Checkout redirect never activates a number. Recheck the server while its
  // signed webhook arrives, with a bounded retry window.
  if (new URLSearchParams(location.search).get("phone") === "success") {
    let retries = 0;
    const timer = setInterval(async () => {
      if (account?.number || ++retries > 10) { clearInterval(timer); return; }
      await refresh();
    }, 2000);
  }
})();
