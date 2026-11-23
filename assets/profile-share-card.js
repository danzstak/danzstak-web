"use strict";
// SHARE (owner 2026-11-21, spec 44): "When a user share their profile it should show just like the image I uploaded."
// The member's own browser draws their link-preview card (1200x630 JPEG under 300 KB) from the profile it already shows:
// the cover across the top (where they placed it), the round profile picture overlapping it, the name in bold under it,
// the @username, up to four shop photos, and a small DanzStak mark. It is uploaded like any profile picture and the
// server serves it at danzstak.com/u/username/card.jpg, only while the member keeps "Show my photo and name in link
// previews" on. It is drawn again when the profile changes (a signature of what it was drawn from).
(() => {
  const API = "https://api.danzstak.com", W = 1200, H = 630, COVER = 330, SAFE_X = (W - H) / 2, LIMIT = 290 * 1024, VERSION = "card-4";
  // Shared with the EPK card (epk-share-card.js): reading pictures, cover placement, fitted text, rounded boxes, JPEG.
  const { FONT, picture, drawCovered, fitText, roundRect, jpeg } = window.danzstakCardTools;

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
    return jpeg(canvas, LIMIT);
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
