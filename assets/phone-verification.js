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

  async function request(path, options = {}) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API + path, { credentials:"include", cache:"no-store", signal:controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || t("Phone settings could not be updated.")); error.code = data.code || ""; throw error; }
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
    resend.textContent = seconds ? `${t("Resend code")} (${seconds}s)` : t("Resend code");
    if (seconds) timer = setTimeout(cooldown, 1000);
  }
  function render(data) {
    current = { ...(current || {}), ...(data || {}) };
    const pending = current.state === "pending", done = current.state === "verified" && !deviceChallenge;
    numberForm.hidden = pending || done; codeForm.hidden = !pending; verified.hidden = !done;
    send.disabled = current.providerAvailable !== true;
    if (done) message(`${t("Private phone registered to SYNC")} · ${current.maskedNumber}`, "verified");
    else if (pending) message(`${t("Enter the six-digit code sent to")} ${current.maskedNumber}.`);
    else if (current.providerAvailable) message(deviceChallenge ? t("Enter a mobile number that can receive this device's one-time code.") : t("Enter a private mobile number. SYNC will text a six-digit code."));
    else message(t("AWS has not approved SYNC verification texts yet. No text will be sent and no device will be marked verified."), "blocked");
    cooldown();
  }
  async function load() {
    message(t("Checking SMS verification availability…"));
    try { render(await request("/phone-verification")); }
    catch(error) { message(error.message, "error"); numberForm.hidden = codeForm.hidden = verified.hidden = true; }
    finally { resolveReady(current); window.dispatchEvent(new CustomEvent("danzstak:phone-verification-ready")); }
  }
  async function startDeviceOtp(challenge) {
    await phoneReady;
    if (!challenge || !/^[a-f0-9-]{36}$/.test(String(challenge.challengeId || "")) || !/^[A-Za-z0-9_-]{43}$/.test(String(challenge.challenge || ""))) throw new Error(t("Device registration challenge is invalid. Start again."));
    deviceChallenge = { challengeId:challenge.challengeId, challenge:challenge.challenge };
    section.dataset.deviceEnrollment = "true";
    title.textContent = t("Verify this device by SMS");
    intro.textContent = t("Every SYNC device must receive its own one-time code. The code is bound to this device registration and cannot enroll another device.");
    numberForm.hidden = false; codeForm.hidden = true; verified.hidden = true; code.value = "";
    render({ state:"none", verified:false, maskedNumber:"" });
    section.scrollIntoView({ block:"start", behavior:"auto" });
    number.focus({ preventScroll:true });
  }

  numberForm.addEventListener("submit", async event => {
    event.preventDefault(); send.disabled = true; message(t("Sending verification text…"));
    try { render(await request("/phone-verification/send", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(enrollmentBody({countryCode:country.value,localNumber:number.value})) })); code.focus(); }
    catch(error) { message(error.message, "error"); send.disabled = current?.providerAvailable !== true; }
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
    } catch(error) { message(error.message, "error"); code.select(); }
    finally { confirmButton.disabled = false; }
  });
  resend.addEventListener("click", () => { codeForm.hidden = true; numberForm.hidden = false; number.focus(); });
  remove.addEventListener("click", async () => {
    if (!globalThis.confirm(t("Remove your verified private number from SYNC?"))) return;
    remove.disabled = true; message(t("Removing number…"));
    try { render(await request("/phone-verification", {method:"DELETE"})); number.value = code.value = ""; }
    catch(error) { message(error.message,"error"); } finally { remove.disabled=false; }
  });
  document.addEventListener("danzstak:calling-devices-opened", () => { if (!current) load(); });
  document.addEventListener("DOMContentLoaded", load);
  window.danzstakPhoneVerificationReady = phoneReady;
  window.danzstakDeviceOtpRequired = () => current?.deviceOtpRequired === true;
  window.danzstakStartDeviceOtp = startDeviceOtp;
})();
