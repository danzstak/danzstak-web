"use strict";
(() => {
  const api = "https://api.danzstak.com", byId = id => document.getElementById(id);
  if (!byId("researchArtist")) return;
  const status = byId("researchStatus"), results = byId("researchResults"), sourceList = byId("researchSources"), draftList = byId("researchDraft"), choices = byId("researchIdentityChoices");
  const state = { record:null, decisions:{}, musicbrainzId:"" };
  const sectionLabels = { shortBio:"Short biography", mediumBio:"Medium biography", fullBio:"Full biography", genres:"Genres", releases:"Discography", notableShows:"Previous performances", achievements:"Career highlights", pressCoverage:"Press and media", links:"Official music and social links" };
  const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  async function request(path, options = {}, timeoutMs = 30000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${api}${path}`, { credentials:"include", cache:"no-store", ...options, signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || data.message || "DanzStak could not complete this request."); error.data = data; error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Artist research took too long. Try again.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  function identity() {
    return {
      artistName: byId("artistName").value.trim(), stageName: byId("researchStageName").value.trim(), hometown: byId("hometown").value.trim(), country: byId("researchCountry").value.trim(), genre: byId("genres").value.trim(), musicbrainzId: state.musicbrainzId,
      links: Object.fromEntries([["website","researchWebsite"],["spotify","researchSpotify"],["discogs","researchDiscogs"],["bandcamp","researchBandcamp"],["soundcloud","researchSoundcloud"],["youtube","researchYoutube"],["label","researchLabel"]].map(([key,id]) => [key,byId(id).value.trim()]).filter(([,value]) => /^https:\/\//i.test(value)))
    };
  }
  function proposalText(value, section = "") {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value.text === "string") return value.text;
    if (Array.isArray(value)) return value.map(item => {
      if (typeof item === "string") return item;
      if (item.text) return item.text;
      if (section === "pressCoverage") return [item.title,item.publication,item.url,item.date].filter(Boolean).join(" | ");
      if (section === "links") return [item.title || item.label,item.url].filter(Boolean).join(" | ");
      if (section === "releases") return [item.title,item.type,item.date,item.label].filter(Boolean).join(" — ");
      return [item.title,item.date,item.publication,item.url].filter(Boolean).join(" | ");
    }).filter(Boolean).join("\n");
    return "";
  }
  function sourceIds(value) {
    const ids = new Set();
    if (value?.sourceIds) value.sourceIds.forEach(id => ids.add(id));
    if (Array.isArray(value)) value.forEach(item => (item?.sourceIds || []).forEach(id => ids.add(id)));
    return [...ids];
  }
  async function decide(section, decision, value) {
    if (!state.record) return;
    try {
      await request("/epk/research/approval", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({researchId:state.record.researchId,section,decision,value}) });
      state.decisions[section] = decision; state.record.approvals ||= {}; state.record.approvals[section] = { decision, value }; renderDraft(); status.textContent = `${sectionLabels[section]} marked ${decision}. Your public EPK has not changed.`;
    } catch (error) { status.textContent = error.message; }
  }
  async function rewrite(section, button) {
    button.disabled = true; status.textContent = `Rewriting ${sectionLabels[section]} from the same reviewed sources…`;
    try {
      const data = await request("/epk/research/rewrite", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({researchId:state.record.researchId,section,style:byId("researchStyle").value}) }, 45000);
      state.record.draft[section] = data.proposal; state.decisions[section] = "pending"; renderDraft(); status.textContent = `${sectionLabels[section]} rewritten. Review it before approval.`;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }
  function renderSources() {
    sourceList.replaceChildren();
    if (!state.record?.sources?.length) { sourceList.append(text("p", "No public sources were returned. Add an official profile link and research again.", "hint")); return; }
    state.record.sources.forEach(item => {
      const card = document.createElement("article"), link = text("a", item.title || item.url), meta = text("small", `${item.id} · ${item.provider} · researched ${new Date(item.researchedAt).toLocaleDateString()}`);
      card.className = "research-source"; link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; card.append(text("h4", item.title || "Source"), meta);
      if (item.description) card.append(text("p", item.description, "source-description")); card.append(link); sourceList.append(card);
    });
  }
  function renderDraft() {
    draftList.replaceChildren();
    if (!state.record?.draft) { draftList.append(text("p", state.record?.aiStatus?.error || "AI drafting is unavailable. You can still review the sources and edit your EPK manually.", "hint")); return; }
    for (const [section,label] of Object.entries(sectionLabels)) {
      const proposal = state.record.draft[section], card = document.createElement("article"), editor = document.createElement("textarea"), actions = document.createElement("div");
      card.className = `research-proposal ${state.decisions[section] === "approved" || state.decisions[section] === "edited" ? "is-approved" : state.decisions[section] === "rejected" ? "is-rejected" : ""}`; editor.value = typeof state.record.approvals?.[section]?.value === "string" ? state.record.approvals[section].value : proposalText(proposal, section); editor.maxLength = section === "fullBio" ? 7000 : 5000; editor.setAttribute("aria-label", label); actions.className = "research-proposal-actions";
      const approve = text("button", "Approve"), edit = text("button", "Edit"), redo = text("button", "Rewrite"), reject = text("button", "Reject"); [approve,edit,redo,reject].forEach(button => button.type = "button");
      approve.addEventListener("click", () => decide(section, editor.value === proposalText(proposal, section) ? "approved" : "edited", editor.value)); edit.addEventListener("click", () => { editor.focus(); editor.setSelectionRange(editor.value.length,editor.value.length); }); redo.addEventListener("click", () => rewrite(section, redo)); reject.addEventListener("click", () => decide(section, "rejected", editor.value));
      actions.append(approve,edit,redo,reject); card.append(text("h4", label), editor);
      const ids = sourceIds(proposal); if (ids.length) card.append(text("p", `Sources: ${ids.join(", ")}`, "proposal-sources")); card.append(actions); draftList.append(card);
    }
  }
  function renderRecord(record) {
    state.record = record; state.decisions = Object.fromEntries(Object.entries(record.approvals || {}).map(([key,value]) => [key,value.decision])); choices.hidden = true; results.hidden = false; renderSources(); renderDraft();
    const providerMessage = (record.providerStatus || []).map(item => `${item.name}: ${item.ok ? "available" : item.skipped ? "not configured" : "unavailable"}`).join(" · ");
    status.textContent = `${record.cached ? "Cached research loaded." : "Research saved."} ${record.sources?.length || 0} sources. ${record.aiStatus?.ok ? "AI draft ready for review." : record.aiStatus?.error || "AI draft unavailable."}${providerMessage ? ` ${providerMessage}` : ""}`;
  }
  function renderChoices(data) {
    choices.replaceChildren(text("p", data.message || "Choose the correct music artist.")); choices.hidden = false;
    (data.candidates || []).forEach(candidate => { const row = document.createElement("article"), detail = text("p", candidate.name), button = text("button", "This is my artist"); row.className = "research-choice"; detail.append(text("small", [candidate.area,candidate.country,candidate.disambiguation,candidate.begin].filter(Boolean).join(" · "))); button.type = "button"; button.addEventListener("click", () => { state.musicbrainzId = candidate.id; runResearch(false); }); row.append(detail,button); choices.append(row); });
  }
  async function runResearch(refresh) {
    const artistName = byId("artistName").value.trim(); if (!artistName) { status.textContent = "Enter the artist or band name first."; byId("artistName").focus(); return; }
    for (const button of [byId("researchArtist"),byId("researchAgain"),byId("refreshEpk")]) button.disabled = true;
    status.textContent = refresh ? "Checking for new documented music-career information…" : "Researching public music sources…";
    try { renderRecord(await request("/epk/research", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({identity:identity(),style:byId("researchStyle").value,refresh}) }, 55000)); await loadHistory(); }
    catch (error) { if (error.data?.needsClarification) renderChoices(error.data); status.textContent = error.message; }
    finally { for (const button of [byId("researchArtist"),byId("researchAgain"),byId("refreshEpk")]) button.disabled = false; }
  }
  function approvedValue(section) {
    const card = [...draftList.querySelectorAll(".research-proposal")][Object.keys(sectionLabels).indexOf(section)];
    return card?.querySelector("textarea")?.value.trim() || "";
  }
  async function saveApproved() {
    if (!state.record) return;
    const mapping = { shortBio:"shortBio", mediumBio:"mediumBio", fullBio:"bio", genres:"genres", releases:"releases", notableShows:"notableShows", achievements:"achievements", pressCoverage:"pressCoverage", links:"musicLinks" };
    let count = 0;
    for (const [section,field] of Object.entries(mapping)) {
      if (!["approved","edited"].includes(state.decisions[section])) continue;
      byId(field).value = approvedValue(section); byId(field).dispatchEvent(new Event("input", { bubbles:true })); count += 1;
    }
    if (!count) { status.textContent = "Approve at least one section before saving."; return; }
    status.textContent = `${count} approved section${count === 1 ? "" : "s"} copied into the private EPK draft. Saving…`;
    byId("saveDraft").click();
  }
  async function loadHistory() {
    const holder = byId("researchHistory");
    try {
      const [research,versions] = await Promise.all([request("/epk/research"),request("/epk/versions")]); holder.replaceChildren();
      const entries = [...(research.history || []).slice(0,8).map(item => ({ title:`Research — ${item.artistName}`, date:item.updatedAt || item.createdAt, note:`${item.sourceCount} sources · ${item.hasDraft ? "draft created" : "sources only"}` })), ...(versions.versions || []).slice(0,8).map(item => ({ title:`EPK version — ${item.artistName}`, date:item.createdAt, note:item.published ? "published snapshot" : "private snapshot" }))].sort((a,b) => Date.parse(b.date) - Date.parse(a.date)).slice(0,12);
      if (!entries.length) holder.append(text("p", "No research or saved EPK versions yet.", "hint"));
      entries.forEach(item => { const row = document.createElement("article"); row.className = "research-history-item"; row.append(text("strong", item.title),text("small", `${new Date(item.date).toLocaleString()} · ${item.note}`)); holder.append(row); });
    } catch (error) { holder.replaceChildren(text("p", error.message, "hint")); }
  }
  byId("researchArtist").addEventListener("click", () => runResearch(false)); byId("researchAgain").addEventListener("click", () => runResearch(true)); byId("refreshEpk").addEventListener("click", () => runResearch(true)); byId("saveApprovedEpk").addEventListener("click", saveApproved);
  loadHistory();
})();
