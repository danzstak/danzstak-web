"use strict";

(() => {
  const api = "https://api.danzstak.com";
  const panel = document.querySelector(".booking-identity");
  const act = document.getElementById("bandName");
  const city = document.getElementById("startCity");
  const save = document.getElementById("saveBookingIdentity");
  const status = document.getElementById("bookingIdentityStatus");
  if (!panel || !act || !city || !save || !status) return;

  let revision = "";
  let loading = true;

  async function request(path, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(api + path, { credentials: "include", cache: "no-store", ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to load your booking details." : data.error || "Booking details are unavailable right now.");
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function setState(kind, message) {
    panel.classList.toggle("is-dirty", kind === "dirty");
    panel.classList.toggle("is-saved", kind === "saved");
    status.textContent = message;
  }

  async function load() {
    save.disabled = true;
    const results = await Promise.allSettled([
      request("/booking-pipeline"),
      request("/epk"),
      request("/profiles")
    ]);
    const workspace = results[0].status === "fulfilled" ? results[0].value : {};
    const epk = results[1].status === "fulfilled" ? results[1].value.kit || {} : {};
    const profile = results[2].status === "fulfilled" ? results[2].value.profile || {} : {};
    revision = typeof workspace.revision === "string" ? workspace.revision : "";
    const savedAct = String(workspace.artist?.name || "").trim();
    const savedCity = String(workspace.artist?.hometown || "").trim();
    act.value = savedAct || String(epk.artistName || profile.name || "").trim();
    city.value = savedCity || String(epk.hometown || profile.location || "").trim();
    loading = false;
    save.disabled = false;
    if (savedAct || savedCity) setState("saved", "Saved booking details loaded from your account.");
    else if (act.value || city.value) setState("dirty", "Suggested from your EPK or profile. Check the details, then save them for future bookings.");
    else setState("", "Add your home city once and save it. The act name can stay blank while you browse.");
  }

  function changed() {
    if (loading) return;
    setState("dirty", "Not saved yet. Save these details to use them on your other devices.");
  }

  act.addEventListener("input", changed);
  city.addEventListener("input", changed);
  save.addEventListener("click", async () => {
    const name = act.value.trim();
    const hometown = city.value.trim();
    if (!hometown) {
      setState("dirty", "Add a home city before saving.");
      city.focus();
      return;
    }
    save.disabled = true;
    setState("dirty", "Saving…");
    try {
      const data = await request("/booking-pipeline/identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hometown, revision })
      });
      revision = data.revision || revision;
      setState("saved", "Saved to your DanzStak booking account.");
    } catch (error) {
      setState("dirty", error.name === "AbortError" ? "Saving took too long. Reload your saved details before trying again." : error.message);
    } finally {
      save.disabled = false;
    }
  });

  load().catch(error => {
    loading = false;
    save.disabled = false;
    setState("", error.name === "AbortError" ? "Loading took too long. You can still enter details and try saving." : error.message);
  });
})();
