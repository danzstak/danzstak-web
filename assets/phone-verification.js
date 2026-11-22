"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  const statusNode = byId("syncPhoneStatus"), numberForm = byId("syncPhoneNumberForm"), codeForm = byId("syncPhoneCodeForm"), verified = byId("syncPhoneVerified"), section = document.querySelector(".sync-phone-verification");
  if (!statusNode || !numberForm || !codeForm || !verified || !section) return;
  const country = byId("syncPhoneCountryCode"), number = byId("syncPhoneNumber"), code = byId("syncPhoneCode"), send = byId("syncPhoneSend"), confirmButton = byId("syncPhoneConfirm"), resend = byId("syncPhoneResend"), remove = byId("syncPhoneRemove"), title = byId("syncPhoneTitle"), intro = byId("syncPhoneIntro");
  let current = null, timer = 0, deviceChallenge = null, resolveReady;
  const phoneReady = new Promise(resolve => { resolveReady = resolve; });
  const t = value => window.danzstakTranslate?.(value) || value;
  const ERROR_TEXT = {
    invalid_number: "That mobile number isn't valid. Check the country code and number.",
    max_send_attempts: "Too many codes were sent to this number. Try again later.",
    attempts: "Too many incorrect codes. Request a new text later.",
    fraud_blocked: "Texts to this number are blocked to prevent fraud. Use another mobile number.",
    geo_blocked: "SYNC can't send verification texts to this country yet.",
    expired: "That code expired. Request a new text.",
    rate_limited: "Too many verification attempts. Try again later.",
    resend_cooldown: "Wait before requesting another verification text.",
    invalid: "That code is incorrect. Request a new code.",
    used: "This verification request is no longer active.",
    resend_window: "You can resend once. Try again in 10 minutes.",
    number_limit: "This number is already linked to 10 DanzStak accounts.",
    provider_unavailable: "SYNC verification texts aren't available yet. No text was sent.",
    send_failed: "The verification text could not be sent. No number was verified.",
    send_try_again: "Couldn't send the code right now. Try again in a minute.",
    confirm_try_again: "Couldn't check the code right now. Try again in a minute.",
    try_again: "Something went wrong on our side. Try again in a minute."
  };
  // The phone's languages, so Twilio texts the code in the member's language (the server allowlists them).
  const phoneLanguages = () => (Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language || "en"]).slice(0, 8);

  async function request(path, options = {}) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API + path, { credentials:"include", cache:"no-store", signal:controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(ERROR_TEXT[data.code] ? t(ERROR_TEXT[data.code]) : data.error || t("Phone settings could not be updated.")); error.code = data.code || ""; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error(t("Phone settings took too long to respond."));
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function message(text, state = "") { statusNode.textContent = t(text); statusNode.dataset.state = state; }
  function enrollmentBody(extra = {}) { return deviceChallenge ? { ...extra, purpose:"sync_device", deviceChallengeId:deviceChallenge.challengeId, deviceChallenge:deviceChallenge.challenge } : extra; }
  function cooldown() {
    clearTimeout(timer);
    if (current?.state !== "pending") return;
    const seconds = Math.max(0, Math.ceil((Date.parse(current.resendAfter || 0) - Date.now()) / 1000));
    resend.disabled = seconds > 0 || current.providerAvailable !== true;
    const resendLabel = resend.querySelector(".ds-cue-label") || resend;
    // A live countdown instead of an error box (directive L2): "Resend in 0:52".
    resendLabel.textContent = seconds ? `${t("Resend in")} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : t("Resend");
    if (seconds) timer = setTimeout(cooldown, 1000);
  }
  function render(data) {
    current = { ...(current || {}), ...(data || {}) };
    // Owner 2026-11-19 (L2): a verified number is only "done" once THIS device is registered too; otherwise offer to finish here.
    const deviceRegistered = window.danzstakSyncDeviceRegistered?.() === true, deviceOtp = current.deviceOtpRequired === true;
    const pending = current.state === "pending", done = current.state === "verified" && !deviceChallenge && (deviceRegistered || !deviceOtp);
    const finishHere = current.state === "verified" && !deviceChallenge && !done;
    numberForm.hidden = pending || done; codeForm.hidden = !pending; verified.hidden = !done;
    send.disabled = pending || done || current.providerAvailable !== true;
    if (done) message(`${t("Private phone registered to SYNC")} · ${current.maskedNumber}`, "verified");
    else if (pending) message(t("Enter the six-digit code sent to {number}.").replace("{number}", current.maskedNumber || ""));
    else if (finishHere && current.providerAvailable) message(`${t("Your number is verified")} · ${current.maskedNumber || ""}. ${t("Send a code to finish on this device.")}`);
    else if (current.providerAvailable) message(""); // the one short line above the form is enough (directive L2)
    else message(t("SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified."), "blocked");
    cooldown();
  }
  async function load() {
    setupCountries();
    message(t("Checking SMS verification availability…"));
    try { render(await request("/phone-verification")); }
    catch(error) { message(error.message, "error"); numberForm.hidden = codeForm.hidden = verified.hidden = true; }
    finally { resolveReady(current); window.dispatchEvent(new CustomEvent("danzstak:phone-verification-ready")); }
  }
  async function startDeviceOtp(challenge, { keepNumber = false } = {}) {
    await phoneReady;
    if (!challenge || !/^[a-f0-9-]{36}$/.test(String(challenge.challengeId || "")) || !/^[A-Za-z0-9_-]{43}$/.test(String(challenge.challenge || ""))) throw new Error(t("Device registration challenge is invalid. Start again."));
    deviceChallenge = { challengeId:challenge.challengeId, challenge:challenge.challenge };
    section.dataset.deviceEnrollment = "true";
    title.textContent = t("Verify this device by SMS");
    intro.textContent = t("Every SYNC device must receive its own one-time code. The code is bound to this device registration and cannot enroll another device.");
    numberForm.hidden = false; codeForm.hidden = true; verified.hidden = true; code.value = "";
    if (keepNumber) return;
    render({ state:"none", verified:false, maskedNumber:"" });
    section.scrollIntoView({ block:"start", behavior:"auto" });
    number.focus({ preventScroll:true });
  }

  numberForm.addEventListener("submit", async event => {
    event.preventDefault(); send.disabled = true; message(t("Sending verification text…"));
    try {
      if (current?.providerAvailable !== true) throw new Error(t("SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified."));
      // A fresh device challenge for every send (L2): never send a code bound to an expired challenge.
      const challenge = await window.danzstakBeginCallingDeviceEnrollment();
      if (!deviceChallenge || challenge.challengeId !== deviceChallenge.challengeId) await startDeviceOtp(challenge, { keepNumber:true });
      render(await request("/phone-verification/send", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(enrollmentBody({countryCode:country.value,localNumber:number.value,languages:phoneLanguages()})) }));
      code.focus();
    }
    catch(error) { message(error.message, "error"); send.disabled = false; }
  });
  codeForm.addEventListener("submit", async event => {
    event.preventDefault(); confirmButton.disabled = true; message(t("Checking code…"));
    try {
      const result = await request("/phone-verification/confirm", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(enrollmentBody({code:code.value})) });
      if (deviceChallenge) {
        if (!result.deviceGrantId || !result.deviceGrantToken) throw new Error(t("The server did not issue a device verification grant. Request a new code."));
        message(t("SMS code confirmed. Finishing device registration…"), "verified");
        window.dispatchEvent(new CustomEvent("danzstak:device-otp-confirmed", { detail:{ deviceGrantId:result.deviceGrantId, deviceGrantToken:result.deviceGrantToken } }));
      } else render(result);
    } catch(error) {
      // A wrong, expired or used code ends the challenge on the server: go back to "Text me a code" and keep the message.
      if (["invalid", "expired", "used", "attempts"].includes(error.code)) { render({ state:"none", verified:false }); code.value = ""; number.focus(); }
      message(error.message, "error"); if (!numberForm.hidden) return; code.select();
    }
    finally { confirmButton.disabled = false; }
  });
  // Directive L2: the code submits itself when the 6th digit is in (typed, pasted or filled from the SMS).
  code.addEventListener("input", () => {
    const digits = code.value.replace(/\D/g, "").slice(0, 6);
    if (digits !== code.value) code.value = digits;
    if (digits.length === 6 && !confirmButton.disabled && !codeForm.hidden) codeForm.requestSubmit();
  });
  // Android: the WebOTP API fills the code from the SMS when the text carries the "@danzstak.com #123456" line.
  // Without that line (Twilio's default text) nothing happens, and the keyboard still offers the code (one-time-code).
  let otpAbort = null;
  function listenForSmsCode() {
    otpAbort?.abort(); otpAbort = null;
    if (!("OTPCredential" in window) || !navigator.credentials?.get) return;
    const controller = new AbortController(); otpAbort = controller;
    navigator.credentials.get({ otp:{ transport:["sms"] }, signal:controller.signal }).then(credential => {
      if (!credential?.code || codeForm.hidden || !/^\d{6}$/.test(credential.code)) return;
      code.value = credential.code; code.dispatchEvent(new Event("input", { bubbles:true }));
    }).catch(() => {});
  }
  new MutationObserver(() => { if (codeForm.hidden) { otpAbort?.abort(); otpAbort = null; } else listenForSmsCode(); }).observe(codeForm, { attributes:true, attributeFilter:["hidden"] });
  // "Wrong number? Change it": back to the number, one tap, the typed number kept and selected.
  byId("syncPhoneChangeNumber")?.addEventListener("click", () => { codeForm.hidden = true; numberForm.hidden = false; send.disabled = current?.providerAvailable !== true; number.focus(); number.select(); });
  // Directive L2: the country is prefilled from the phone's region or language, and every name is in the visitor's language.
  const COUNTRIES = [["US","+1"],["CA","+1"],["IT","+39"],["GB","+44"],["IE","+353"],["DE","+49"],["AT","+43"],["CH","+41"],["FR","+33"],["BE","+32"],["NL","+31"],["ES","+34"],["PT","+351"],["SE","+46"],["NO","+47"],["DK","+45"],["FI","+358"],["PL","+48"],["CZ","+420"],["GR","+30"],["MX","+52"],["BR","+55"],["AR","+54"],["AU","+61"],["NZ","+64"],["JP","+81"]];
  const LANGUAGE_REGION = { it:"IT", fr:"FR", de:"DE", es:"ES", pt:"PT", nl:"NL", sv:"SE", nb:"NO", da:"DK", fi:"FI", pl:"PL", cs:"CZ", el:"GR", ja:"JP", en:"US" };
  function setupCountries() {
    if (!country || country.dataset.ready) return;
    country.dataset.ready = "1";
    const lang = document.documentElement.lang || navigator.language || "en";
    let names = null; try { names = new Intl.DisplayNames([lang, "en"], { type:"region" }); } catch { /* old browser: keep English names */ }
    const tags = (Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language || "en"]).map(String);
    const region = tags.map(tag => (tag.match(/[-_]([A-Za-z]{2})\b/) || [])[1]?.toUpperCase()).find(value => COUNTRIES.some(([code]) => code === value))
      || LANGUAGE_REGION[(tags[0] || "en").slice(0, 2).toLowerCase()] || "US";
    country.replaceChildren(...COUNTRIES.map(([code, dial]) => { const option = document.createElement("option"); option.value = dial; option.dataset.region = code; option.textContent = `${names?.of(code) || code} ${dial}`; if (code === region) option.selected = true; return option; }));
  }
  // Resend brings back a Send button that works (it stayed disabled while the old code was "pending").
  resend.addEventListener("click", () => { codeForm.hidden = true; numberForm.hidden = false; send.disabled = current?.providerAvailable !== true; number.focus(); });
  remove.addEventListener("click", async () => {
    if (!globalThis.confirm(t("Remove your verified private number from SYNC?"))) return;
    remove.disabled = true; message(t("Removing number…"));
    try { render(await request("/phone-verification", {method:"DELETE"})); number.value = code.value = ""; }
    catch(error) { message(error.message,"error"); } finally { remove.disabled=false; }
  });
  document.addEventListener("danzstak:calling-devices-opened", () => { if (!current) load(); });
  window.addEventListener("danzstak:call-device-registered", () => {
    deviceChallenge = null;
    delete section.dataset.deviceEnrollment;
    render({ state:"verified", verified:true });
  });
  window.addEventListener("danzstak:call-device-ready", () => { if (current) render(); });
  window.addEventListener("danzstak:device-registration-failed", event => {
    deviceChallenge = null;
    render({ state: current?.state === "verified" ? "verified" : "none" });
    message(event.detail?.expired ? "That took a little long. Send a new code to finish on this device." : "This device could not be registered. Send a new code to try again.", "error");
  });
  document.addEventListener("DOMContentLoaded", load);
  window.danzstakPhoneVerificationReady = phoneReady;
  window.danzstakDeviceOtpRequired = () => current?.deviceOtpRequired === true;
  window.danzstakStartDeviceOtp = startDeviceOtp;
})();
