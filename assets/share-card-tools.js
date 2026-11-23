"use strict";
// Link-preview card drawing shared by the profile card (profile-share-card.js) and the EPK card (epk-share-card.js): both
// are 1200x630 JPEGs drawn by the member's own browser from what the page already shows, under 300 KB.
(() => {
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

  // The same placement as the page: object-fit cover, the saved point (0-100%) and zoom (1-3).
  function drawCovered(context, image, x, y, w, h, px = 50, py = 50, zoom = 1) {
    const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
    const scale = Math.max(w / iw, h / ih) * Math.min(3, Math.max(1, Number(zoom) || 1));
    const dw = iw * scale, dh = ih * scale;
    const dx = x + (w - dw) * (Math.min(100, Math.max(0, Number(px) || 0)) / 100), dy = y + (h - dh) * (Math.min(100, Math.max(0, Number(py) || 0)) / 100);
    context.drawImage(image, dx, dy, dw, dh);
  }
  function fitText(context, text, maxWidth, size, min, weight, font = FONT) {
    let current = size;
    for (; current > min; current -= 2) { context.font = `${weight} ${current}px ${font}`; if (context.measureText(text).width <= maxWidth) return text; }
    context.font = `${weight} ${min}px ${font}`;
    let cut = text;
    while (cut.length > 1 && context.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut === text ? text : cut.trimEnd() + "…";
  }
  function roundRect(context, x, y, w, h, r) { context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + w, y, x + w, y + h, r); context.arcTo(x + w, y + h, x, y + h, r); context.arcTo(x, y + h, x, y, r); context.arcTo(x, y, x + w, y, r); context.closePath(); }


  // JPEG under the limit (WhatsApp skips bigger previews).
  async function jpeg(canvas, limit) {
    for (const quality of [0.86, 0.8, 0.72, 0.64, 0.56]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= limit) return blob;
    }
    throw new Error("The link preview is too large.");
  }

  window.danzstakCardTools = Object.freeze({ FONT, picture, drawCovered, fitText, roundRect, jpeg });
})();
