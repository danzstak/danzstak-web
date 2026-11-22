"use strict";
// SHARE (owner 2026-11-21, spec 44): "When a user share their profile it should show just like the image I uploaded."
// The member's own browser draws their link-preview card (1200x630 JPEG under 300 KB) from the profile it already shows:
// the cover across the top (where they placed it), the round profile picture overlapping it, the name in bold under it,
// the @username, up to four shop photos, and a small DanzStak mark. It is uploaded like any profile picture and the
// server serves it at danzstak.com/u/username/card.jpg, only while the member keeps "Show my photo and name in link
// previews" on. It is drawn again when the profile changes (a signature of what it was drawn from).
(() => {
  const API = "https://api.danzstak.com", W = 1200, H = 630, COVER = 330, SAFE_X = (W - H) / 2, LIMIT = 290 * 1024, VERSION = "card-4";
  const FONT = '"DanzStak Sans", Archivo, system-ui, sans-serif';

  // Pictures are read with fetch (CORS) so the canvas is never tainted; a picture that can't be read is left out. Never from
  // the HTTP cache: the page's own <img> loaded them without CORS, and a cached copy has no CORS headers to show.
  async function picture(url) {
    if (!url) return null;
    let blob;
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!response.ok) return null;
      blob = await response.blob();
    } catch { return null; }
    try { return await createImageBitmap(blob); }
    catch { return repairedJpeg(blob); }
  }
  // A JPEG that was cut off on upload (the owner's own profile picture, 2026-11-22: 21 KB, no end marker) shows on the page,
  // because an <img> draws what it can, but createImageBitmap refuses it. Drawing it through an <img> worked on a computer
  // and left an empty white circle on the owner's Android phone (a picture that isn't fully decodable draws nothing on a
  // canvas). Adding the missing end marker lets the browser decode the part that arrived, the same as the page shows.
  async function repairedJpeg(blob) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer()), end = bytes.length;
      if (end < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || (bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9)) return null;
      return await createImageBitmap(new Blob([bytes, new Uint8Array([0xff, 0xd9])], { type: "image/jpeg" }));
    } catch { return null; }
  }
  // The round photo is the picture or the letter, never an empty circle: the photo is drawn on its own layer first and only
  // used when something was drawn.
  function faceLayer(avatar, size) {
    if (!avatar) return null;
    const layer = document.createElement("canvas"); layer.width = layer.height = size;
    const context = layer.getContext("2d");
    drawCovered(context, avatar, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    for (let at = 3; at < pixels.length; at += 4 * 61) if (pixels[at]) return layer;
    return null;
  }
  // The same placement as the page: object-fit cover, the saved point (0-100%) and zoom (1-3).
  function drawCovered(context, image, x, y, w, h, px = 50, py = 50, zoom = 1) {
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    const scale = Math.max(w / iw, h / ih) * Math.min(3, Math.max(1, Number(zoom) || 1));
    const dw = iw * scale, dh = ih * scale;
    const dx = x + (w - dw) * (Math.min(100, Math.max(0, Number(px) || 0)) / 100), dy = y + (h - dh) * (Math.min(100, Math.max(0, Number(py) || 0)) / 100);
    context.drawImage(image, dx, dy, dw, dh);
  }
  function fitText(context, text, maxWidth, size, min, weight) {
    let current = size;
    for (; current > min; current -= 2) { context.font = `${weight} ${current}px ${FONT}`; if (context.measureText(text).width <= maxWidth) return text; }
    context.font = `${weight} ${min}px ${FONT}`;
    let cut = text;
    while (cut.length > 1 && context.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut === text ? text : cut.trimEnd() + "…";
  }
  function roundRect(context, x, y, w, h, r) { context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + w, y, x + w, y + h, r); context.arcTo(x + w, y + h, x, y + h, r); context.arcTo(x, y + h, x, y, r); context.arcTo(x, y, x + w, y, r); context.closePath(); }

  async function shopPhotos(profile) {
    if (profile.isOwner !== true) return [];
    try {
      const response = await fetch(API + "/marketplace/shop", { credentials: "include", cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json().catch(() => ({}));
      return (data.shop?.products || []).filter(item => item.available && item.imageUrl).slice(0, 4);
    } catch { return []; }
  }

  // What the card is drawn from; a change means a new card.
  async function signature(profile, items) {
    const source = JSON.stringify([VERSION, profile.name, profile.handle, profile.bio, profile.avatarKey, profile.coverKey, profile.coverX, profile.coverY, profile.coverZoom, items.map(item => item.id)]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function draw(profile, items) {
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const context = canvas.getContext("2d");
    try { await Promise.all([document.fonts.load(`800 64px ${FONT}`), document.fonts.load(`500 28px ${FONT}`)]); } catch { /* the system font draws it */ }
    const [cover, avatar, mark, ...shop] = await Promise.all([picture(profile.cover), picture(profile.picture), picture(new URL("assets/danzstak-d-icon.png", location.href).href), ...items.map(item => picture(item.imageUrl))]);
    // The page: white below the cover, a thin hazard-orange rule along the bottom.
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, W, H);
    if (cover) { context.save(); context.beginPath(); context.rect(0, 0, W, COVER); context.clip(); drawCovered(context, cover, 0, 0, W, COVER, profile.coverX, profile.coverY, profile.coverZoom); context.restore(); }
    else { const ground = context.createLinearGradient(0, 0, W, COVER); ground.addColorStop(0, "#0b0b0c"); ground.addColorStop(1, "#2a1206"); context.fillStyle = ground; context.fillRect(0, 0, W, COVER); }
    context.fillStyle = "#ff5a1f"; context.fillRect(0, H - 8, W, 8);
    // Owner 2026-11-22 ("Sizing changed"): Facebook's post box shows only the middle square of the card, so the photo, the
    // name, the @username, the bio and the mark sit in that square (SAFE_X to W - SAFE_X); the shop photos sit outside it,
    // where the full-width card in the feed shows them.
    const size = 210, cx = W / 2, safe = H - 60, ax = cx - size / 2, ay = COVER - size / 2;
    context.fillStyle = "#ffffff"; context.beginPath(); context.arc(cx, COVER, size / 2 + 10, 0, Math.PI * 2); context.fill();
    context.save(); context.beginPath(); context.arc(cx, COVER, size / 2, 0, Math.PI * 2); context.clip();
    const face = faceLayer(avatar, size);
    if (face) context.drawImage(face, ax, ay);
    else { context.fillStyle = "#121418"; context.fillRect(ax, ay, size, size); context.fillStyle = "#ff5a1f"; context.font = `800 100px ${FONT}`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(String(profile.name || "D").trim().charAt(0).toUpperCase() || "D", cx, COVER + 6); }
    context.restore();
    // Up to four shop photos in the white band, two each side of the middle square, right first.
    const tile = 112, gap = 12, edge = 24, top = COVER + (H - 8 - COVER - tile) / 2;
    const slots = [W - SAFE_X + edge, SAFE_X - edge - tile, W - SAFE_X + edge + tile + gap, SAFE_X - edge - 2 * tile - gap];
    shop.filter(Boolean).slice(0, 4).forEach((image, index) => { const x = slots[index]; context.save(); roundRect(context, x, top, tile, tile, 14); context.clip(); drawCovered(context, image, x, top, tile, tile); context.restore(); context.strokeStyle = "#e3e5e8"; context.lineWidth = 2; roundRect(context, x, top, tile, tile, 14); context.stroke(); });
    // The name in bold under the picture, then the @username and a one-line bio, centred.
    context.textAlign = "center"; context.textBaseline = "alphabetic"; context.fillStyle = "#0b0b0c";
    context.fillText(fitText(context, String(profile.name || "").trim() || "DanzStak", safe, 60, 36, 800), cx, COVER + size / 2 + 74);
    if (profile.handle) { context.fillStyle = "#5f6368"; context.fillText(fitText(context, "@" + profile.handle, safe, 28, 22, 500), cx, COVER + size / 2 + 116); }
    const bio = String(profile.bio || "").replace(/\s+/g, " ").trim();
    if (bio) { context.fillStyle = "#30343a"; context.fillText(fitText(context, bio, safe, 24, 24, 500), cx, H - 30); }
    // A small DanzStak mark on the cover, at the top right of the middle square.
    const markX = W - SAFE_X - 24 - 196;
    context.save(); context.globalAlpha = 0.92; context.fillStyle = "#0b0b0c"; roundRect(context, markX, 24, 196, 56, 28); context.fill(); context.restore();
    if (mark) context.drawImage(mark, markX + 8, 32, 40, 40);
    context.textAlign = "left"; context.fillStyle = "#ffffff"; context.font = `800 26px ${FONT}`; context.textBaseline = "middle"; context.fillText("DanzStak", markX + 56, 53);
    // JPEG under the limit (WhatsApp skips bigger previews).
    for (const quality of [0.86, 0.8, 0.72, 0.64, 0.56]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= LIMIT) return blob;
    }
    throw new Error("The link preview is too large.");
  }

  async function saveProfile(body) {
    const response = await fetch(API + "/profiles", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The link preview couldn't be saved.");
    // The server leaves out empty fields, so the share fields are set explicitly (an old @ link must not outlive the card).
    if (data.profile) { const { shareUrl, shareCard, shareCardSig } = data.profile; window.danzstakCurrentProfile = { ...window.danzstakCurrentProfile, ...data.profile, shareUrl, shareCard, shareCardSig }; window.dispatchEvent(new CustomEvent("danzstak:share-card", { detail: data.profile })); }
    return data.profile || null;
  }

  // Draw, upload and save the card (and turn it on). Returns { profile, blob }.
  async function publish(profile, { turnOn = false, items = null } = {}) {
    items = items || await shopPhotos(profile);
    const blob = await draw(profile, items), sig = await signature(profile, items);
    const ticketResponse = await fetch(API + "/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: "image/jpeg", purpose: "profile" }) });
    const ticket = await ticketResponse.json().catch(() => ({}));
    if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "The link preview couldn't be saved.");
    const upload = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
    if (!upload.ok) throw new Error("The link preview couldn't be saved.");
    try { return { profile: await saveProfile({ ...(turnOn ? { shareCard: true } : {}), shareCardKey: ticket.mediaKey, shareCardSig: sig }), blob }; }
    catch (error) {
      fetch(API + "/stories", { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard", mediaKey: ticket.mediaKey }) }).catch(() => {});
      throw error;
    }
  }
  const turnOff = () => saveProfile({ shareCard: false });
  // The share sheet on the member's own profile: a card that is on and up to date is only drawn for the preview; otherwise
  // it is drawn, uploaded and turned on.
  async function ready(profile) {
    const items = await shopPhotos(profile);
    if (profile.shareCard === true && profile.shareUrl && await signature(profile, items) === profile.shareCardSig) return { profile, blob: await draw(profile, items) };
    return publish(profile, { turnOn: profile.shareCard !== true, items });
  }

  // The member's own profile: keep a card that's on up to date with the profile it was drawn from.
  let refreshing = null;
  async function refresh(profile = window.danzstakCurrentProfile) {
    if (!profile || profile.isOwner !== true || profile.shareCard !== true || refreshing) return;
    refreshing = (async () => {
      const items = await shopPhotos(profile);
      if (await signature(profile, items) === profile.shareCardSig) return;
      await publish(profile, { items });
    })().catch(() => {}).finally(() => { refreshing = null; });
  }
  window.addEventListener("danzstak:profile-loaded", () => { const later = window.requestIdleCallback || (run => setTimeout(run, 1500)); later(() => refresh()); });

  window.danzstakShareCard = { draw, signature, publish, ready, turnOff, refresh };
})();
