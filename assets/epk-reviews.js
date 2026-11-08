"use strict";

(() => {
  const api = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  let currentPublicId = "", currentTargets = [];

  async function request(path, options = {}, timeoutMs = 12000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(`${api}${path}`, { credentials:"include", cache:"no-store", ...options, signal:controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error("Reviews took too long to load. Try again.");
      throw new Error("Reviews are temporarily unavailable. Check your connection and try again.");
    } finally { clearTimeout(timer); }
  }

  const node = (tag, value = "", className = "") => {
    const element = document.createElement(tag);
    if (value) element.textContent = value;
    if (className) element.className = className;
    return element;
  };

  function initials(name) {
    return String(name || "D").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "D";
  }

  function reviewDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { year:"numeric", month:"short", day:"numeric" }).format(date);
  }

  async function confirmAction(message, options) {
    if (typeof window.danzstakConfirm === "function") return window.danzstakConfirm(message, options);
    return window.confirm(message);
  }

  function setStatus(message, urgent = false) {
    const status = byId("epkReviewsStatus");
    status.textContent = message;
    status.dataset.urgent = String(urgent);
  }

  async function removeFromEpk(review) {
    if (!await confirmAction("Remove this review from this EPK only? The review remains in its other DanzStak placements.", { title:"Remove from this EPK?", confirmLabel:"Remove from here" })) return;
    setStatus("Removing review from this EPK…");
    const response = await request(`/reviews/${encodeURIComponent(review.reviewId)}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({action:"remove_from_here",surface:"epk"}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The review could not be removed from this EPK.");
    await refreshReviews();
  }

  async function deleteEverywhere(review) {
    const warning = "Delete this review everywhere on DanzStak? The review disappears from every DanzStak placement. Screenshots or copies someone already made outside DanzStak cannot be recalled.";
    if (!await confirmAction(warning, { title:"Delete review everywhere?", confirmLabel:"Delete everywhere", danger:true })) return;
    setStatus("Deleting review everywhere…");
    const response = await request(`/reviews/${encodeURIComponent(review.reviewId)}`, { method:"DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The review could not be deleted.");
    await refreshReviews();
  }

  function openEditor(card, review) {
    card.querySelector(".epk-review-card__actions")?.setAttribute("hidden", "");
    const editor = node("form", "", "epk-review-edit"), textarea = document.createElement("textarea"), actions = node("div", "", "epk-review-card__actions"), save = node("button", "Save changes"), cancel = node("button", "Cancel");
    textarea.value = review.body; textarea.minLength = 10; textarea.maxLength = 5000; textarea.required = true; textarea.setAttribute("aria-label", `Edit review of ${review.targetTitle}`);
    save.type = "submit"; save.className = "primary"; cancel.type = "button"; actions.append(save, cancel); editor.append(textarea, actions); card.querySelector(".epk-review-card__main").append(editor); textarea.focus();
    cancel.addEventListener("click", () => { editor.remove(); card.querySelector(".epk-review-card__actions")?.removeAttribute("hidden"); });
    editor.addEventListener("submit", async event => {
      event.preventDefault(); const body = textarea.value.trim();
      if (body.length < 10) { textarea.setCustomValidity("Write at least 10 characters."); textarea.reportValidity(); return; }
      textarea.setCustomValidity(""); save.disabled = true; setStatus("Saving review…");
      try {
        const response = await request(`/reviews/${encodeURIComponent(review.reviewId)}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({body}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "The review could not be saved.");
        await refreshReviews();
      } catch (error) { setStatus(error.message, true); save.disabled = false; }
    });
  }

  function renderReviews(reviews) {
    const list = byId("epkReviewList"); list.replaceChildren();
    byId("epkReviewsCount").textContent = `${reviews.length} review${reviews.length === 1 ? "" : "s"}`;
    if (!reviews.length) { list.append(node("p", "No member reviews yet.", "epk-review-empty")); return; }
    reviews.forEach(review => {
      const card = node("article", "", "epk-review-card"), avatar = review.authorAvatar ? document.createElement("img") : node("span", initials(review.authorName), "epk-review-card__avatar"), main = node("div", "", "epk-review-card__main"), meta = node("div", "", "epk-review-card__meta"), body = node("p", review.body, "epk-review-card__body");
      if (avatar instanceof HTMLImageElement) { avatar.className = "epk-review-card__avatar"; avatar.src = review.authorAvatar; avatar.alt = ""; avatar.loading = "lazy"; }
      const author = node("strong", review.authorName || "DanzStak member"), target = node("span", `${review.targetType === "show" ? "Show" : "Release"}: ${review.targetTitle}`), time = node("time", reviewDate(review.createdAt)); time.dateTime = review.createdAt || ""; meta.append(author, target, time); main.append(meta, body);
      if (review.ownedByViewer) {
        const actions = node("div", "", "epk-review-card__actions"), edit = node("button", "Edit"), remove = node("button", "Remove from EPK"), erase = node("button", "Delete everywhere", "epk-review-delete");
        edit.type = remove.type = erase.type = "button"; edit.addEventListener("click", () => openEditor(card, review));
        remove.addEventListener("click", () => removeFromEpk(review).catch(error => setStatus(error.message, true)));
        erase.addEventListener("click", () => deleteEverywhere(review).catch(error => setStatus(error.message, true)));
        actions.append(edit, remove, erase); main.append(actions);
      }
      card.append(avatar, main); list.append(card);
    });
  }

  async function refreshReviews() {
    const response = await request(`/reviews?artist=${encodeURIComponent(currentPublicId)}&surface=epk`), data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Reviews could not be loaded.");
    renderReviews(Array.isArray(data.reviews) ? data.reviews : []); setStatus("");
  }

  function configureForm(targetData, signedIn) {
    const form = byId("epkReviewForm"), select = byId("epkReviewTarget"); currentTargets = Array.isArray(targetData.targets) ? targetData.targets : [];
    select.replaceChildren(); currentTargets.forEach(target => { const option = node("option", `${target.targetType === "show" ? "Show" : "Release"} — ${target.title}`); option.value = target.targetId; option.dataset.targetType = target.targetType; select.append(option); });
    form.hidden = !(signedIn && targetData.canReview === true && currentTargets.length);
  }

  async function load(publicId) {
    currentPublicId = String(publicId || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{3,64}$/.test(currentPublicId)) return;
    const section = byId("epkReviews"), form = byId("epkReviewForm"), list = byId("epkReviewList");
    section.hidden = true; form.hidden = true; list.replaceChildren(); setStatus("Loading reviews…");
    try {
      const [targetsResponse, reviewsResponse, sessionResponse] = await Promise.all([
        request(`/review-targets?artist=${encodeURIComponent(currentPublicId)}`),
        request(`/reviews?artist=${encodeURIComponent(currentPublicId)}&surface=epk`),
        request("/auth/session")
      ]);
      const [targetData, reviewData] = await Promise.all([targetsResponse.json().catch(() => ({})), reviewsResponse.json().catch(() => ({}))]);
      if (!reviewsResponse.ok) throw new Error(reviewData.error || "Reviews could not be loaded.");
      const reviews = Array.isArray(reviewData.reviews) ? reviewData.reviews : [];
      renderReviews(reviews);
      if (targetsResponse.ok) configureForm(targetData, sessionResponse.ok);
      else {
        form.hidden = true;
      }
      section.hidden = !reviews.length && form.hidden;
      setStatus(!sessionResponse.ok ? "Sign in to write a review. Published reviews remain readable without an account." : targetData.canReview === false ? "This is your EPK. Other members can review its published shows and releases." : "");
    } catch (error) {
      form.hidden = true; list.replaceChildren(); byId("epkReviewsCount").textContent = ""; setStatus(""); section.hidden = true;
      console.warn("Optional EPK reviews were not loaded.", error.message);
    }
  }

  byId("epkReviewForm")?.addEventListener("submit", async event => {
    event.preventDefault(); const submit = byId("epkReviewSubmit"), option = byId("epkReviewTarget").selectedOptions[0], body = byId("epkReviewBody").value.trim(), target = currentTargets.find(item => item.targetId === option?.value && item.targetType === option?.dataset.targetType);
    if (!target || body.length < 10) { byId("epkReviewBody").setCustomValidity("Write at least 10 characters."); byId("epkReviewBody").reportValidity(); return; }
    byId("epkReviewBody").setCustomValidity(""); submit.disabled = true; setStatus("Publishing review…");
    try {
      const response = await request("/reviews", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({artistPublicId:currentPublicId,targetType:target.targetType,targetId:target.targetId,body}) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The review could not be published.");
      byId("epkReviewBody").value = ""; await refreshReviews();
    } catch (error) { setStatus(error.message, true); }
    finally { submit.disabled = false; }
  });

  window.danzstakEpkReviews = { load };
})();
