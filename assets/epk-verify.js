// Task 20 (owner 2026-11-17): verify the artist before the EPK goes public or pitches.
// Builder: a "Verify your act" step above Publish. Publish stays disabled with a one-line reason until the act is
// verified (the server enforces the same rule). Public EPK: the "Verified artist on DanzStak" mark and "Report
// impersonation". Editors (directory editors) also get the review queue. No passwords, platform APIs or ID documents.
(() => {
  "use strict";
  const api = "https://api.danzstak.com", byId = id => document.getElementById(id);
  const METHOD_LABELS = { page: "public page", meta: "own website", dns: "domain DNS", manual: "editor review" };
  const REVIEW_REASONS = { protected_name: "This is a protected name, so a DanzStak editor confirms it.", manual: "A DanzStak editor is checking the link you sent.", reported: "Members reported this EPK. A DanzStak editor will review it.", editor_flag: "A DanzStak editor flagged this EPK for review." };
  const formatDate = iso => { try { return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: "medium" }).format(new Date(iso)); } catch { return String(iso || "").slice(0, 10); } };
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith("aria")) node.setAttribute(`aria-${key.slice(4).toLowerCase()}`, value); // ariaLabelledby -> aria-labelledby
      else node[key] = value;
    }
    for (const child of children) if (child != null) node.append(child);
    return node;
  };

  async function call(path, { method = "GET", body } = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${api}${path}`, { method, credentials: "include", cache: "no-store", signal: controller.signal, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch { return { ok: false, status: 0, data: { error: "DanzStak could not be reached. Check your connection and try again." } }; }
    finally { clearTimeout(timer); }
  }

  async function copy(text, button) {
    try { await navigator.clipboard.writeText(text); window.danzstakShowFeedback?.("Copied."); if (button) { button.textContent = "Copied"; setTimeout(() => { button.textContent = "Copy"; }, 1600); } }
    catch { window.danzstakShowFeedback?.("Copy was blocked. Select the text instead.", { urgent: true }); }
  }

  const query = new URLSearchParams(location.search);
  const publicMode = Boolean(query.get("id") || query.get("share") || query.get("outreach"));

  // ---------- Public EPK: verified mark + report impersonation ----------
  function showPublic(data) {
    const preview = byId("epkPreview"), hero = preview?.querySelector(".epk-hero");
    if (data?.verified?.at && hero && !hero.querySelector(".epk-verified-mark")) {
      const mark = el("p", { className: "epk-verified-mark", title: `Verified ${formatDate(data.verified.at)}${METHOD_LABELS[data.verified.method] ? ` by ${METHOD_LABELS[data.verified.method]}` : ""}. This member showed control of the act's public page; it is not a legal guarantee of identity.` }, el("span", { className: "epk-verified-mark__tick", ariaHidden: "true" }, "✓"), " Verified artist on DanzStak");
      const name = hero.querySelector("h1");
      if (name) name.after(mark); else hero.append(mark);
    }
    const publicId = query.get("id");
    if (!publicId || byId("epkReportImpersonation")) return;
    const status = el("p", { id: "epkReportStatus", className: "epk-report__status", role: "status" });
    const button = el("button", { type: "button", id: "epkReportImpersonation", className: "epk-report__button" }, "Report impersonation");
    button.addEventListener("click", async () => {
      const confirmed = window.danzstakConfirm ? await window.danzstakConfirm("Report this EPK as someone pretending to be this act? A DanzStak editor reviews every report. Two reports take the EPK offline until then.", { title: "Report impersonation?", confirmLabel: "Report", cancelLabel: "Cancel", danger: true }) : window.confirm("Report this EPK as impersonating the act?");
      if (!confirmed) return;
      button.disabled = true; status.textContent = "Sending report...";
      const result = await call("/epk/verify/report", { method: "POST", body: { publicId } });
      if (result.status === 401) {
        status.textContent = "Sign in to DanzStak to report impersonation. ";
        status.append(el("a", { href: `${api}/auth/login?next=${encodeURIComponent(location.pathname + location.search)}` }, "Sign in"));
      } else status.textContent = result.data.message || result.data.error || (result.ok ? "Thanks. A DanzStak editor will look at this EPK." : "The report could not be sent.");
      button.disabled = result.ok && !result.data.duplicate ? true : false;
    });
    const wrap = el("aside", { className: "epk-report", ariaLabel: "Report this EPK" }, button, status);
    const layout = document.querySelector(".epk-layout");
    if (layout) layout.after(wrap); else document.querySelector("main")?.append(wrap);
  }

  if (publicMode) {
    window.addEventListener("danzstak:epk-loaded", event => showPublic(event.detail || {}));
    return;
  }

  // ---------- Builder: "Verify your act" ----------
  const form = byId("epkForm"), actions = form?.querySelector(".form-actions"), publish = byId("publishEpk"), nameInput = byId("artistName");
  if (!form || !actions || !publish || !nameInput) return;
  let state = { verification: null, hold: false, editor: false }, current = "", busy = false, nameTimer = 0;

  const chip = el("span", { className: "epk-verify__chip", id: "epkVerifyChip" });
  const summary = el("p", { className: "epk-verify__summary", id: "epkVerifySummary" });
  const codeRow = el("div", { className: "epk-verify__code", hidden: true });
  const codeValue = el("code", { id: "epkVerifyCode" }), codeCopy = el("button", { type: "button", className: "epk-verify__copy" }, "Copy"), codeNote = el("span", { className: "epk-verify__expires" });
  codeRow.append(el("span", { className: "epk-verify__label" }, "Your code"), codeValue, codeCopy, codeNote);
  const getCode = el("button", { type: "button", className: "primary", id: "epkVerifyGetCode" }, "Get my code");
  const message = el("p", { className: "epk-verify__message", id: "epkVerifyMessage", role: "status", ariaLive: "polite" });
  const reason = el("p", { className: "epk-verify__reason", id: "epkPublishReason" });

  const ways = el("fieldset", { className: "epk-verify__ways" }, el("legend", {}, "How do you want to verify?"));
  const panels = {};
  const way = (value, label, panel) => {
    const input = el("input", { type: "radio", name: "epkVerifyWay", value });
    ways.append(el("label", { className: "epk-verify__way" }, input, el("span", {}, label)));
    panels[value] = panel; panel.hidden = true; panel.className = "epk-verify__panel"; panel.dataset.way = value;
    input.addEventListener("change", () => { for (const [key, node] of Object.entries(panels)) node.hidden = key !== value; });
    return input;
  };

  // 1. Code in a public profile the act controls.
  const pageUrl = el("input", { type: "url", inputMode: "url", placeholder: "https://yourband.bandcamp.com", maxLength: 600, autocomplete: "off" });
  const pageCheck = el("button", { type: "button", className: "primary" }, "Check page");
  const pagePanel = el("div", {},
    el("p", {}, "Paste your code into the bio or description of one public page that is clearly the act's: Bandcamp, SoundCloud, Mixcloud, Resident Advisor, Instagram, YouTube or your own website. Save it, then paste the page link here."),
    el("label", {}, "Link to that page", pageUrl), pageCheck,
    el("p", { className: "hint" }, "DanzStak opens that public page once, with no login. You can remove the code afterwards."));
  // 2. Own website: meta tag or DNS TXT.
  const metaSnippet = el("code", { className: "epk-verify__snippet" }), metaCopy = el("button", { type: "button", className: "epk-verify__copy" }, "Copy");
  const siteUrl = el("input", { type: "url", inputMode: "url", placeholder: "https://theband.com", maxLength: 600, autocomplete: "off" });
  const siteCheck = el("button", { type: "button", className: "primary" }, "Check website");
  const txtSnippet = el("code", { className: "epk-verify__snippet" }), txtCopy = el("button", { type: "button", className: "epk-verify__copy" }, "Copy");
  const domain = el("input", { type: "text", inputMode: "url", placeholder: "theband.com", maxLength: 253, autocomplete: "off", spellcheck: false });
  const dnsCheck = el("button", { type: "button" }, "Check DNS");
  const sitePanel = el("div", {},
    el("p", {}, "Add this tag inside the <head> of your homepage:"), el("div", { className: "epk-verify__snippet-row" }, metaSnippet, metaCopy),
    el("label", {}, "Your website", siteUrl), siteCheck,
    el("p", { className: "epk-verify__or" }, "Or add a DNS TXT record on the act's domain:"), el("div", { className: "epk-verify__snippet-row" }, txtSnippet, txtCopy),
    el("label", {}, "Domain", domain), dnsCheck);
  // 3. Manual review (acts with almost no web presence). Never ID documents or selfies.
  const evidence = el("input", { type: "url", inputMode: "url", placeholder: "https://venue.com/shows/your-gig", maxLength: 600, autocomplete: "off" });
  const evidenceNote = el("textarea", { rows: 2, maxLength: 500, placeholder: "Anything that helps, like who booked the show" });
  const askEditor = el("button", { type: "button", className: "primary" }, "Ask an editor");
  const manualPanel = el("div", {},
    el("p", {}, "No public page yet? Send a link to a gig listing, label page or press mention that names the act. A DanzStak editor checks it. We never ask for ID or selfies."),
    el("label", {}, "Link that names the act", evidence), el("label", {}, "Note (optional)", evidenceNote), askEditor);

  way("page", "Code on a public page", pagePanel).checked = true;
  pagePanel.hidden = false;
  way("site", "Own website", sitePanel);
  way("manual", "Editor review", manualPanel);

  const steps = el("div", { className: "epk-verify__steps" }, getCode, codeRow, ways, pagePanel, sitePanel, manualPanel);
  const note = el("p", { className: "epk-verify__note" }, "Verified means you showed control of the act's public page. It is not a legal guarantee of identity, and DanzStak never asks for passwords to other platforms.");
  const section = el("section", { id: "epkVerify", className: "epk-verify", ariaLabelledby: "epkVerifyTitle" },
    el("div", { className: "epk-verify__head" }, el("h2", { id: "epkVerifyTitle" }, "Verify your act"), chip),
    summary, steps, message, note);
  actions.before(section);
  actions.after(reason);
  publish.setAttribute("aria-describedby", "epkPublishReason");

  function setPublish() {
    const v = state.verification, verified = v?.status === "verified" && !state.hold;
    publish.disabled = !verified;
    reason.hidden = verified;
    reason.textContent = !current ? "Name your act, then verify it to publish. Private drafts always save."
      : state.hold ? "This EPK is on hold after an impersonation report. Drafts still save."
      : v?.status === "needs_review" ? "Publishing opens once a DanzStak editor approves this act. Drafts still save."
      : "Verify your act to publish or pitch. Private drafts always save.";
  }

  function render() {
    const v = state.verification || { status: "not_verified" }, code = v.code || "";
    section.dataset.status = state.hold ? "hold" : v.status;
    if (!current) {
      chip.textContent = "Not verified"; summary.textContent = "Name your act first, then verify it here."; steps.hidden = true; setPublish(); return;
    }
    if (state.hold) {
      chip.textContent = "On hold"; summary.textContent = "This EPK is on hold after an impersonation report. A DanzStak editor will review it, and you can send them a link below.";
      steps.hidden = false; for (const input of ways.querySelectorAll("input")) if (input.value === "manual") { input.checked = true; input.dispatchEvent(new Event("change")); }
    } else if (v.status === "verified") {
      chip.textContent = `Verified · ${formatDate(v.verifiedAt)}`;
      summary.textContent = `${v.actName || current} is verified by ${METHOD_LABELS[v.method] || "DanzStak"} until ${formatDate(v.expiresAt)}. Renaming the act re-opens verification.`;
      steps.hidden = true;
    } else if (v.status === "needs_review") {
      chip.textContent = "Needs review"; summary.textContent = REVIEW_REASONS[v.reviewReason] || REVIEW_REASONS.manual; steps.hidden = true;
    } else {
      chip.textContent = "Not verified";
      summary.textContent = v.note ? `An editor could not confirm this act: ${v.note}` : v.lastCheckResult === "expired" ? "Your verification is a year old. Check again to keep publishing." : "Show that you control one public page of your act. It takes a minute.";
      steps.hidden = false;
    }
    getCode.hidden = Boolean(code);
    codeRow.hidden = !code;
    codeValue.textContent = code;
    codeNote.textContent = code && v.codeExpiresAt ? `Good until ${new Date(v.codeExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
    metaSnippet.textContent = `<meta name="danzstak-verify" content="${code || "DZ-······"}">`;
    txtSnippet.textContent = `danzstak-verify=${code || "DZ-······"}`;
    for (const button of [pageCheck, siteCheck, dnsCheck]) button.disabled = busy || !code;
    for (const button of [metaCopy, txtCopy]) button.disabled = !code;
    askEditor.disabled = busy;
    getCode.disabled = busy;
    if (v.protectedName && v.status === "not_verified" && !state.hold) summary.textContent += " This name is protected, so an editor also confirms it after your check.";
    setPublish();
  }

  async function refresh() {
    current = nameInput.value.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!current) { state = { ...state, verification: null }; render(); return; }
    const asked = current, result = await call(`/epk/verify?act=${encodeURIComponent(asked)}`);
    if (asked !== current) return; // the name changed while loading
    if (result.ok) { state = { verification: result.data.verification, hold: result.data.hold === true, editor: result.data.editor === true }; if (state.editor) loadEditorQueue(); }
    else { state = { ...state, verification: null }; if (result.status !== 401) message.textContent = result.data.error || "Verification status could not be loaded."; }
    render();
  }

  async function act(button, path, body, working) {
    if (busy) return;
    busy = true; render(); section.dataset.status = "checking"; chip.textContent = "Checking…"; message.textContent = working;
    const result = await call(path, { method: "POST", body: { actName: current, ...body } });
    busy = false;
    if (result.data.verification) state.verification = result.data.verification;
    message.textContent = result.data.message || result.data.error || (result.ok ? "" : "That did not work. Try again.");
    render();
    if (state.verification?.status === "verified") window.danzstakShowFeedback?.(`${current} is verified. You can publish now.`);
    button?.focus?.();
  }

  getCode.addEventListener("click", () => act(getCode, "/epk/verify/code", {}, "Making your code..."));
  codeCopy.addEventListener("click", () => copy(codeValue.textContent, codeCopy));
  metaCopy.addEventListener("click", () => copy(metaSnippet.textContent, metaCopy));
  txtCopy.addEventListener("click", () => copy(txtSnippet.textContent, txtCopy));
  pageCheck.addEventListener("click", () => { if (!pageUrl.reportValidity()) return; act(pageCheck, "/epk/verify/check", { method: "page", url: pageUrl.value.trim() }, "Checking that page..."); });
  siteCheck.addEventListener("click", () => { if (!siteUrl.reportValidity()) return; act(siteCheck, "/epk/verify/check", { method: "page", url: siteUrl.value.trim() }, "Checking your website..."); });
  dnsCheck.addEventListener("click", () => { if (!domain.value.trim()) { domain.focus(); return; } act(dnsCheck, "/epk/verify/check", { method: "dns", domain: domain.value.trim() }, "Checking DNS..."); });
  askEditor.addEventListener("click", () => { if (!evidence.value.trim() || !evidence.reportValidity()) { evidence.focus(); return; } act(askEditor, "/epk/verify/review", { evidenceUrl: evidence.value.trim(), note: evidenceNote.value.trim() }, "Sending to an editor..."); });
  nameInput.addEventListener("input", () => { clearTimeout(nameTimer); nameTimer = setTimeout(refresh, 600); });
  // The server answers 403 with the reason if a publish slips through (for example an old tab); refresh the step then.
  publish.addEventListener("click", () => setTimeout(refresh, 1500));

  // ---------- Editors: artist review queue ----------
  let editorSection = null;
  async function loadEditorQueue() {
    const result = await call("/epk/verify/reviews");
    if (!result.ok) return;
    if (!editorSection) {
      editorSection = el("section", { id: "epkVerifyEditor", className: "epk-verify-editor", ariaLabelledby: "epkVerifyEditorTitle" });
      (form.closest(".epk-layout") || form).after(editorSection);
    }
    const list = el("ul", { className: "epk-verify-editor__list" });
    for (const item of result.data.reviews || []) {
      const links = el("p", { className: "epk-verify-editor__links" });
      for (const [label, href] of [["Checked page", item.checkedUrl?.startsWith("https://") ? item.checkedUrl : ""], ["Evidence", item.evidenceUrl], ["Public EPK", item.publicId ? `epk.html?id=${encodeURIComponent(item.publicId)}` : ""]]) {
        if (href) links.append(el("a", { href, target: "_blank", rel: "noopener noreferrer" }, label), " ");
      }
      const approve = el("button", { type: "button", className: "primary" }, "Approve"), reject = el("button", { type: "button" }, "Reject"), status = el("span", { role: "status" });
      const decide = async decision => {
        let editorNote = "";
        if (decision === "reject") { editorNote = window.prompt("Short note for the artist (optional)", "") ?? null; if (editorNote === null) return; }
        approve.disabled = reject.disabled = true;
        const outcome = await call("/epk/verify/reviews", { method: "POST", body: { id: item.id, decision, note: editorNote } });
        status.textContent = outcome.ok ? (decision === "approve" ? "Approved." : "Rejected.") : outcome.data.error || "Could not save.";
        if (!outcome.ok) approve.disabled = reject.disabled = false;
      };
      approve.addEventListener("click", () => decide("approve")); reject.addEventListener("click", () => decide("reject"));
      list.append(el("li", {},
        el("strong", {}, item.actName || "Unnamed act"), el("span", { className: "epk-verify-editor__reason" }, ` · ${REVIEW_REASONS[item.reason] ? item.reason.replace(/_/g, " ") : "review"}${item.autoCheckPassed ? " · code found" : ""} · ${formatDate(item.requestedAt)}`),
        item.note ? el("p", {}, item.note) : null, links, el("div", { className: "epk-verify-editor__actions" }, approve, reject, status)));
    }
    editorSection.replaceChildren(el("h2", { id: "epkVerifyEditorTitle" }, `Artist reviews (${(result.data.reviews || []).length})`),
      el("p", { className: "hint" }, "Approve only when the link clearly shows this member is the act. Famous names need strong proof. Never ask for ID documents."),
      list.childElementCount ? list : el("p", {}, "Nothing to review."));
  }

  // epk.js fills the saved act name after it loads the draft (and updates #epkStatus); follow it.
  const epkStatus = byId("epkStatus");
  if (epkStatus && "MutationObserver" in window) new MutationObserver(() => { if (nameInput.value.replace(/\s+/g, " ").trim().slice(0, 120) !== current) refresh(); }).observe(epkStatus, { childList: true, characterData: true, subtree: true });
  render();
  refresh();
})();
