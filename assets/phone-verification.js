"use strict";

(() => {
  const api = "https://api.danzstak.com";
  const dialog = document.getElementById("phoneVerificationDialog");
  const openButton = document.getElementById("phoneVerificationOpen");
  if (!dialog || !openButton) return;
  const closeButton = document.getElementById("phoneVerificationClose");
  const status = document.getElementById("phoneVerificationStatus");
  const numberForm = document.getElementById("phoneNumberForm");
  const codeForm = document.getElementById("phoneCodeForm");
  const verifiedActions = document.getElementById("phoneVerifiedActions");
  const countryCode = document.getElementById("phoneCountryCode");
  const localNumber = document.getElementById("phoneLocalNumber");
  const code = document.getElementById("phoneVerificationCode");
  const sendButton = document.getElementById("phoneSendCode");
  const confirmButton = document.getElementById("phoneConfirmCode");
  const resendButton = document.getElementById("phoneResendCode");
  const changeButton = document.getElementById("phoneChangeNumber");
  const replaceButton = document.getElementById("phoneReplaceNumber");
  const removeButton = document.getElementById("phoneRemoveNumber");
  let current = null, cooldownTimer = 0;
  const translate = value => window.danzstakTranslate?.(value) || value;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(api + path, { credentials: "include", cache: "no-store", signal: controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || translate("Phone settings could not be updated."));
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error(translate("Phone settings took too long to respond."));
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function setStatus(message, state = "") {
    status.textContent = translate(message);
    if (state) status.dataset.state = state; else delete status.dataset.state;
  }

  function updateCooldown() {
    clearTimeout(cooldownTimer);
    if (current?.state !== "pending") return;
    const seconds = Math.max(0, Math.ceil((Date.parse(current.resendAfter || 0) - Date.now()) / 1000));
    resendButton.disabled = seconds > 0 || current.providerAvailable !== true;
    resendButton.textContent = seconds > 0 ? `${translate("Resend code")} (${seconds}s)` : translate("Resend code");
    if (seconds > 0) cooldownTimer = setTimeout(updateCooldown, 1000);
  }

  function render(data) {
    current = data;
    const pending = data?.state === "pending", verified = data?.state === "verified";
    numberForm.hidden = pending || verified;
    codeForm.hidden = !pending;
    verifiedActions.hidden = !verified;
    sendButton.disabled = data?.providerAvailable !== true;
    if (verified) setStatus(`${translate("Phone verified")} · ${data.maskedNumber}`, "verified");
    else if (pending) setStatus(`${translate("Enter the six-digit code sent to")} ${data.maskedNumber}.`);
    else if (data?.providerAvailable === true) setStatus(translate("Add a private mobile number if you want optional possession verification."));
    else setStatus(translate("Verification texts are not enabled yet. No text will be sent."), "error");
    updateCooldown();
  }

  async function load() {
    setStatus(translate("Loading phone settings…"));
    try { render(await request("/phone-verification")); }
    catch (error) { setStatus(error.message, "error"); numberForm.hidden = true; codeForm.hidden = true; verifiedActions.hidden = true; }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("phone-settings-open");
    load();
  }
  function close() {
    clearTimeout(cooldownTimer);
    dialog.close();
    document.body.classList.remove("phone-settings-open");
    openButton.focus({ preventScroll: true });
  }
  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });

  numberForm.addEventListener("submit", async event => {
    event.preventDefault(); sendButton.disabled = true; setStatus(translate("Sending verification text…"));
    try {
      render(await request("/phone-verification/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: countryCode.value, localNumber: localNumber.value }) }));
      code.focus();
    } catch (error) { setStatus(error.message, "error"); sendButton.disabled = current?.providerAvailable !== true; }
  });
  codeForm.addEventListener("submit", async event => {
    event.preventDefault(); confirmButton.disabled = true; setStatus(translate("Checking code…"));
    try { render(await request("/phone-verification/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.value }) })); }
    catch (error) { setStatus(error.message, "error"); code.select(); }
    finally { confirmButton.disabled = false; }
  });
  resendButton.addEventListener("click", () => {
    if (countryCode.value.trim() && localNumber.value.trim()) {
      numberForm.requestSubmit();
      return;
    }
    codeForm.hidden = true;
    numberForm.hidden = false;
    localNumber.focus();
  });
  for (const button of [changeButton, replaceButton]) button.addEventListener("click", () => { codeForm.hidden = true; verifiedActions.hidden = true; numberForm.hidden = false; localNumber.focus(); });
  removeButton.addEventListener("click", async () => {
    if (!confirm(translate("Remove your verified personal number from DanzStak?"))) return;
    removeButton.disabled = true; setStatus(translate("Removing number…"));
    try { render(await request("/phone-verification", { method: "DELETE" })); countryCode.value = ""; localNumber.value = ""; code.value = ""; }
    catch (error) { setStatus(error.message, "error"); }
    finally { removeButton.disabled = false; }
  });

  if (new URLSearchParams(location.search).get("phone-settings") === "1") open();
})();
