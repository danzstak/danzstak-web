"use strict";
// Tribe creation screen, step 1 of design 29a (owner 2026-11-18: "users create a Tribe first and name it what they want;
// they select a category for their group"). Turns the old inline form into a full-screen, phone-first create screen:
// name with live checks and a counter, a live preview card (same art as the list), category chips, an optional
// description, the Community Standards promise, one sticky Create button. Privacy, visibility, city and invites come
// with the server update in design 29a step 2 (they are not shown until the server stores and enforces them).
(() => {
  const NAME_MIN = 3, NAME_MAX = 75, DESC_MAX = 240;
  const t = value => window.danzstakTranslate?.(value) || value;
  const BLOCKED = /\b(danz\s*stak|official|admin(istrator)?|moderator|support)\b/i;
  const ALLOWED = /^[\p{L}\p{N} &'\-.!?#/,]+$/u;
  function checkName(raw) {
    const name = String(raw || "").replace(/\s+/g, " ").trim();
    if (name.length < NAME_MIN) return { ok: false, name, reason: t("At least 3 characters") };
    if (name.length > NAME_MAX) return { ok: false, name, reason: t("75 characters at most") };
    if (/https?:|www\.|@\w/i.test(name)) return { ok: false, name, reason: t("No links or @handles in the name") };
    if (!ALLOWED.test(name)) return { ok: false, name, reason: t("Letters, numbers, spaces and & ' - . ! ? # / , only") };
    if (BLOCKED.test(name)) return { ok: false, name, reason: t("Pick a different name") };
    return { ok: true, name, reason: "" };
  }

  // Upgrades the existing form in place: keeps its inputs (so the existing create call and its tests keep working) and
  // adds the preview, chips, counter, description and a full-screen layout. Returns the extra pieces the caller needs.
  function enhance({ box, nameInput, categorySelect, standardsLabel, createButton, categoryName = c => c }) {
    if (!box || box.dataset.enhanced === "1") return null;
    box.dataset.enhanced = "1";
    box.classList.add("tribe-create-screen");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", t("Create Tribe"));
    const head = document.createElement("header"); head.className = "tribe-create-head";
    const back = document.createElement("button"); back.type = "button"; back.className = "ds-icon-button tribe-create-back"; back.setAttribute("aria-label", t("Close")); back.textContent = "←";
    const title = document.createElement("h2"); title.textContent = t("Create Tribe");
    head.append(back, title);
    // Live preview (no network).
    const preview = document.createElement("div"); preview.className = "tribe-create-preview"; preview.setAttribute("aria-hidden", "true");
    const pCover = document.createElement("div"); pCover.className = "tribe-create-preview-cover";
    const pName = document.createElement("strong"); pName.className = "tribe-create-preview-name";
    const pMeta = document.createElement("span"); pMeta.className = "tribe-create-preview-meta";
    preview.append(pCover, pName, pMeta);
    // Name: counter + inline check.
    const nameWrap = nameInput.closest("label") || nameInput.parentElement;
    nameInput.maxLength = NAME_MAX; nameInput.autocomplete = "off"; nameInput.setAttribute("enterkeyhint", "next");
    const nameNote = document.createElement("p"); nameNote.className = "tribe-create-note"; nameNote.setAttribute("aria-live", "polite");
    const counter = document.createElement("span"); counter.className = "tribe-create-counter";
    nameWrap.append(counter); nameWrap.after(nameNote);
    // Category chips (the select stays as the source of truth, hidden).
    const chips = document.createElement("div"); chips.className = "tribe-create-chips"; chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", t("Category"));
    const catLabel = categorySelect.closest("label");
    for (const option of categorySelect.options) {
      const chip = document.createElement("button"); chip.type = "button"; chip.className = "tribe-create-chip"; chip.setAttribute("role", "radio");
      chip.textContent = categoryName(option.value); chip.dataset.value = option.value;
      chip.addEventListener("click", () => { categorySelect.value = option.value; categorySelect.dispatchEvent(new Event("change")); });
      chips.append(chip);
    }
    const chipsHead = document.createElement("p"); chipsHead.className = "tribe-create-label"; chipsHead.textContent = t("Category");
    if (catLabel) { catLabel.hidden = true; catLabel.style.display = "none"; catLabel.after(chipsHead, chips); }
    // Optional description.
    const descWrap = document.createElement("label"); descWrap.className = "tribe-create-desc";
    descWrap.append(document.createTextNode(t("What's it about? (optional)")));
    const desc = document.createElement("textarea"); desc.rows = 3; desc.maxLength = DESC_MAX; desc.placeholder = t("Shows, sounds and people this Tribe is for");
    descWrap.append(desc);
    chips.after(descWrap);
    // Layout: header, preview, form, sticky Create.
    box.prepend(head, preview);
    const footer = document.createElement("div"); footer.className = "tribe-create-footer";
    standardsLabel.after(footer); footer.append(createButton);

    function paint() {
      const result = checkName(nameInput.value), category = categorySelect.value;
      pName.textContent = result.name || t("Your Tribe");
      pMeta.textContent = `${categoryName(category)} · ${t("1 member")}`;
      pCover.replaceChildren(window.danzstakTribeArt ? window.danzstakTribeArt.art(result.name || "Tribe", category) : document.createTextNode(""));
      counter.textContent = `${nameInput.value.length}/${NAME_MAX}`;
      nameNote.textContent = nameInput.value ? (result.ok ? "✓ " + t("Looks good") : result.reason) : "";
      nameNote.classList.toggle("is-ok", result.ok);
      for (const chip of chips.children) chip.setAttribute("aria-checked", String(chip.dataset.value === category));
      createButton.dataset.nameOk = String(result.ok);
    }
    nameInput.addEventListener("input", () => requestAnimationFrame(paint));
    categorySelect.addEventListener("change", paint);
    back.addEventListener("click", () => box.dispatchEvent(new CustomEvent("tribe-create-close")));
    box.addEventListener("keydown", event => { if (event.key === "Escape") box.dispatchEvent(new CustomEvent("tribe-create-close")); });
    // Full screen above the app bars: move the screen to <body> while it is open, back when closed.
    const home = box.parentElement, marker = document.createComment("tribe-create");
    new MutationObserver(() => {
      if (!box.hidden && box.parentElement !== document.body) { home?.insertBefore(marker, box); document.body.append(box); document.body.classList.add("tribe-create-open"); nameInput.focus(); }
      else if (box.hidden && marker.parentNode) { marker.replaceWith(box); document.body.classList.remove("tribe-create-open"); }
    }).observe(box, { attributes: true, attributeFilter: ["hidden"] });
    paint();
    return { description: () => desc.value.replace(/\s+/g, " ").trim().slice(0, DESC_MAX), reset() { desc.value = ""; nameInput.value = ""; paint(); }, paint };
  }
  window.danzstakTribeCreate = Object.freeze({ enhance, checkName, NAME_MAX });
})();
