"use strict";
// EPK link preview card (owner 2026-11-23: a private EPK link posted in Mix showed only "EPK Builder | DanzStak" — "Should
// have a preview" — then the builder's ALL ACCESS laminate: "Like this").
// The artist's own browser draws a 1200x630 JPEG from the EPK: on a dark ground, the laminate tilted in the middle square
// (Facebook's post box shows only that square): the ALL ACCESS band, the act's photo in grey, NAME, GENRE · HOME TOWN and
// the barcode; "EPK" and "Electronic press kit" to its left and the DanzStak mark to its right, where the full-width card
// shows them. It is uploaded like a profile picture and turned on with POST /epk/share-card; the server serves it at
// danzstak.com/e/<id>/card.jpg (infrastructure/auth-api/epk-share-preview.mjs).
(() => {
  const API = "https://api.danzstak.com", W = 1200, H = 630, LIMIT = 290 * 1024, VERSION = "epk-card-1";
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const tools = () => window.danzstakCardTools;

  const firstGenre = kit => String((Array.isArray(kit.genres) ? kit.genres[0] : String(kit.genres || "").split(",")[0]) || "").trim();
  const line = kit => [firstGenre(kit), String(kit.hometown || "").trim()].filter(Boolean).join(" · ");
  const photoUrl = kit => /^https:\/\/[^\s"'()\\]+$/i.test(String(kit.heroImage || "")) ? kit.heroImage : "";

  // What the card is drawn from; a change means a new card.
  async function signature(kit) {
    const source = JSON.stringify([VERSION, String(kit.artistName || "").trim(), firstGenre(kit), String(kit.hometown || "").trim(), photoUrl(kit)]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function draw(kit) {
    const { FONT, picture, drawCovered, fitText, roundRect, jpeg } = tools();
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const context = canvas.getContext("2d");
    try { await Promise.all([document.fonts.load(`900 64px ${FONT}`), document.fonts.load(`700 24px ${MONO}`)]); } catch { /* the system font draws it */ }
    const [photo, mark] = await Promise.all([picture(photoUrl(kit)), picture(new URL("assets/danzstak-d-icon.png", location.href).href)]);
    // Ground: backstage black, a warm glow behind the pass, the hazard-orange rule along the bottom.
    context.fillStyle = "#0b0b0c"; context.fillRect(0, 0, W, H);
    const glow = context.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 420);
    glow.addColorStop(0, "rgba(255,90,31,.28)"); glow.addColorStop(1, "rgba(255,90,31,0)");
    context.fillStyle = glow; context.fillRect(0, 0, W, H);
    context.fillStyle = "#ff5a1f"; context.fillRect(0, H - 8, W, 8);

    // Left: EPK / Electronic press kit.
    context.textAlign = "left"; context.textBaseline = "alphabetic"; context.fillStyle = "#f5f5f2";
    context.font = `900 128px ${FONT}`; context.fillText("EPK", 52, 330);
    context.fillStyle = "#ff5a1f"; context.font = `700 22px ${MONO}`;
    context.fillText("ELECTRONIC", 56, 378); context.fillText("PRESS KIT", 56, 408);

    // Right: the DanzStak mark.
    if (mark) context.drawImage(mark, 948, 250, 64, 64);
    context.fillStyle = "#f5f5f2"; context.font = `800 34px ${FONT}`; context.textBaseline = "middle"; context.fillText("DanzStak", 1022, 283);
    context.fillStyle = "#9aa0a6"; context.font = `500 20px ${MONO}`; context.fillText("danzstak.com", 952, 346);

    // Middle: the laminate, as in the builder (epk-skin.css .epk-laminate), tilted 3 degrees.
    const lw = 300, lh = 476, inner = 256, pad = (lw - inner) / 2;
    context.save();
    context.translate(W / 2, H / 2 + 6); context.rotate(3 * Math.PI / 180); context.translate(-lw / 2, -lh / 2);
    context.shadowColor = "rgba(0,0,0,.6)"; context.shadowBlur = 40; context.shadowOffsetY = 18;
    context.fillStyle = "#e9e9e4"; roundRect(context, 0, 0, lw, lh, 18); context.fill();
    context.shadowColor = "transparent";
    context.fillStyle = "#0b0b0c"; roundRect(context, lw / 2 - 33, 14, 66, 12, 6); context.fill();
    context.fillStyle = "#ff5a1f"; context.fillRect(0, 42, lw, 44);
    context.fillStyle = "#0b0b0c"; context.font = `700 22px ${MONO}`; context.textBaseline = "middle"; context.textAlign = "left";
    if ("letterSpacing" in context) context.letterSpacing = "5px";
    context.fillText("ALL ACCESS", pad, 65);
    if ("letterSpacing" in context) context.letterSpacing = "0px";
    const py = 102, ph = inner * 3 / 4;
    context.fillStyle = "#0b0b0c"; context.fillRect(pad, py, inner, ph);
    if (photo) {
      context.save(); context.beginPath(); context.rect(pad, py, inner, ph); context.clip();
      context.filter = "grayscale(1) contrast(1.1)"; drawCovered(context, photo, pad, py, inner, ph); context.filter = "none";
      context.restore();
    } else {
      context.fillStyle = "#5a5a5f"; context.font = `700 16px ${MONO}`; context.textAlign = "center"; context.fillText("PHOTO", lw / 2, py + ph / 2); context.textAlign = "left";
    }
    context.fillStyle = "#0b0b0c"; context.textBaseline = "alphabetic";
    const name = String(kit.artistName || "").trim().toUpperCase() || "YOUR ACT";
    context.fillText(fitText(context, name, inner, 40, 22, 900), pad, py + ph + 50);
    const meta = line(kit).toUpperCase();
    if (meta) { context.fillStyle = "#3a3a3a"; context.fillText(fitText(context, meta, inner, 18, 13, 500, MONO), pad, py + ph + 82); }
    // The barcode.
    context.fillStyle = "#0b0b0c";
    for (let x = 0, i = 0; x < inner; i += 1) { const width = [2, 1, 3, 1, 2, 2][i % 6]; context.fillRect(pad + x, lh - 56, width, 34); x += width + [2, 3, 2, 1, 3, 2][i % 6]; }
    context.restore();
    return jpeg(canvas, LIMIT);
  }

  async function post(body) {
    const response = await fetch(API + "/epk/share-card", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(window.danzstakEpkLibrary?.body(body) || body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The link preview couldn't be saved.");
    return data;
  }
  // Draw, upload and turn on the card. Returns the server's answer ({ shareCard, shareCardSig, shareUrl }) and the picture.
  async function publish(kit) {
    const [blob, sig] = await Promise.all([draw(kit), signature(kit)]);
    const ticketResponse = await fetch(API + "/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: "image/jpeg", purpose: "profile" }) });
    const ticket = await ticketResponse.json().catch(() => ({}));
    if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "The link preview couldn't be saved.");
    const upload = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
    if (!upload.ok) throw new Error("The link preview couldn't be saved.");
    try { return { ...(await post({ mediaKey: ticket.mediaKey, sig })), blob }; }
    catch (error) {
      fetch(API + "/stories", { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard", mediaKey: ticket.mediaKey }) }).catch(() => {});
      throw error;
    }
  }
  const turnOff = () => post({ off: true });

  window.danzstakEpkCard = Object.freeze({ draw, signature, publish, turnOff });
})();
