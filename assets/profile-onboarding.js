"use strict";
(() => {
  const panel = document.getElementById("profileOnboarding");
  const form = document.getElementById("profileOnboardingForm");
  if (!panel || !form) return;
  const nameInput = document.getElementById("profileOnboardingName");
  const handleInput = document.getElementById("profileOnboardingHandle");
  const save = document.getElementById("profileOnboardingSave");
  const status = document.getElementById("profileOnboardingStatus");
  let handleWasEdited = false;

  const copy = {
    en: { title: "What should people call you?", help: "Add your name once so friends can recognize and find you.", name: "Your name", handle: "Username", save: "Save my name", saving: "Saving your name…", saved: "Your DanzStak name is ready." },
    it: { title: "Come vuoi farti chiamare?", help: "Aggiungi il tuo nome una volta, così gli amici possono riconoscerti e trovarti.", name: "Il tuo nome", handle: "Nome utente", save: "Salva il mio nome", saving: "Salvataggio del nome…", saved: "Il tuo nome DanzStak è pronto." }
  };
  let language = "en";
  try { language = (localStorage.getItem("danzstak_language") || document.documentElement.lang || navigator.language || "en").toLowerCase().split("-")[0]; } catch { language = String(document.documentElement.lang || "en").toLowerCase().split("-")[0]; }
  const words = copy[language] || copy.en;
  document.getElementById("profileOnboardingTitle").textContent = words.title;
  document.getElementById("profileOnboardingHelp").textContent = words.help;
  document.getElementById("profileOnboardingNameLabel").textContent = words.name;
  document.getElementById("profileOnboardingHandleLabel").textContent = words.handle;
  save.textContent = words.save;

  const suggestedHandle = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24);
  nameInput.addEventListener("input", () => {
    if (!handleWasEdited) handleInput.value = suggestedHandle(nameInput.value);
  });
  handleInput.addEventListener("input", event => { handleWasEdited = event.isTrusted !== false || Boolean(handleInput.value); });

  async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error("DanzStak is taking too long. Try again.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function load() {
    try {
      const response = await request("https://api.danzstak.com/profiles", { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      const profile = (await response.json()).profile || {};
      const genericName = !profile.name || profile.name === "DanzStak member";
      const genericHandle = !profile.handle || profile.handle === "danzstak-member" || profile.handle === "member";
      if (!genericName && !genericHandle) return;
      nameInput.value = genericName ? "" : profile.name;
      handleInput.value = genericHandle ? suggestedHandle(nameInput.value) : profile.handle;
      handleWasEdited = !genericHandle;
      panel.hidden = false;
      nameInput.focus({ preventScroll: true });
    } catch { /* Profile editing remains available if onboarding cannot load. */ }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled || !form.reportValidity()) return;
    const name = nameInput.value.trim();
    const handle = handleInput.value.trim().replace(/^@/, "");
    save.disabled = true;
    status.textContent = words.saving;
    try {
      const response = await request("https://api.danzstak.com/profiles", {
        method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, handle })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.suggestion) {
          if (/display name/i.test(data.error || "")) nameInput.value = data.suggestion;
          else handleInput.value = data.suggestion;
        }
        throw new Error(data.error || "Your name could not be saved. Try again.");
      }
      status.textContent = words.saved;
      const composerAvatar = document.querySelector(".composer-avatar");
      if (composerAvatar) composerAvatar.textContent = name.charAt(0).toUpperCase() || "D";
      setTimeout(() => { panel.hidden = true; }, 700);
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });

  load();
})();
