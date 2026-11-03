"use strict";
(() => {
  const api = "https://api.danzstak.com";
  const byId = id => document.getElementById(id), form = byId("epkForm"), preview = byId("epkPreview"), status = byId("epkStatus");
  const fields = ["artistName","hometown","genres","shortPitch","shortBio","bio","lineup","releases","notableShows","achievements","musicLinks","videoLinks","socialLinks","heroImage","logoImage","pressQuotes","stageRequirements","techRequirements","hospitalityRequirements","bookingName","bookingEmail","bookingPhone","website"];
  let epkMedia = [];
  const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal:controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error("DanzStak took too long to respond. Try again.");
      throw new Error("DanzStak cannot connect right now. Check your connection and try again.");
    } finally { clearTimeout(timer); }
  }
  const lines = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const linkLines = value => lines(value).map(item => { const [label, ...rest] = item.split("|"); const url = rest.join("|").trim(); return { label: label.trim(), url }; }).filter(item => item.label && /^https:\/\//i.test(item.url));
  const quoteLines = value => lines(value).map(item => { const [quote, source, ...rest] = item.split("|"); return { quote: quote?.trim(), source: source?.trim(), url: rest.join("|").trim() }; }).filter(item => item.quote && item.source);
  const kitFromForm = (includeLocalPreviews = false) => ({
    artistName: byId("artistName").value.trim(), hometown: byId("hometown").value.trim(), genres: byId("genres").value.split(",").map(item => item.trim()).filter(Boolean), shortPitch: byId("shortPitch").value.trim(), shortBio: byId("shortBio").value.trim(), bio: byId("bio").value.trim(),
    lineup: lines(byId("lineup").value), releases: lines(byId("releases").value), notableShows: lines(byId("notableShows").value), achievements: lines(byId("achievements").value), musicLinks: linkLines(byId("musicLinks").value), videoLinks: linkLines(byId("videoLinks").value), socialLinks: linkLines(byId("socialLinks").value), heroImage: byId("heroImage").value.trim(), logoImage: byId("logoImage").value.trim(), media: epkMedia.map(({url,previewUrl,...item}) => includeLocalPreviews ? {...item,url,previewUrl} : item), pressQuotes: quoteLines(byId("pressQuotes").value), stageRequirements: byId("stageRequirements").value.trim(), techRequirements: byId("techRequirements").value.trim(), hospitalityRequirements: byId("hospitalityRequirements").value.trim(), bookingName: byId("bookingName").value.trim(), bookingEmail: byId("bookingEmail").value.trim(), bookingPhone: byId("bookingPhone").value.trim(), website: byId("website").value.trim(), publicDetails: { bookingEmail:byId("publicBookingEmail").checked, bookingPhone:byId("publicBookingPhone").checked, technical:byId("publicTechnical").checked, hospitality:byId("publicHospitality").checked }
  });
  function section(title, content) { if (!content) return; const wrap = document.createElement("section"); wrap.append(text("h2", title), content); preview.querySelector(".epk-body").append(wrap); }
  function list(items) { if (!items?.length) return null; const ul = document.createElement("ul"); items.forEach(item => ul.append(text("li", item))); return ul; }
  function links(items) { if (!items?.length) return null; const wrap = document.createElement("div"); wrap.className = "link-list"; items.forEach(item => { if (!/^https:\/\//i.test(item.url || "")) return; const a = text("a", item.label); a.href = item.url; a.target = "_blank"; a.rel = "noopener noreferrer"; wrap.append(a); }); return wrap; }
  function providerEmbed(item) {
    let source = "";
    try {
      const url = new URL(item.url), host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtube.com" || host === "m.youtube.com") { const id = url.searchParams.get("v") || (url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : ""); if (/^[\w-]{6,20}$/.test(id || "")) source = `https://www.youtube-nocookie.com/embed/${id}`; }
      else if (host === "youtu.be") { const id = url.pathname.split("/").filter(Boolean)[0]; if (/^[\w-]{6,20}$/.test(id || "")) source = `https://www.youtube-nocookie.com/embed/${id}`; }
      else if (host === "vimeo.com") { const id = url.pathname.split("/").filter(Boolean).find(part => /^\d+$/.test(part)); if (id) source = `https://player.vimeo.com/video/${id}`; }
      else if (host === "open.spotify.com" && /^\/(track|album|playlist|episode|show)\/[A-Za-z0-9]+/.test(url.pathname)) source = `https://open.spotify.com/embed${url.pathname}`;
    } catch {}
    if (!source) return null;
    const frame = document.createElement("iframe");
    frame.src = source; frame.title = item.label; frame.loading = "lazy"; frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture"; frame.referrerPolicy = "strict-origin-when-cross-origin"; frame.allowFullscreen = true;
    return frame;
  }
  function providerName(value) {
    try {
      const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
      if (["youtube.com","m.youtube.com","youtu.be"].includes(host)) return "YouTube";
      if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "Vimeo";
      if (host === "open.spotify.com") return "Spotify";
      if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) return "SoundCloud";
      if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "Bandcamp";
      if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
      if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
      if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return "Facebook";
    } catch {}
    return "External media";
  }
  function mediaLinks(items) { if (!items?.length) return null; const wrap = document.createElement("div"); wrap.className = "epk-embeds"; items.forEach(item => { if (!/^https:\/\//i.test(item.url || "")) return; const card = document.createElement("div"), embed = providerEmbed(item), provider = providerName(item.url), a = text("a", embed ? `Open ${item.label} on ${provider}` : `Preview ${item.label} on ${provider}`); a.href = item.url; a.target = "_blank"; a.rel = "noopener noreferrer"; card.append(text("p", provider, "epk-provider"), text("h3", item.label)); if (embed) card.append(embed); card.append(a); wrap.append(card); }); return wrap; }
  function render(kit = {}) {
    preview.replaceChildren(); const hero = document.createElement("div"), body = document.createElement("div"); hero.className = "epk-hero"; body.className = "epk-body";
    const publicDetails = kit.publicDetails && typeof kit.publicDetails === "object" ? kit.publicDetails : { bookingEmail:true, bookingPhone:true, technical:true, hospitality:true };
    const imageSource = value => /^(?:https:\/\/|blob:)/i.test(value || "") ? value : "";
    const featuredMedia = (kit.media || []).find(item => item.featured && item.contentType?.startsWith("image/") && imageSource(item.url || item.previewUrl));
    const pressMedia = (kit.media || []).find(item => ["press-photo","artwork"].includes(item.role) && item.contentType?.startsWith("image/") && imageSource(item.url || item.previewUrl));
    const heroSource = imageSource(kit.heroImage) || imageSource(featuredMedia?.url || featuredMedia?.previewUrl) || imageSource(pressMedia?.url || pressMedia?.previewUrl);
    if (heroSource) { hero.classList.add("has-image"); hero.style.backgroundImage = `url("${heroSource.replace(/["\\]/g, "")}")`; }
    const logoMedia = (kit.media || []).find(item => item.role === "logo" && item.contentType?.startsWith("image/") && imageSource(item.url || item.previewUrl));
    const logoSource = imageSource(kit.logoImage) || imageSource(logoMedia?.url || logoMedia?.previewUrl);
    if (logoSource) { const logo = document.createElement("img"); logo.className = "epk-logo"; logo.src = logoSource; logo.alt = `${kit.artistName || "Artist"} logo`; hero.append(logo); }
    hero.append(text("h1", kit.artistName || "Your act"), text("p", [kit.hometown, ...(kit.genres || [])].filter(Boolean).join(" | ")));
    preview.append(hero, body); if (kit.shortPitch) body.append(text("p", kit.shortPitch, "lead"));
    section("About", kit.shortBio || kit.bio ? text("p", kit.shortBio || kit.bio) : null); if (kit.shortBio && kit.bio) section("Full biography", text("p", kit.bio)); section("Lineup", list(kit.lineup)); section("Releases", list(kit.releases)); section("Listen", mediaLinks(kit.musicLinks)); section("Watch", mediaLinks(kit.videoLinks)); section("Follow", links(kit.socialLinks)); section("Notable shows", list(kit.notableShows)); section("Achievements", list(kit.achievements));
    if (kit.pressQuotes?.length) { const wrap = document.createElement("div"); kit.pressQuotes.forEach(item => { const q = text("blockquote", `“${item.quote}” — ${item.source}`, "quote"); if (/^https:\/\//i.test(item.url || "")) { const a = text("a", "Source"); a.href = item.url; a.target = "_blank"; a.rel = "noopener noreferrer"; q.append(document.createElement("br"), a); } wrap.append(q); }); section("Press", wrap); }
    const publicMedia = (kit.media || []).filter(item => item.url); if (publicMedia.length) { const wrap = document.createElement("div"); wrap.className = "epk-downloads"; publicMedia.forEach(item => { if (item.contentType?.startsWith("image/")) { const image = document.createElement("img"); image.src = item.url; image.alt = item.name; image.loading = "lazy"; wrap.append(image); } const link = text("a", `${item.name} — download`); link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; wrap.append(link); }); section("Press materials", wrap); }
    section("Stage", kit.stageRequirements ? text("p", kit.stageRequirements) : null); section("Technical", publicDetails.technical && kit.techRequirements ? text("p", kit.techRequirements) : null); section("Hospitality", publicDetails.hospitality && kit.hospitalityRequirements ? text("p", kit.hospitalityRequirements) : null);
    const publicEmail = publicDetails.bookingEmail ? kit.bookingEmail : "", publicPhone = publicDetails.bookingPhone ? kit.bookingPhone : "", contactBits = [kit.bookingName, publicEmail, publicPhone].filter(Boolean); if (contactBits.length || kit.website) { const wrap = document.createElement("div"); wrap.className = "epk-contact"; if (kit.bookingName) wrap.append(text("p", kit.bookingName)); if (publicEmail) { const a = text("a", `Email ${kit.bookingName || "booking contact"}`); a.href = `mailto:${publicEmail}`; wrap.append(a); } if (publicPhone) { const phone = text("a", publicPhone); if (/^\+?[0-9 ()-]{7,24}$/.test(publicPhone)) phone.href = `tel:${publicPhone.replace(/[^+\d]/g, "")}`; wrap.append(phone); } if (/^https:\/\//i.test(kit.website || "")) { const a = text("a", "Official website"); a.href = kit.website; a.target = "_blank"; a.rel = "noopener noreferrer"; wrap.append(a); } section("Booking", wrap); }
  }
  const releasePreview = item => { if (/^blob:/i.test(item?.previewUrl || "")) URL.revokeObjectURL(item.previewUrl); };
  function fill(kit = {}) { epkMedia.forEach(releasePreview); fields.forEach(id => { if (["genres","lineup","releases","notableShows","achievements","musicLinks","videoLinks","socialLinks","pressQuotes"].includes(id)) return; byId(id).value = kit[id] || ""; }); byId("genres").value = (kit.genres || []).join(", "); for (const id of ["lineup","releases","notableShows","achievements"]) byId(id).value = (kit[id] || []).join("\n"); for (const id of ["musicLinks","videoLinks","socialLinks"]) byId(id).value = (kit[id] || []).map(item => `${item.label} | ${item.url}`).join("\n"); byId("pressQuotes").value = (kit.pressQuotes || []).map(item => `${item.quote} | ${item.source}${item.url ? ` | ${item.url}` : ""}`).join("\n"); const details = kit.publicDetails && typeof kit.publicDetails === "object" ? kit.publicDetails : { bookingEmail:true, bookingPhone:true, technical:true, hospitality:true }; byId("publicBookingEmail").checked = details.bookingEmail === true; byId("publicBookingPhone").checked = details.bookingPhone === true; byId("publicTechnical").checked = details.technical === true; byId("publicHospitality").checked = details.hospitality === true; epkMedia = Array.isArray(kit.media) ? kit.media : []; renderMediaManager(); render(kit); }
  function showLink(publicId, published) { const row = byId("publicLinkRow"), link = byId("publicLink"); row.hidden = !publicId || !published; if (!row.hidden) { link.href = `epk.html?id=${encodeURIComponent(publicId)}`; link.textContent = new URL(link.href, location.href).href; } }
  const mediaRoles = [
    ["press-photo","Press photo"],["logo","Logo"],["artwork","Artwork"],["press-clipping","Press clipping"],
    ["biography","PDF biography"],["technical-rider","Technical rider"],["hospitality-rider","Hospitality rider"],["stage-plot","Stage plot"],["other","Other"]
  ];
  function renderMediaManager() {
    const listNode = byId("epkMediaList"); if (!listNode) return; listNode.replaceChildren();
    if (!epkMedia.length) { listNode.append(text("p", "No files uploaded yet.", "hint")); return; }
    epkMedia.forEach((item,index) => {
      const row = document.createElement("article"), name = document.createElement("input"), role = document.createElement("select"), publicLabel = document.createElement("label"), publicInput = document.createElement("input"), featuredLabel = document.createElement("label"), featured = document.createElement("input"), up = document.createElement("button"), down = document.createElement("button"), replace = document.createElement("input"), remove = document.createElement("button");
      row.className = "epk-media-item"; name.value = item.name || "Press material"; name.maxLength = 160; name.setAttribute("aria-label", "File name"); name.addEventListener("input", () => { item.name = name.value; });
      mediaRoles.forEach(([value,label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = item.role === value; role.append(option); }); role.setAttribute("aria-label", "Media type"); role.addEventListener("change", () => { item.role = role.value; render(kitFromForm(true)); });
      publicInput.type = "checkbox"; publicInput.checked = item.public === true; publicInput.addEventListener("change", () => { item.public = publicInput.checked; render(kitFromForm(true)); }); publicLabel.append(publicInput, document.createTextNode(" Public download"));
      featured.type = "checkbox"; featured.checked = item.featured === true; featured.addEventListener("change", () => { epkMedia.forEach(entry => { entry.featured = false; }); item.featured = featured.checked; renderMediaManager(); render(kitFromForm(true)); }); featuredLabel.append(featured, document.createTextNode(" Featured"));
      up.type = down.type = remove.type = "button"; up.textContent = "↑"; down.textContent = "↓"; remove.textContent = "Delete"; up.disabled = index === 0; down.disabled = index === epkMedia.length - 1;
      up.addEventListener("click", () => { [epkMedia[index-1],epkMedia[index]] = [epkMedia[index],epkMedia[index-1]]; renderMediaManager(); render(kitFromForm(true)); }); down.addEventListener("click", () => { [epkMedia[index+1],epkMedia[index]] = [epkMedia[index],epkMedia[index+1]]; renderMediaManager(); render(kitFromForm(true)); });
      replace.type = "file"; replace.accept = "image/jpeg,image/png,image/webp,application/pdf"; replace.setAttribute("aria-label", `Replace ${item.name}`); replace.addEventListener("change", async () => { const file = replace.files?.[0]; if (!file) return; const replacement = await uploadEpkFile(file, item.role); if (replacement) { replacement.name = item.name; replacement.public = item.public; replacement.featured = item.featured; releasePreview(item); epkMedia.splice(index,1,replacement); renderMediaManager(); render(kitFromForm(true)); } });
      remove.addEventListener("click", () => { releasePreview(item); epkMedia.splice(index,1); renderMediaManager(); render(kitFromForm(true)); byId("epkUploadStatus").textContent = "File removed from this draft. Save the EPK to delete it from private storage."; });
      const previewSource = item.url || item.previewUrl; if (previewSource && item.contentType?.startsWith("image/")) { const image = document.createElement("img"); image.src = previewSource; image.alt = ""; row.append(image); }
      row.append(name, role, publicLabel, featuredLabel, up, down, replace, remove); listNode.append(row);
    });
  }
  function putWithProgress(url, file) {
    return new Promise((resolve,reject) => { const upload = new XMLHttpRequest(), progress = byId("epkUploadProgress"); upload.open("PUT", url); upload.setRequestHeader("Content-Type", file.type); upload.timeout = Math.max(60000, Math.min(300000, Math.ceil(file.size / 50000) * 1000)); progress.hidden = false; progress.value = 0; upload.upload.onprogress = event => { if (event.lengthComputable) progress.value = Math.round(event.loaded / event.total * 100); }; upload.onload = () => upload.status >= 200 && upload.status < 300 ? resolve() : reject(new Error("The file upload failed.")); upload.onerror = () => reject(new Error("The file upload failed.")); upload.ontimeout = () => reject(new Error("The file upload took too long. Try again on a stronger connection.")); upload.onloadend = () => { progress.hidden = true; }; upload.send(file); });
  }
  async function prepareEpkImage(file) {
    if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const longest = Math.max(bitmap.width, bitmap.height);
      if (longest <= 2400 && file.size <= 4 * 1024 * 1024) return file;
      const scale = Math.min(1, 2400 / longest), canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d", { alpha:false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type:"image/jpeg", lastModified:file.lastModified });
    } catch {
      return file;
    } finally {
      bitmap?.close?.();
    }
  }
  async function discardEpkMedia(mediaKey) {
    if (!mediaKey) return;
    await request(`${api}/stories`, { method:"POST", credentials:"include", keepalive:true, headers:{"content-type":"application/json"}, body:JSON.stringify({action:"discard",mediaKey}) }, 5000).catch(() => {});
  }
  async function uploadEpkFile(file, requestedRole = "") {
    file = await prepareEpkImage(file);
    const allowed = new Set(["image/jpeg","image/png","image/webp","application/pdf"]), maximum = file.type === "application/pdf" ? 20 * 1024 * 1024 : 12 * 1024 * 1024, uploadStatus = byId("epkUploadStatus");
    if (!allowed.has(file.type) || !file.size || file.size > maximum) { uploadStatus.textContent = `${file.name} is not a supported file or exceeds the size limit.`; return null; }
    uploadStatus.textContent = `Uploading ${file.name}...`;
    let ticket = null;
    try { const response = await request(`${api}/stories`, { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({contentType:file.type,purpose:"epk"}) }); ticket = await response.json().catch(() => ({})); if (!response.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "Upload could not start."); await putWithProgress(ticket.uploadUrl, file); uploadStatus.textContent = `${file.name} uploaded. Save the EPK to keep it.`; return { id:ticket.mediaKey.split("/").at(-1).split(".")[0], key:ticket.mediaKey, name:file.name, role:requestedRole || (file.type === "application/pdf" ? "other" : "press-photo"), public:false, featured:false, contentType:file.type, size:file.size, previewUrl:file.type.startsWith("image/") ? URL.createObjectURL(file) : "" }; } catch (error) { await discardEpkMedia(ticket?.mediaKey); uploadStatus.textContent = error.message; return null; }
  }
  async function uploadFiles(files) { for (const file of files) { const item = await uploadEpkFile(file); if (item) epkMedia.push(item); } renderMediaManager(); render(kitFromForm(true)); }
  async function save(publish) { const kit = kitFromForm(); if (!kit.artistName) { status.textContent = "Add the artist or act name first."; byId("artistName").focus(); return; } status.textContent = publish ? "Publishing EPK..." : "Saving private draft..."; try { const response = await request(`${api}/epk`, { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({kit,publish}) }, 20000); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The EPK could not be saved."); showLink(data.publicId, data.published); status.textContent = data.published ? "EPK published. Review the public link before sending it." : "Private draft saved. The public copy is unavailable."; } catch (error) { status.textContent = error.message; } }
  async function deleteEpk() {
    const confirmed = await window.danzstakConfirm("Permanently delete this EPK and all uploaded EPK files? This cannot be undone.", {
      title: "Delete this EPK?",
      confirmLabel: "Delete EPK",
      cancelLabel: "Keep EPK",
      danger: true
    });
    if (!confirmed) return;
    const button = byId("deleteEpk");
    button.disabled = true;
    status.textContent = "Deleting EPK and private files...";
    try {
      const response = await request(`${api}/epk`, { method:"DELETE", credentials:"include", cache:"no-store" }, 20000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The EPK could not be deleted.");
      form.reset();
      epkMedia.forEach(releasePreview);
      epkMedia = [];
      renderMediaManager();
      render({});
      showLink("", false);
      status.textContent = data.cleanupPending ? "EPK deleted. Some private files are still being cleaned up." : "EPK and its private files were deleted.";
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }
  const publicId = new URLSearchParams(location.search).get("id");
  if (publicId) { document.body.classList.add("public-mode"); status.textContent = "Loading EPK..."; request(`${api}/epk/public/${encodeURIComponent(publicId)}`, { credentials:"omit", cache:"no-store" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "EPK not found."); render(data.kit); document.title = `${data.kit.artistName} EPK | DanzStak`; byId("publicEpkActions").hidden = false; }).catch(error => { preview.replaceChildren(text("p", error.message, "empty-note")); }); byId("printEpk").addEventListener("click", () => window.print()); byId("copyEpkLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(location.href); window.danzstakShowFeedback?.("EPK link copied."); } catch { window.danzstakShowFeedback?.("Copy was blocked. Select the address from your browser.", { urgent:true }); } }); return; }
  request(`${api}/epk`, { credentials:"include", cache:"no-store" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Could not load your EPK."); if (data.kit) fill(data.kit); else render({}); showLink(data.publicId, data.published); status.textContent = data.kit ? (data.published ? "Published EPK loaded." : "Private draft loaded.") : "Start with the act name. Your draft is private."; }).catch(error => { render({}); status.textContent = error.message; });
  const mediaInput = byId("epkMediaInput"), dropZone = byId("epkDropZone"); mediaInput.addEventListener("change", () => uploadFiles([...mediaInput.files])); for (const eventName of ["dragenter","dragover"]) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add("is-dragging"); }); for (const eventName of ["dragleave","drop"]) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }); dropZone.addEventListener("drop", event => uploadFiles([...event.dataTransfer.files]));
  form.addEventListener("input", event => { if (!event.target.closest(".epk-media-item")) render(kitFromForm(true)); }); byId("saveDraft").addEventListener("click", () => save(false)); byId("publishEpk").addEventListener("click", () => save(true)); byId("unpublishEpk").addEventListener("click", () => save(false)); byId("deleteEpk").addEventListener("click", deleteEpk); byId("copyPublicLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(byId("publicLink").href); status.textContent = "Public EPK link copied."; } catch { status.textContent = "Copy was blocked. Select the visible link instead."; } });
})();
