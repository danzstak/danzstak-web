"use strict";
(() => {
  const panel = document.getElementById("profileOnboarding");
  const form = document.getElementById("profileOnboardingForm");
  if (!panel || !form) return;
  const nameInput = document.getElementById("profileOnboardingName");
  const handleInput = document.getElementById("profileOnboardingHandle");
  const save = document.getElementById("profileOnboardingSave");
  const status = document.getElementById("profileOnboardingStatus");
  const next = document.getElementById("profileOnboardingNext");
  const findPeople = document.getElementById("profileOnboardingFindPeople");
  const done = document.getElementById("profileOnboardingDone");
  const copy = {
    en: { title: "What should people call you?", help: "Enter the name you want people to see. DanzStak handles the username for you.", name: "Name people see", save: "Use this name", saving: "Saving your name…", saved: "Your name is ready. Find people who are online and add your first friends.", later: "You can change this later in Settings → Edit Profile.", find: "Find people", done: "Not now" },
    it: { title: "Come vuoi farti chiamare?", help: "Inserisci il nome che vuoi mostrare. DanzStak crea automaticamente il nome utente.", name: "Nome visibile agli altri", save: "Usa questo nome", saving: "Salvataggio del nome…", saved: "Il tuo nome è pronto. Trova le persone online e aggiungi i tuoi primi amici.", later: "Puoi cambiarlo in seguito in Impostazioni → Modifica profilo.", find: "Trova persone", done: "Non ora" }
  };
  let language = "en";
  try { language = (localStorage.getItem("danzstak_language") || document.documentElement.lang || navigator.language || "en").toLowerCase().split("-")[0]; } catch { language = String(document.documentElement.lang || "en").toLowerCase().split("-")[0]; }
  const words = copy[language] || copy.en;
  document.getElementById("profileOnboardingTitle").textContent = words.title;
  document.getElementById("profileOnboardingHelp").textContent = words.help;
  document.getElementById("profileOnboardingNameLabel").textContent = words.name;
  document.getElementById("profileOnboardingLater").textContent = words.later;
  save.textContent = words.save;
  findPeople.textContent = words.find;
  done.textContent = words.done;

  const closeOnboarding = () => { panel.hidden = true; };
  findPeople.addEventListener("click", () => {
    closeOnboarding();
    document.querySelector('.topnav [data-feature="Friends"]')?.click();
  });
  done.addEventListener("click", closeOnboarding);

  const suggestedHandle = value => {
    const base = String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24) || "member";
    return base.length < 3 ? `${base}.1`.slice(0, 24) : base;
  };
  nameInput.addEventListener("input", () => {
    handleInput.value = suggestedHandle(nameInput.value);
  });

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
      const normalizedName = String(profile.name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
      const normalizedHandle = String(profile.handle || "").trim().replace(/^@/, "").toLocaleLowerCase();
      const genericName = !normalizedName || ["danzstak member", "danzstak user", "new member"].includes(normalizedName);
      const genericHandle = !normalizedHandle || ["danzstak-member", "danzstak.member", "danzstak_member", "member", "new-member"].includes(normalizedHandle);
      if (!genericName && !genericHandle) return;
      nameInput.value = genericName ? "" : profile.name;
      handleInput.value = genericHandle ? suggestedHandle(nameInput.value) : profile.handle;
      panel.hidden = false;
      nameInput.focus({ preventScroll: true });
    } catch { /* Profile editing remains available if onboarding cannot load. */ }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled || !form.reportValidity()) return;
    const name = nameInput.value.trim();
    const handle = suggestedHandle(handleInput.value || name);
    save.disabled = true;
    status.textContent = words.saving;
    try {
      let response = await request("https://api.danzstak.com/profiles", {
        method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, handle })
      });
      let data = await response.json().catch(() => ({}));
      if (!response.ok && data.suggestion && !/display name/i.test(data.error || "")) {
        handleInput.value = data.suggestion;
        response = await request("https://api.danzstak.com/profiles", {
          method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, handle: data.suggestion })
        });
        data = await response.json().catch(() => ({}));
      }
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
      form.hidden = true;
      document.getElementById("profileOnboardingLater").hidden = true;
      next.hidden = false;
      findPeople.focus({ preventScroll: true });
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });

  load();
})();
