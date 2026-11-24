"use strict";
(() => {
  const api = "https://api.danzstak.com";
  const byId = id => document.getElementById(id), form = byId("epkForm"), preview = byId("epkPreview"), status = byId("epkStatus");
  const fields = ["artistName","hometown","actType","genres","shortPitch","shortBio","bio","lineup","releases","notableShows","achievements","musicLinks","videoLinks","socialLinks","heroImage","logoImage","pressQuotes","stageRequirements","techRequirements","hospitalityRequirements","bookingName","bookingEmail","bookingPhone","website"];
  const epkLooks = new Set(["techno", "punk", "metal", "house"]);
  let epkMedia = [], guidedMode = true, currentGuideStep = 1;
  const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal:controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error("DanzStak took too long to respond. Try again.");
      throw new Error("DanzStak cannot connect right now. Check your connection and try again.");
    } finally { clearTimeout(timer); }
  }
  // Shared EPK links are danzstak.com/e/<id>: link previews show the EPK's card there (epk-share-preview.mjs), and the page
  // opens the review view when the link carries its #token, otherwise the published EPK. Only once the server says that
  // address works (its answers carry shareUrl); until then the long epk.html links.
  let shortLinks = false;
  const useShortLinks = data => { if (/^https:\/\/danzstak\.com\/e\//.test(String(data?.shareUrl || ""))) shortLinks = true; };
  const epkLink = id => shortLinks && /^[a-z0-9-]{3,64}$/.test(String(id || "")) ? `https://danzstak.com/e/${id}` : "";
  function canonicalEpkUrl() {
    const query = new URLSearchParams(location.search), short = epkLink(query.get("id") || query.get("share"));
    if (short) return short + location.hash;
    const url = new URL("https://danzstak.com/epk.html");
    url.search = location.search;
    url.hash = location.hash;
    return url.href;
  }
  const svgDataUrl = svg => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The QR code could not be prepared."));
    reader.readAsDataURL(new Blob([svg], { type:"image/svg+xml" }));
  });
  const lines = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const linkLines = value => lines(value).map(item => { const [label, ...rest] = item.split("|"); const url = rest.join("|").trim(); return { label: label.trim(), url }; }).filter(item => item.label && /^https:\/\//i.test(item.url));
  const quoteLines = value => lines(value).map(item => { const [quote, source, ...rest] = item.split("|"); return { quote: quote?.trim(), source: source?.trim(), url: rest.join("|").trim() }; }).filter(item => item.quote && item.source);
  // Hometown skin (task 15-B): auto (from the hometown field), a chosen scene city, or off. Matching is local.
  const homeLooks = () => window.danzstakHometownLooks;
  const HOMETOWN_MODES = new Set(["auto", "city", "off"]);
  function hometownSkinFromForm() {
    const mode = document.querySelector('input[name="hometownMode"]:checked')?.value || "auto";
    if (mode !== "city") return { mode: HOMETOWN_MODES.has(mode) ? mode : "auto" };
    const look = homeLooks()?.hometownLook(byId("hometownCity")?.value || "");
    return look?.curated ? { mode: "city", city: look.id } : { mode: "auto" };
  }
  function resolveHometown(kit = {}) {
    const L = homeLooks(); if (!L) return null;
    const skin = kit.hometownSkin && typeof kit.hometownSkin === "object" ? kit.hometownSkin : { mode: "auto" }; // old kits act as "auto"
    if (skin.mode === "off") return null;
    if (skin.mode === "city") { const city = L.cityById(skin.city); if (city) return L.hometownLook(city.name); }
    return L.hometownLook(kit.hometown || "");
  }
  const coordText = home => {
    const lat = home?.tokens?.lat, lon = home?.tokens?.lon;
    return Number.isFinite(lat) && Number.isFinite(lon) ? `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}` : "";
  };
  const SKIN_VARS = ["--epk-ground", "--epk-ink", "--epk-accent", "--home-motif"];
  function applyHometown(look, home) {
    const L = homeLooks(), isPublic = document.body.classList.contains("public-mode");
    for (const name of SKIN_VARS) preview.style.removeProperty(name);
    delete preview.dataset.hometown; delete preview.dataset.hometownName; delete preview.dataset.hometownCoords; delete preview.dataset.hometownAccent;
    delete document.body.dataset.epkHometown; document.body.style.removeProperty("--epk-page-ground"); document.body.style.removeProperty("--home-motif");
    if (!L || !home) return;
    const vars = L.cssVars(look, home), composed = L.compose(look, home);
    for (const [name, value] of Object.entries(vars)) preview.style.setProperty(name, value);
    preview.dataset.hometown = home.id; preview.dataset.hometownName = home.name; preview.dataset.hometownAccent = composed.accent;
    const coords = coordText(home); if (coords) preview.dataset.hometownCoords = coords;
    // The skin wraps the whole page: the public EPK takes the composed ground; the dark builder takes the motif only.
    document.body.dataset.epkHometown = home.id;
    if (isPublic) { document.body.style.setProperty("--epk-page-ground", composed.ground); document.body.style.setProperty("--home-motif", composed.motif); }
    else document.body.style.setProperty("--home-motif", L.compose("techno", home).motif);
  }
  function updateHometownControls() {
    const L = homeLooks(), auto = byId("hometownAutoCity"), vibe = byId("hometownVibe"), pick = byId("hometownCityPick");
    if (!auto || !vibe) return;
    const mode = document.querySelector('input[name="hometownMode"]:checked')?.value || "auto";
    if (pick) pick.hidden = mode !== "city";
    const fromField = L?.hometownLook(byId("hometown").value);
    auto.textContent = fromField ? `(${fromField.name})` : "";
    const active = resolveHometown({ hometown: byId("hometown").value, hometownSkin: hometownSkinFromForm() });
    vibe.replaceChildren();
    if (mode === "off") vibe.append(document.createTextNode("The genre look on its own."));
    else if (active) { vibe.append(Object.assign(document.createElement("strong"), { textContent: active.name })); if (active.tokens.vibe) vibe.append(" · ", Object.assign(document.createElement("span"), { textContent: active.tokens.vibe })); }
    else vibe.append(document.createTextNode(mode === "city" ? "Pick a city from the list." : "Add your home town to see its skin."));
  }
  const kitFromForm = (includeLocalPreviews = false) => ({
    artistName: byId("artistName").value.trim(), hometown: byId("hometown").value.trim(), hometownSkin: hometownSkinFromForm(), actType: byId("actType").value, genres: byId("genres").value.split(",").map(item => item.trim()).filter(Boolean), look: epkLooks.has(byId("epkLook").value) ? byId("epkLook").value : "techno", shortPitch: byId("shortPitch").value.trim(), shortBio: byId("shortBio").value.trim(), bio: byId("bio").value.trim(),
    lineup: lines(byId("lineup").value), releases: lines(byId("releases").value), notableShows: lines(byId("notableShows").value), achievements: lines(byId("achievements").value), musicLinks: linkLines(byId("musicLinks").value), videoLinks: linkLines(byId("videoLinks").value).map(item => window.danzstakEpkVideoCheck ? window.danzstakEpkVideoCheck.mark(item) : item).filter(Boolean), socialLinks: linkLines(byId("socialLinks").value), heroImage: byId("heroImage").value.trim(), logoImage: byId("logoImage").value.trim(), media: epkMedia.map(({url,previewUrl,...item}) => includeLocalPreviews ? {...item,url,previewUrl} : item), pressQuotes: quoteLines(byId("pressQuotes").value), stageRequirements: byId("stageRequirements").value.trim(), production:window.danzstakEpkProduction?.getData?.() || {plotItems:[],inputs:[]}, techRequirements: byId("techRequirements").value.trim(), hospitalityRequirements: byId("hospitalityRequirements").value.trim(), bookingName: byId("bookingName").value.trim(), bookingEmail: byId("bookingEmail").value.trim(), bookingPhone: byId("bookingPhone").value.trim(), website: byId("website").value.trim(), publicDetails: { bookingEmail:byId("publicBookingEmail").checked, bookingPhone:byId("publicBookingPhone").checked, technical:byId("publicTechnical").checked, hospitality:byId("publicHospitality").checked }
  });
  function guideCompletion() {
    const kit = kitFromForm(true);
    return {
      identity: Boolean(kit.artistName),
      story: Boolean(kit.shortPitch || kit.shortBio),
      links: Boolean(kit.musicLinks.length || kit.videoLinks.length),
      photo: Boolean(/^https:\/\//i.test(kit.heroImage) || kit.media.some(item => item.contentType?.startsWith("image/"))),
      contact: Boolean(kit.bookingEmail || /^https:\/\//i.test(kit.website))
    };
  }
  function updateGuide() {
    const completed = guideCompletion();
    let count = 0;
    byId("epkGuideChecklist").querySelectorAll("[data-check]").forEach(item => {
      const ready = completed[item.dataset.check] === true;
      item.classList.toggle("is-complete", ready);
      const current = item === byId("epkGuideChecklist").querySelectorAll("[data-check]")[currentGuideStep - 1];
      item.classList.toggle("is-current", current);
      if (current) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
      if (ready) count += 1;
    });
    byId("epkGuideProgress").value = count;
    byId("epkGuideProgressText").textContent = `${count} of 5 essentials ready · Step ${currentGuideStep} of 5`;
  }
  function focusGuideStep() {
    const sectionNode = form.querySelector(`[data-epk-step="${currentGuideStep}"]`);
    if (!sectionNode) return;
    sectionNode.tabIndex = -1;
    sectionNode.focus({ preventScroll:true });
    sectionNode.scrollIntoView({ behavior:"smooth", block:"start" });
  }
  function setGuideStep(step, focus = false) {
    currentGuideStep = Math.max(1, Math.min(5, Number(step) || 1));
    form.querySelectorAll("[data-epk-step]").forEach(sectionNode => sectionNode.classList.toggle("is-current-step", Number(sectionNode.dataset.epkStep) === currentGuideStep));
    byId("guideBack").disabled = currentGuideStep === 1;
    byId("guideNext").textContent = currentGuideStep === 5 ? "Review and save" : "Next";
    updateGuide();
    if (focus) focusGuideStep();
  }
  function setGuidedMode(enabled, focus = false) {
    guidedMode = enabled === true;
    document.body.classList.toggle("epk-guided", guidedMode);
    byId("showAllFields").textContent = guidedMode ? "Show all fields" : "Use 5-minute guide";
    byId("guideBack").hidden = !guidedMode;
    byId("guideNext").hidden = !guidedMode;
    setGuideStep(currentGuideStep, focus && guidedMode);
  }
  function setMobilePreview(open) {
    document.body.classList.toggle("epk-preview-open", open);
    byId("toggleMobilePreview").textContent = open ? "Edit EPK" : "Preview";
    byId("toggleMobilePreview").setAttribute("aria-expanded", String(open));
    if (open) preview.scrollIntoView({ behavior:"smooth", block:"start" });
  }
  function section(title, content) { if (!content) return; const wrap = document.createElement("section"); wrap.dataset.epkSection = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); wrap.append(text("h2", title), content); preview.querySelector(".epk-body").append(wrap); }
  function list(items) { if (!items?.length) return null; const ul = document.createElement("ul"); items.forEach(item => ul.append(text("li", item))); return ul; }
  function links(items) { if (!items?.length) return null; const wrap = document.createElement("div"); wrap.className = "link-list"; items.forEach(item => { if (!/^https:\/\//i.test(item.url || "")) return; const a = text("a", item.label); a.href = item.url; a.target = "_blank"; a.rel = "noopener noreferrer"; wrap.append(a); }); return wrap; }
  function providerSource(item) {
    let source = "";
    try {
      const url = new URL(item.url), host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtube.com" || host === "m.youtube.com") { const id = url.searchParams.get("v") || (url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] : ""); if (/^[\w-]{6,20}$/.test(id || "")) source = `https://www.youtube-nocookie.com/embed/${id}`; }
      else if (host === "youtu.be") { const id = url.pathname.split("/").filter(Boolean)[0]; if (/^[\w-]{6,20}$/.test(id || "")) source = `https://www.youtube-nocookie.com/embed/${id}`; }
      else if (host === "vimeo.com") { const id = url.pathname.split("/").filter(Boolean).find(part => /^\d+$/.test(part)); if (id) source = `https://player.vimeo.com/video/${id}`; }
      else if (host === "open.spotify.com" && /^\/(track|album|playlist|episode|show)\/[A-Za-z0-9]+/.test(url.pathname)) source = `https://open.spotify.com/embed${url.pathname}`;
    } catch {}
    return source;
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
  function providerMark(provider) {
    return ({YouTube:"YT",Vimeo:"VM",Spotify:"SP",SoundCloud:"SC",Bandcamp:"BC",TikTok:"TT",Instagram:"IG",Facebook:"FB"})[provider] || "↗";
  }
  function stopProviderEmbeds(except = null) {
    document.querySelectorAll(".epk-media-card[data-player-active='true']").forEach(card => {
      if (card === except) return;
      card.querySelector("iframe")?.remove();
      card.querySelectorAll(".epk-player-load, .epk-video-face").forEach(node => { node.hidden = false; });
      delete card.dataset.playerActive;
    });
  }
  const say = value => window.danzstakTranslate?.(value) || value;
  // A removed or private video never shows in the EPK, and a Watch section with nothing left goes too.
  function dropCard(card) {
    const wrap = card.parentElement;
    card.remove();
    if (wrap && !wrap.querySelector(".epk-media-card")) wrap.closest("section")?.remove();
  }
  // A video that won't play inside other sites: its picture opens it on its own site instead.
  function toLink(card, item, face) {
    if (!face || face.tagName === "A") return;
    const link = document.createElement("a");
    link.className = "epk-video-face";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${say(`Open on ${providerName(item.url)}`)}: ${item.label}`);
    link.append(...face.childNodes);
    face.replaceWith(link);
    card.dataset.embed = "off";
    if (!card.querySelector(".epk-player-note")) card.querySelector(".epk-media-actions")?.append(text("p", "This video only plays on its own site.", "epk-player-note"));
  }
  function activateProvider(card, item, source, button) {
    stopProviderEmbeds(card);
    card.querySelector("iframe")?.remove();
    const frame = document.createElement("iframe");
    const check = window.danzstakEpkVideoCheck, video = button.classList.contains("epk-video-face");
    // A tap on the video's picture plays it there and then (autoplay only after that tap).
    frame.src = check?.embedSource(item.url, { api:true, play:video }) || source;
    frame.title = `${item.label} player`;
    frame.loading = "eager";
    frame.allow = `${video ? "autoplay; " : ""}encrypted-media; fullscreen; picture-in-picture`;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    card.dataset.playerActive = "true";
    button.hidden = true;
    if (video) button.before(frame); else card.append(frame); // a video's player takes its picture's place
    // YouTube's "Video unavailable" never shows to a venue: a removed or private video leaves the EPK, one that won't
    // play inside other sites opens on its own site.
    const stop = check?.watchPlayer?.(frame, { onError: code => {
      stop?.(); frame.remove(); delete card.dataset.playerActive;
      if (!video) { button.remove(); card.dataset.embed = "off"; card.querySelector(".epk-media-actions")?.append(text("p", "This video only plays on its own site.", "epk-player-note")); return; }
      button.hidden = false;
      if ([2, 100].includes(code)) dropCard(card); else toLink(card, item, button);
    } });
  }
  // YouTube and Vimeo show the video's own picture with a play button; a tap plays it in place.
  function videoFace(card, item, source) {
    const face = document.createElement("button"), picture = document.createElement("img"), play = document.createElement("span");
    face.type = "button";
    face.className = "epk-video-face";
    face.setAttribute("aria-label", `${say("Play video")}: ${item.label}`);
    picture.alt = "";
    picture.decoding = "async";
    picture.referrerPolicy = "no-referrer";
    picture.hidden = true;
    play.className = "epk-video-play";
    play.setAttribute("aria-hidden", "true");
    face.append(picture, play);
    face.addEventListener("click", () => activateProvider(card, item, source, face));
    window.danzstakEpkVideoCheck?.poster?.(item.url).then(result => {
      if (result.state === "gone") return dropCard(card);
      if (result.src) { picture.src = result.src; picture.hidden = false; }
      if (result.state === "link") toLink(card, item, card.querySelector(".epk-video-face"));
    });
    return face;
  }
  function mediaLinks(items) {
    if (!items?.length) return null;
    const wrap = document.createElement("div");
    wrap.className = "epk-embeds";
    items.forEach(item => {
      if (!/^https:\/\//i.test(item.url || "")) return;
      const card = document.createElement("article"), mark = text("span", "", "epk-provider-mark"), copy = document.createElement("div"), actions = document.createElement("div"), source = providerSource(item), provider = providerName(item.url), link = text("a", `Open on ${provider}`);
      const video = Boolean(source && window.danzstakEpkVideoCheck?.embedSource(item.url));
      card.className = video ? "epk-media-card epk-video-card" : "epk-media-card";
      card.dataset.provider = provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      mark.textContent = providerMark(provider);
      mark.setAttribute("aria-hidden", "true");
      copy.className = "epk-media-copy";
      copy.append(text("p", provider, "epk-provider"), text("h3", item.label));
      actions.className = "epk-media-actions";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (item.embed === false) card.dataset.embed = "off";
      if (video) {
        const face = videoFace(card, item, source);
        actions.append(link);
        card.append(face, mark, copy, actions);
        if (item.embed === false) toLink(card, item, face);
        wrap.append(card);
        return;
      }
      if (source && item.embed !== false) {
        const load = text("button", `Load ${provider} player`, "epk-player-load");
        load.type = "button";
        load.setAttribute("aria-label", `Load ${item.label} from ${provider}`);
        load.addEventListener("click", () => activateProvider(card, item, source, load));
        actions.append(load);
      }
      actions.append(link);
      card.append(mark, copy, actions);
      wrap.append(card);
    });
    return wrap;
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopProviderEmbeds(); });
  window.addEventListener("pagehide", () => stopProviderEmbeds());
  function render(kit = {}) {
    preview.replaceChildren(); const hero = document.createElement("div"), body = document.createElement("div"); hero.className = "epk-hero"; body.className = "epk-body";
    const look = epkLooks.has(kit.look) ? kit.look : "techno";
    preview.dataset.look = look;
    if (document.body.classList.contains("public-mode")) document.body.dataset.epkLook = look;
    const home = resolveHometown(kit);
    applyHometown(look, home);
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
    if (home) { const line = text("p", "", "epk-hometown-line"); line.append(text("span", "Out of"), " ", text("strong", home.name)); const coords = coordText(home); if (coords) { const c = text("span", coords, "epk-hometown-coords"); c.dataset.noTranslate = ""; line.append(c); } hero.append(line); }
    preview.append(hero, body); if (kit.shortPitch) body.append(text("p", kit.shortPitch, "lead"));
    section("About", kit.shortBio || kit.bio ? text("p", kit.shortBio || kit.bio) : null); if (kit.shortBio && kit.bio) section("Full biography", text("p", kit.bio)); section("Lineup", list(kit.lineup)); section("Releases", list(kit.releases)); section("Listen", mediaLinks(kit.musicLinks)); section("Watch", mediaLinks(kit.videoLinks)); section("Follow", links(kit.socialLinks)); section("Notable shows", list(kit.notableShows)); section("Achievements", list(kit.achievements));
    if (kit.pressQuotes?.length) { const wrap = document.createElement("div"); kit.pressQuotes.forEach(item => { const q = text("blockquote", `“${item.quote}” — ${item.source}`, "quote"); if (/^https:\/\//i.test(item.url || "")) { const a = text("a", "Source"); a.href = item.url; a.target = "_blank"; a.rel = "noopener noreferrer"; q.append(document.createElement("br"), a); } wrap.append(q); }); section("Press", wrap); }
    const publicMedia = (kit.media || []).filter(item => item.url); if (publicMedia.length) { const wrap = document.createElement("div"); wrap.className = "epk-downloads"; publicMedia.forEach(item => { if (item.contentType?.startsWith("image/")) { const image = document.createElement("img"); image.src = item.url; image.alt = item.name; image.loading = "lazy"; wrap.append(image); } const link = text("a", `${item.name} — download`); link.href = item.downloadUrl || item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.setAttribute("download", ""); wrap.append(link); }); section("Press materials", wrap); }
    section("Stage", kit.stageRequirements ? text("p", kit.stageRequirements) : null); if (publicDetails.technical) section(["dj","electronic"].includes(kit.actType) ? "Booth plot and input list" : "Stage plot and input list", window.danzstakEpkProduction?.renderPublic?.(kit.production, kit.actType)); section("Technical", publicDetails.technical && kit.techRequirements ? text("p", kit.techRequirements, "epk-production-note") : null); section("Hospitality", publicDetails.hospitality && kit.hospitalityRequirements ? text("p", kit.hospitalityRequirements) : null);
    const publicEmail = publicDetails.bookingEmail ? kit.bookingEmail : "", publicPhone = publicDetails.bookingPhone ? kit.bookingPhone : "", contactBits = [kit.bookingName, publicEmail, publicPhone].filter(Boolean); if (contactBits.length || kit.website) { const wrap = document.createElement("div"); wrap.className = "epk-contact"; if (kit.bookingName) wrap.append(text("p", kit.bookingName)); if (publicEmail) { const a = text("a", `Email ${kit.bookingName || "booking contact"}`); a.href = `mailto:${publicEmail}`; wrap.append(a); } if (publicPhone) { const phone = text("a", publicPhone); if (/^\+?[0-9 ()-]{7,24}$/.test(publicPhone)) phone.href = `tel:${publicPhone.replace(/[^+\d]/g, "")}`; wrap.append(phone); } if (/^https:\/\//i.test(kit.website || "")) { const a = text("a", "Official website"); a.href = kit.website; a.target = "_blank"; a.rel = "noopener noreferrer"; wrap.append(a); } section("Booking", wrap); }
  }
  const releasePreview = item => { if (/^blob:/i.test(item?.previewUrl || "")) URL.revokeObjectURL(item.previewUrl); };
  function fillHometownSkin(kit = {}) {
    const skin = kit.hometownSkin && typeof kit.hometownSkin === "object" ? kit.hometownSkin : { mode: "auto" };
    const mode = HOMETOWN_MODES.has(skin.mode) ? skin.mode : "auto", input = document.querySelector(`input[name="hometownMode"][value="${mode}"]`);
    if (input) input.checked = true;
    const city = homeLooks()?.cityById(skin.city), cityInput = byId("hometownCity");
    if (cityInput) cityInput.value = mode === "city" && city ? city.name : "";
    queueMicrotask(updateHometownControls); // after fill() has written the hometown field
  }
  function fill(kit = {}) { fillHometownSkin(kit); epkMedia.forEach(releasePreview); fields.forEach(id => { if (["genres","lineup","releases","notableShows","achievements","musicLinks","videoLinks","socialLinks","pressQuotes"].includes(id)) return; byId(id).value = kit[id] || (id === "actType" ? "band" : ""); }); byId("epkLook").value = epkLooks.has(kit.look) ? kit.look : "techno"; byId("actType").value = ["band","dj","electronic","solo"].includes(kit.actType) ? kit.actType : "band"; byId("genres").value = (kit.genres || []).join(", "); for (const id of ["lineup","releases","notableShows","achievements"]) byId(id).value = (kit[id] || []).join("\n"); window.danzstakEpkVideoCheck?.seed(kit.videoLinks); for (const id of ["musicLinks","videoLinks","socialLinks"]) byId(id).value = (kit[id] || []).map(item => `${item.label} | ${item.url}`).join("\n"); byId("pressQuotes").value = (kit.pressQuotes || []).map(item => `${item.quote} | ${item.source}${item.url ? ` | ${item.url}` : ""}`).join("\n"); window.danzstakEpkProduction?.setData?.(kit.production || {}); const details = kit.publicDetails && typeof kit.publicDetails === "object" ? kit.publicDetails : { bookingEmail:true, bookingPhone:true, technical:true, hospitality:true }; byId("publicBookingEmail").checked = details.bookingEmail === true; byId("publicBookingPhone").checked = details.bookingPhone === true; byId("publicTechnical").checked = details.technical === true; byId("publicHospitality").checked = details.hospitality === true; epkMedia = Array.isArray(kit.media) ? kit.media : []; renderMediaManager(); render(kit); updateGuide(); }
  function showLink(publicId, published) { const row = byId("publicLinkRow"), link = byId("publicLink"), handoff = byId("epkBookingHandoff"); row.hidden = !publicId || !published; if (handoff) handoff.hidden = row.hidden; byId("unpublishEpk").hidden = row.hidden; /* audit 36 D6: nothing to unpublish yet */ if (!row.hidden) { link.href = epkLink(publicId) || new URL(`epk.html?id=${encodeURIComponent(publicId)}`, location.href).href; link.textContent = link.href; } }
  // The EPK's link preview card (assets/epk-share-card.js): shown once there's a link to share (published, or a private
  // review link), drawn from the saved EPK, and uploaded and kept up to date while "Show my EPK card in link previews" is on.
  const cardState = { publicId: "", published: false, privateShared: false, shareCard: false, shareCardOff: false, shareCardSig: "", kit: null };
  let cardBusy = null, cardAgain = false, cardImageUrl = "";
  function showCardImage(blob) { const image = byId("epkCardImage"); if (cardImageUrl) URL.revokeObjectURL(cardImageUrl); cardImageUrl = URL.createObjectURL(blob); image.src = cardImageUrl; image.hidden = false; }
  function syncCard(update = {}) {
    Object.assign(cardState, update);
    const row = byId("epkCardRow"), toggle = byId("epkCardOn"), note = byId("epkCardStatus"), card = window.danzstakEpkCard;
    if (!row || !card) return Promise.resolve();
    row.hidden = !shortLinks || !cardState.publicId || !(cardState.published || cardState.privateShared) || !String(cardState.kit?.artistName || "").trim();
    if (row.hidden) return Promise.resolve();
    if (cardBusy) { cardAgain = true; return cardBusy; } // a change while busy is applied right after
    toggle.checked = !cardState.shareCardOff;
    cardBusy = (async () => {
      try {
        const kit = cardState.kit;
        if (!cardState.shareCardOff) {
          if (cardState.shareCard && cardState.shareCardSig === await card.signature(kit)) showCardImage(await card.draw(kit));
          else {
            note.textContent = "Making your link preview...";
            const result = await card.publish(kit);
            Object.assign(cardState, { shareCard: true, shareCardSig: result.shareCardSig || "" });
            showCardImage(result.blob);
          }
          note.textContent = "Links to this EPK show this card on Facebook, WhatsApp, Messages and in Mix.";
        } else {
          if (cardState.shareCard) await card.turnOff();
          Object.assign(cardState, { shareCard: false, shareCardSig: "" });
          byId("epkCardImage").hidden = true;
          note.textContent = "Links to this EPK show a plain DanzStak card.";
        }
      } catch (error) { note.textContent = error.message; }
      finally { cardBusy = null; if (cardAgain) { cardAgain = false; syncCard(); } }
    })();
    return cardBusy;
  }
  function showPrivateShare(shared, href = "") { const create = byId("createPrivateLink"), revoke = byId("revokePrivateLink"), row = byId("privateLinkRow"), link = byId("privateLink"); create.textContent = shared ? "Replace private link" : "Create private link"; revoke.hidden = !shared; row.hidden = !href; if (href) { link.href = href; link.textContent = href; } else { link.removeAttribute("href"); link.textContent = ""; } }
  const mediaRoles = [
    ["press-photo","Press photo"],["logo","Logo"],["artwork","Artwork"],["press-clipping","Press clipping"],
    ["biography","PDF biography"],["technical-rider","Technical rider"],["hospitality-rider","Hospitality rider"],["stage-plot","Stage plot"],["other","Other"]
  ];
  function renderMediaManager() {
    const listNode = byId("epkMediaList"); if (!listNode) return; listNode.replaceChildren();
    renderRiderSlots();
    if (!epkMedia.length) { listNode.append(text("p", "No files uploaded yet.", "hint")); updateGuide(); return; }
    epkMedia.forEach((item,index) => {
      const row = document.createElement("article"), name = document.createElement("input"), role = document.createElement("select"), publicLabel = document.createElement("label"), publicInput = document.createElement("input"), featuredLabel = document.createElement("label"), featured = document.createElement("input"), up = document.createElement("button"), down = document.createElement("button"), replace = document.createElement("input"), remove = document.createElement("button");
      row.className = "epk-media-item"; name.value = item.name || "Press material"; name.maxLength = 160; name.setAttribute("aria-label", "File name"); name.addEventListener("input", () => { item.name = name.value; });
      mediaRoles.forEach(([value,label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = item.role === value; role.append(option); }); role.setAttribute("aria-label", "Media type"); role.addEventListener("change", () => { item.role = role.value; render(kitFromForm(true)); });
      publicInput.type = "checkbox"; publicInput.checked = item.public === true; publicInput.addEventListener("change", () => { item.public = publicInput.checked; render(kitFromForm(true)); }); publicLabel.append(publicInput, document.createTextNode(" Public download"));
      featured.type = "checkbox"; featured.checked = item.featured === true; featured.addEventListener("change", () => { epkMedia.forEach(entry => { entry.featured = false; }); item.featured = featured.checked; renderMediaManager(); render(kitFromForm(true)); }); featuredLabel.append(featured, document.createTextNode(" Featured"));
      up.type = down.type = remove.type = "button"; up.textContent = "↑"; down.textContent = "↓"; remove.textContent = "🗑️"; remove.className = "epk-media-delete"; remove.title = `Remove ${item.name || "file"}`; remove.setAttribute("aria-label", `Remove ${item.name || "file"} from this EPK`); up.disabled = index === 0; down.disabled = index === epkMedia.length - 1;
      up.addEventListener("click", () => { [epkMedia[index-1],epkMedia[index]] = [epkMedia[index],epkMedia[index-1]]; renderMediaManager(); render(kitFromForm(true)); }); down.addEventListener("click", () => { [epkMedia[index+1],epkMedia[index]] = [epkMedia[index],epkMedia[index+1]]; renderMediaManager(); render(kitFromForm(true)); });
      replace.type = "file"; replace.accept = "image/jpeg,image/png,image/webp,application/pdf"; replace.setAttribute("aria-label", `Replace ${item.name}`); replace.addEventListener("change", async () => { const file = replace.files?.[0]; if (!file) return; const replacement = await uploadEpkFile(file, item.role); if (replacement) { replacement.name = item.name; replacement.public = item.public; replacement.featured = item.featured; releasePreview(item); epkMedia.splice(index,1,replacement); renderMediaManager(); render(kitFromForm(true)); } });
      remove.addEventListener("click", () => { releasePreview(item); epkMedia.splice(index,1); renderMediaManager(); render(kitFromForm(true)); byId("epkUploadStatus").textContent = "File removed from this draft. Save the EPK to delete it from private storage."; });
      const previewSource = item.url || item.previewUrl; if (previewSource && item.contentType?.startsWith("image/")) { const image = document.createElement("img"); image.src = previewSource; image.alt = ""; row.append(image); }
      row.append(name, role, publicLabel, featuredLabel, up, down, replace, remove); listNode.append(row);
    });
    updateGuide();
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
    const allowed = new Set(["image/jpeg","image/png","image/webp","application/pdf"]), maximum = file.type === "application/pdf" ? 50 * 1024 * 1024 : 12 * 1024 * 1024, uploadStatus = byId("epkUploadStatus");
    if (!allowed.has(file.type) || !file.size || file.size > maximum) { uploadStatus.textContent = `${file.name} is not a supported file or exceeds the size limit.`; return null; }
    uploadStatus.textContent = `Uploading ${file.name}...`;
    let ticket = null;
    try { const response = await request(`${api}/stories`, { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({contentType:file.type,purpose:"epk"}) }); ticket = await response.json().catch(() => ({})); if (!response.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "Upload could not start."); await putWithProgress(ticket.uploadUrl, file); uploadStatus.textContent = `${file.name} uploaded. Save the EPK to keep it.`; return { id:ticket.mediaKey.split("/").at(-1).split(".")[0], key:ticket.mediaKey, name:file.name, role:requestedRole || (file.type === "application/pdf" ? "other" : "press-photo"), public:false, featured:false, contentType:file.type, size:file.size, previewUrl:file.type.startsWith("image/") ? URL.createObjectURL(file) : "" }; } catch (error) { await discardEpkMedia(ticket?.mediaKey); uploadStatus.textContent = error.message; return null; }
  }
  // Owner 2026-11-16: bands already have riders and plots as files. Let them drop the file instead of retyping it.
  const riderSlots = [["technical-rider","publicTechnical"],["hospitality-rider","publicHospitality"],["stage-plot","publicTechnical"]];
  function renderRiderSlots() {
    for (const [role] of riderSlots) {
      const slot = document.querySelector(`[data-rider-slot="${role}"]`); if (!slot) continue;
      const files = epkMedia.filter(item => item.role === role), state = slot.querySelector(".epk-rider-slot__state");
      slot.classList.toggle("has-file", files.length > 0);
      if (state) state.textContent = files.length ? files.map(item => item.name || "File").join(", ") : "";
    }
    const typed = byId("epkTypeInstead");
    if (typed && !typed.dataset.autoOpened && ["stageRequirements","techRequirements","hospitalityRequirements"].some(id => byId(id)?.value.trim()) ) { typed.open = true; typed.dataset.autoOpened = "1"; }
  }
  async function uploadRider(role, publicField, file) {
    const slot = document.querySelector(`[data-rider-slot="${role}"]`), state = slot?.querySelector(".epk-rider-slot__state");
    if (state) state.textContent = `Uploading ${file.name}...`;
    const item = await uploadEpkFile(file, role);
    if (!item) { if (state) state.textContent = byId("epkUploadStatus").textContent; return; }
    item.public = byId(publicField)?.checked === true;
    epkMedia.push(item); renderMediaManager(); render(kitFromForm(true));
    if (state) state.textContent = `${file.name} uploaded. Save the EPK to keep it.`;
  }
  async function uploadFiles(files) { for (const file of files) { const item = await uploadEpkFile(file); if (item) epkMedia.push(item); } renderMediaManager(); render(kitFromForm(true)); }
  // Spec 46: Save draft keeps the published EPK online for venues; only Unpublish (confirmed) takes it offline.
  async function save(action) { const publish = action === "publish"; const kit = kitFromForm(); if (!kit.artistName) { status.textContent = "Add the artist or act name first."; byId("artistName").focus(); return; } if (action === "unpublish" && !(await window.danzstakConfirm("Venues with the link will see that it's not available. Your draft and your published versions stay.", { title: "Take this EPK offline?", confirmLabel: "Unpublish", cancelLabel: "Keep it online", danger: true }))) return; status.textContent = publish ? "Publishing EPK..." : action === "unpublish" ? "Taking the EPK offline..." : "Saving private draft..."; try { const response = await request(`${api}/epk`, { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({kit,action,publish}) }, 20000); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The EPK could not be saved."); useShortLinks(data); showLink(data.publicId, data.published); syncCard({ publicId: data.publicId, published: data.published === true, kit }); status.textContent = publish ? "EPK published. Review the public link before sending it." : action === "unpublish" ? "EPK unpublished. Your draft is saved." : data.published ? "Draft saved. Venues still see your published EPK." : "Private draft saved."; window.danzstakEpkVersions?.show({ ...data, kit }); } catch (error) { status.textContent = error.message; } }
  async function updatePrivateShare(action) { const shareStatus = byId("privateShareStatus"); shareStatus.textContent = action === "create" ? "Creating a private review link..." : "Revoking the private review link..."; try { const response = await request(`${api}/epk/share`, { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({action}) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The private link could not be updated."); if (action === "create") { useShortLinks(data); const short = epkLink(data.publicId), href = short ? `${short}#token=${encodeURIComponent(data.token)}` : new URL(`epk.html?share=${encodeURIComponent(data.publicId)}#token=${encodeURIComponent(data.token)}`, location.href).href; showPrivateShare(true, href); syncCard({ publicId: data.publicId, privateShared: true }); shareStatus.textContent = "Private review link created. Copy it now; DanzStak does not show this secret again after you leave the page."; } else { showPrivateShare(false); shareStatus.textContent = "Private review link revoked."; syncCard({ privateShared: false }); } } catch (error) { shareStatus.textContent = error.message; } }
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
  const query = new URLSearchParams(location.search), publicId = query.get("id"), privateId = query.get("share"), outreachId = query.get("outreach"), versionId = query.get("version"), privateToken = new URLSearchParams(location.hash.slice(1)).get("token");
  if (publicId || privateId || outreachId || versionId) { document.body.classList.add("public-mode"); status.textContent = "Loading EPK..."; let endpoint = `${api}/epk/public/${encodeURIComponent(publicId || "")}`, options = { credentials:"omit", cache:"no-store" }; if (versionId) { /* spec 46: a version the owner published before, only they can open it */ endpoint = `${api}/epk?version=${encodeURIComponent(versionId)}`; options = { credentials:"include", cache:"no-store" }; } else if (privateId) { endpoint = `${api}/epk/shared/${encodeURIComponent(privateId)}`; options = { method:"POST", credentials:"omit", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({token:privateToken || ""}) }; } else if (outreachId) { let openId = sessionStorage.getItem(`danzstakEpkOpen:${outreachId}`); if (!openId) { openId = crypto.randomUUID(); sessionStorage.setItem(`danzstakEpkOpen:${outreachId}`, openId); } endpoint = `${api}/epk/outreach/${encodeURIComponent(outreachId)}`; options = { method:"POST", credentials:"omit", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({token:privateToken || "",openId}) }; }
    request(endpoint, options).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "EPK not found."); useShortLinks(data); render(data.kit); document.title = `${data.kit.artistName} EPK | DanzStak`; const actions = byId("publicEpkActions"), privateView = Boolean(privateId || outreachId || versionId || data.private); byId("copyEpkLink").hidden = privateView; byId("showEpkQr").hidden = privateView; const notice = byId("publicEpkNotice"); notice.hidden = false; if (data.bookingShare) { notice.textContent = data.disclosure || "Private booking EPK."; document.querySelectorAll(".epk-pdf-action").forEach(button => { button.hidden = data.permissions?.allowPdf !== true; }); } else if (versionId) { const date = window.danzstakEpkVersions?.when(data.publishedAt) || ""; notice.replaceChildren(document.createTextNode(date ? `The version you published on ${date}. Only you can see this page.` : "A version you published before. Only you can see this page."), " ", Object.assign(document.createElement("a"), { href: "epk.html", textContent: "Back to my EPK" }), " · ", Object.assign(document.createElement("a"), { href: `epk.html?restore=${encodeURIComponent(versionId)}`, textContent: "Bring back" })); document.querySelectorAll(".epk-pdf-action").forEach(button => { button.hidden = true; }); } else notice.textContent = data.private ? "Private EPK link." : "Published EPK."; actions.hidden = [...actions.children].every(control => control.hidden); if (publicId) window.danzstakEpkReviews?.load?.(publicId, data.kit); }).catch(error => { const notice = byId("publicEpkNotice"); notice.hidden = false; notice.textContent = error.message; preview.replaceChildren(text("p", error.message, "empty-note")); });
    const printEpk = mode => { document.body.dataset.epkPrint = mode; requestAnimationFrame(() => window.print()); };
    window.addEventListener("afterprint", () => { delete document.body.dataset.epkPrint; });
    byId("printEpkOnePage").addEventListener("click", () => printEpk("one-page"));
    byId("printEpk").addEventListener("click", () => printEpk("full"));
    byId("copyEpkLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(canonicalEpkUrl()); window.danzstakShowFeedback?.("EPK link copied."); } catch { window.danzstakShowFeedback?.("Copy was blocked. Select the address from your browser.", { urgent:true }); } });
    byId("showEpkQr").addEventListener("click", async () => {
      const dialog = byId("epkQrDialog"), qrStatus = byId("epkQrStatus"), button = byId("showEpkQr");
      button.disabled = true; qrStatus.textContent = "Building QR code...";
      try {
        const response = await request(`${api}/epk/qr`, { method:"POST", credentials:"omit", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({url:canonicalEpkUrl()}) });
        const svg = await response.text();
        if (!response.ok || svg.length > 200000 || !/^<svg[\s>]/.test(svg)) throw new Error("The QR code could not be created.");
        const dataUrl = await svgDataUrl(svg), artist = preview.querySelector(".epk-hero h1")?.textContent || "artist";
        byId("epkQrImage").src = dataUrl; byId("downloadEpkQr").href = dataUrl;
        byId("downloadEpkQr").download = `${artist.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "danzstak-epk"}-qr.svg`;
        qrStatus.textContent = "QR code ready.";
        if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
        byId("closeEpkQr").focus();
      } catch (error) { qrStatus.textContent = error.message; window.danzstakShowFeedback?.(error.message, { urgent:true }); }
      finally { button.disabled = false; }
    });
    byId("closeEpkQr").addEventListener("click", () => { const dialog = byId("epkQrDialog"); if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); });
    return; }
  window.danzstakEpkProduction?.init?.();
  window.danzstakEpkBuilder = { fill, request, api };
  setGuidedMode(true);
  request(`${api}/epk`, { credentials:"include", cache:"no-store" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Could not load your EPK."); if (data.kit) { fill(data.kit); setGuidedMode(false); } else { render({}); setGuidedMode(true); } useShortLinks(data); showLink(data.publicId, data.published); window.danzstakEpkVersions?.show(data); showPrivateShare(data.privateShared === true); syncCard({ publicId: data.publicId || "", published: data.published === true, privateShared: data.privateShared === true, shareCard: data.shareCard === true, shareCardOff: data.shareCardOff === true, shareCardSig: data.shareCardSig || "", kit: data.kit }); byId("privateShareStatus").textContent = data.privateShared ? "A private review link is active. Replace it to get a new secret or revoke access." : "No private review link is active."; status.textContent = data.kit ? (data.published ? "Published EPK loaded." : "Private draft loaded.") : "Start with the act name. Your draft is private."; window.danzstakEpkVersions?.restoreFromLink(); }).catch(error => { render({}); setGuidedMode(true); status.textContent = error.message; });
  for (const [role, publicField] of riderSlots) document.querySelector(`[data-rider-slot="${role}"] input[type=file]`)?.addEventListener("change", event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadRider(role, publicField, file); });
  const mediaInput = byId("epkMediaInput"), dropZone = byId("epkDropZone"); mediaInput.addEventListener("change", () => uploadFiles([...mediaInput.files])); for (const eventName of ["dragenter","dragover"]) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.add("is-dragging"); }); for (const eventName of ["dragleave","drop"]) dropZone.addEventListener(eventName, event => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }); dropZone.addEventListener("drop", event => uploadFiles([...event.dataTransfer.files]));
  window.danzstakEpkVideoCheck?.onChange(() => render(kitFromForm(true)));
  const cityList = byId("hometownCities");
  if (cityList && homeLooks()) cityList.replaceChildren(...homeLooks().CITIES.map(city => Object.assign(document.createElement("option"), { value: city.name })));
  form.addEventListener("change", event => { if (event.target.name === "hometownMode") { updateHometownControls(); render(kitFromForm(true)); if (event.target.value === "city") byId("hometownCity")?.focus(); } });
  form.addEventListener("input", event => { if (["hometown", "hometownCity"].includes(event.target.id)) updateHometownControls(); });
  updateHometownControls();
  form.addEventListener("input", event => { if (!event.target.closest(".epk-media-item")) render(kitFromForm(true)); updateGuide(); });
  form.addEventListener("epkproductionchange", () => render(kitFromForm(true)));
  byId("epkLook").addEventListener("change", () => render(kitFromForm(true)));
  byId("guideBack").addEventListener("click", () => setGuideStep(currentGuideStep - 1, true));
  byId("guideNext").addEventListener("click", () => { if (currentGuideStep < 5) setGuideStep(currentGuideStep + 1, true); else { byId("saveDraft").focus(); byId("saveDraft").scrollIntoView({ behavior:"smooth", block:"center" }); } });
  byId("showAllFields").addEventListener("click", () => setGuidedMode(!guidedMode, true));
  byId("toggleMobilePreview").addEventListener("click", () => setMobilePreview(!document.body.classList.contains("epk-preview-open")));
  byId("epkCardOn")?.addEventListener("change", event => syncCard({ shareCardOff: !event.target.checked }));
  byId("saveDraft").addEventListener("click", () => save("draft")); byId("publishEpk").addEventListener("click", () => save("publish")); byId("unpublishEpk").addEventListener("click", () => save("unpublish")); byId("deleteEpk").addEventListener("click", deleteEpk); byId("copyPublicLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(byId("publicLink").href); status.textContent = "Public EPK link copied."; } catch { status.textContent = "Copy was blocked. Select the visible link instead."; } }); byId("createPrivateLink").addEventListener("click", () => updatePrivateShare("create")); byId("revokePrivateLink").addEventListener("click", () => updatePrivateShare("revoke")); byId("copyPrivateLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(byId("privateLink").href); byId("privateShareStatus").textContent = "Private review link copied."; } catch { byId("privateShareStatus").textContent = "Copy was blocked. Select the visible link instead."; } });
})();
