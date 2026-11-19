"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  const statusNode = byId("syncPhoneStatus"), numberForm = byId("syncPhoneNumberForm"), codeForm = byId("syncPhoneCodeForm"), verified = byId("syncPhoneVerified"), section = document.querySelector(".sync-phone-verification");
  if (!statusNode || !numberForm || !codeForm || !verified || !section) return;
  const country = byId("syncPhoneCountryCode"), number = byId("syncPhoneNumber"), code = byId("syncPhoneCode"), send = byId("syncPhoneSend"), confirmButton = byId("syncPhoneConfirm"), resend = byId("syncPhoneResend"), remove = byId("syncPhoneRemove"), finish = byId("syncPhoneFinish"), title = byId("syncPhoneTitle"), intro = byId("syncPhoneIntro");
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
    send_failed: "The verification text could not be sent. No number was verified."
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
    resendLabel.textContent = seconds ? `${t("Resend")} ${seconds}s` : t("Resend");
    if (seconds) timer = setTimeout(cooldown, 1000);
  }
  // Directive L2 (owner 2026-11-19): the number can be verified while this device never finished registering
  // (the old 5-minute challenge ran out). That must never be a dead end: offer "Finish on this device".
  const deviceUnfinished = () => current?.deviceOtpRequired === true && typeof window.danzstakSyncDeviceRegistered === "function" && window.danzstakSyncDeviceRegistered() === false;
  function render(data) {
    current = { ...(current || {}), ...(data || {}) };
    const pending = current.state === "pending", done = current.state === "verified" && !deviceChallenge, unfinished = done && deviceUnfinished();
    numberForm.hidden = pending || done; codeForm.hidden = !pending; verified.hidden = !done;
    if (finish) finish.hidden = !unfinished;
    send.disabled = pending || done || current.providerAvailable !== true;
    if (unfinished) message(`${t("Your number is verified")} · ${current.maskedNumber}. ${t("This device still needs one new code to finish.")}`, "pending");
    else if (done) message(`${t("Private phone registered to SYNC")} · ${current.maskedNumber}`, "verified");
    else if (pending) message(`${t("Enter the six-digit code sent to")} ${current.maskedNumber}.`);
    else if (current.providerAvailable) message(deviceChallenge ? t("Enter a mobile number that can receive this device's one-time code.") : t("Enter a private mobile number. SYNC will text a six-digit code."));
    else message(t("SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified."), "blocked");
    cooldown();
  }
  async function load() {
    message(t("Checking SMS verification availability…"));
    try { render(await request("/phone-verification")); }
    catch(error) { message(error.message, "error"); numberForm.hidden = codeForm.hidden = verified.hidden = true; }
    finally { resolveReady(current); window.dispatchEvent(new CustomEvent("danzstak:phone-verification-ready")); }
  }
  function bindChallenge(challenge) {
    if (!challenge || !/^[a-f0-9-]{36}$/.test(String(challenge.challengeId || "")) || !/^[A-Za-z0-9_-]{43}$/.test(String(challenge.challenge || ""))) throw new Error(t("Device registration challenge is invalid. Start again."));
    deviceChallenge = { challengeId:challenge.challengeId, challenge:challenge.challenge };
    section.dataset.deviceEnrollment = "true";
  }
  async function startDeviceOtp(challenge) {
    await phoneReady;
    bindChallenge(challenge);
    title.textContent = t("Verify this device by SMS");
    intro.textContent = t("Every SYNC device must receive its own one-time code. The code is bound to this device registration and cannot enroll another device.");
    numberForm.hidden = false; codeForm.hidden = true; verified.hidden = true; code.value = "";
    render({ state:"none", verified:false, maskedNumber:"" });
    section.scrollIntoView({ block:"start", behavior:"auto" });
    number.focus({ preventScroll:true });
  }

  numberForm.addEventListener("submit", async event => {
    event.preventDefault(); send.disabled = true; message(t("Sending verification text…"));
    try {
      if (current?.providerAvailable !== true) throw new Error(t("SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified."));
      // A fresh device challenge on every send, so the code and the challenge always expire together (directive L2).
      bindChallenge(await window.danzstakBeginCallingDeviceEnrollment({ maxAgeMs:60000 }));
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
  // One tap back to "Send code" with the number still filled in (an expired challenge, or a verified number on an unfinished device).
  async function restart(text) {
    try { await startDeviceOtp(await window.danzstakBeginCallingDeviceEnrollment({ fresh:true })); }
    catch(error) { message(error.message, "error"); return; }
    message(text, "pending"); send.focus({ preventScroll:true });
  }
  finish?.addEventListener("click", () => restart(t("Enter your number and we'll text one new code to finish this device.")));
  window.addEventListener("danzstak:device-registration-restart", () => restart(t("That took a little long. We'll send a new code.")));
  window.addEventListener("danzstak:call-device-ready", () => { if (current) render(); });
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
  document.addEventListener("DOMContentLoaded", load);
  window.danzstakPhoneVerificationReady = phoneReady;
  window.danzstakDeviceOtpRequired = () => current?.deviceOtpRequired === true;
  window.danzstakStartDeviceOtp = startDeviceOtp;
})();
