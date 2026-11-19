"use strict";
// Answer to join (owner 2026-11-18): someone who is not a member opens a SYNC call invite,
// taps Answer, creates their DanzStak account and returns to SYNC to verify this phone and
// connect the call. The invite token stays in the link; nothing is written to browser storage.
(() => {
  const API = "https://api.danzstak.com";
  const LEGAL_VERSION = "2026-10-26";
  const token = new URLSearchParams(location.search).get("i") || "";
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  const returnPath = `/messages.html?invite=${token}`;
  const t = value => window.danzstakTranslate?.(value) || value;
  const $ = id => document.getElementById(id);

  async function apiFetch(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try { return await fetch(API + path, { credentials: "include", cache: "no-store", ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  function status(message) { $("answerStatus").textContent = message ? t(message) : ""; }

  function showGone() { $("answerCard").hidden = true; $("answerGone").hidden = false; status(""); }

  function showCaller(data) {
    const name = String(data.caller?.name || "Your friend");
    $("callerName").textContent = name;
    $("callerInitial").textContent = name.trim().charAt(0).toUpperCase() || "D";
    const picture = String(data.caller?.picture || "");
    if (/^https:\/\//.test(picture)) { const img = $("callerAvatar"); img.src = picture; img.hidden = false; $("callerInitial").hidden = true; }
    $("callKind").textContent = t(data.kind === "video" ? "is video calling you" : "is calling you");
    document.title = `${name} · ${t("Incoming call")} | DanzStak SYNC`;
    $("loginLink").href = `${API}/auth/login?next=${encodeURIComponent(returnPath)}`;
    $("answerCard").hidden = false;
    status("");
  }

  async function answer() {
    const button = $("answerBtn"), legal = $("legalAgreement");
    if (!legal.checked) { status("Tick the box to agree to the Terms and Privacy Policy, then tap Answer."); legal.focus(); return; }
    button.disabled = true; status("Setting up your account…");
    try {
      const response = await apiFetch("/auth/legal-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: LEGAL_VERSION, termsAccepted: true, privacyAcknowledged: true })
      });
      if (!response.ok) throw new Error("legal");
      location.assign(`${API}/auth/signup?next=${encodeURIComponent(returnPath)}`);
    } catch {
      button.disabled = false;
      status("DanzStak couldn't save your agreement. Check your connection and tap Answer again.");
    }
  }

  async function start() {
    if (!validToken) { showGone(); return; }
    status("Connecting…");
    try {
      const session = await apiFetch("/auth/session");
      if (session.ok && (await session.json().catch(() => ({}))).authenticated === true) { location.replace(returnPath); return; }
    } catch { /* not signed in or offline: show the invite */ }
    try {
      const response = await apiFetch(`/calls/invites/preview?i=${encodeURIComponent(token)}`);
      if (!response.ok) { showGone(); return; }
      showCaller(await response.json());
    } catch { status("DanzStak can't connect right now. Check your connection and reload this page."); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("answerBtn").addEventListener("click", answer);
    start();
  }, { once: true });
})();
