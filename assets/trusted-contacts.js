"use strict";
// Owner 2026-11-17: the DanzStak team adds promoters and crews they know. Editors only (server-checked).
(() => {
  const api = "https://api.danzstak.com/club-directory/contacts";
  const form = document.getElementById("contactForm"), status = document.getElementById("formStatus"), list = document.getElementById("contactList"), heading = document.getElementById("countHeading");
  const request = async (method, body) => {
    const response = await fetch(api, { method, credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? "Sign in first." : data.error || "Contacts are unavailable right now.");
    return data;
  };
  const render = contacts => {
    heading.textContent = `Contacts ${contacts.length}`;
    list.replaceChildren(...contacts.map(contact => {
      const item = document.createElement("li"), name = document.createElement("strong"), meta = document.createElement("span"), reach = document.createElement("span");
      name.textContent = contact.name;
      meta.textContent = [contact.categories, (contact.towns || []).join(", "), (contact.venues || []).join(", ")].filter(Boolean).join(" · ");
      reach.textContent = [contact.phone, contact.email, contact.website].filter(Boolean).join(" · ");
      item.append(name, meta, reach);
      return item;
    }));
  };
  const load = async () => {
    try { render((await request("GET")).contacts || []); }
    catch (error) { form.hidden = true; status.textContent = window.danzstakFriendlyError?.(error, "Your contacts could not be loaded or saved. Try again in a moment.") ?? "Your contacts could not be loaded or saved. Try again in a moment."; form.after(status); }
  };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const body = { ...data, towns: String(data.towns || "").split(";").map(town => town.trim()).filter(Boolean), consent: form.elements.consent.checked };
    const button = form.querySelector("button");
    button.disabled = true; status.textContent = "Saving…";
    try {
      const saved = await request("POST", body);
      status.textContent = `Saved for ${(saved.towns || []).join(", ") || "your list"}.${saved.unplaced?.length ? ` Couldn't place: ${saved.unplaced.join(", ")}.` : ""}`;
      form.reset();
      await load();
    } catch (error) { status.textContent = window.danzstakFriendlyError?.(error, "Your contacts could not be loaded or saved. Try again in a moment.") ?? "Your contacts could not be loaded or saved. Try again in a moment."; }
    finally { button.disabled = false; }
  });
  load();
})();
