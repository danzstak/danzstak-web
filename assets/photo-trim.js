"use strict";
// Spec 46 SHOT (owner 2026-11-24/25: "when users upload a screen shot danzstak fixes their fotos", "we frame it and make
// it a proper photo and not a screenshot"). One plain-JS detector on RGBA pixels (no DOM), shared by the phone
// (media-scale.js, before the 720p scaling) and later by the server script that trims photos already on DanzStak.
//
//   danzstakPhotoTrim.find(rgba, width, height, { screenshot }) → { x, y, width, height, kind } | null
//     rgba: Uint8ClampedArray of a small copy (about 360 px wide); the result is in that copy's pixels.
//   danzstakPhotoTrim.looksLikeScreenshot({ type, name, width, height, camera, rgba, sw, sh }) → true | false
//
// "Only when sure": it returns null (keep the whole picture) for a text-only screen, more than one photo, a picture under
// 15 % of the screen or a crop that changes almost nothing. Without the screenshot signs it only trims flat, single-colour
// bars at the edges (letterboxing, padding), never into the picture.
(function (root) {
  const SCREENSHOT_NAME = /screen[\s_-]?shot|screenshot|schermata|capture|bildschirmfoto|captura|scherm|snapshot/i;

  // Share of pixels in a line whose colour differs from their neighbour: app backgrounds and text are mostly flat
  // (equal neighbours); a photo almost never is.
  function lineScores(rgba, width, height, vertical, from, to) {
    const count = vertical ? width : height, out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let changed = 0, total = 0, prev = -1;
      for (let j = from; j < to; j++) {
        const x = vertical ? i : j, y = vertical ? j : i, p = (y * width + x) * 4;
        const v = (rgba[p] >> 2) << 12 | (rgba[p + 1] >> 2) << 6 | (rgba[p + 2] >> 2);
        if (prev >= 0) { total++; if (v !== prev) changed++; }
        prev = v;
      }
      out[i] = total ? changed / total : 0;
    }
    return out;
  }
  // Runs of "photo" lines (score over the threshold), joining gaps of up to `gap` lines.
  function runs(scores, threshold, gap) {
    const found = [];
    let start = -1, last = -1;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= threshold) { if (start < 0 || i - last > gap + 1) { if (start >= 0) found.push([start, last]); start = i; } last = i; }
    }
    if (start >= 0) found.push([start, last]);
    return found.map(([a, b]) => ({ start: a, end: b, size: b - a + 1 })).sort((a, b) => b.size - a.size);
  }
  // Single-colour bars at the edges (black, white or any flat colour), measured line by line.
  function flatEdge(rgba, width, height, side) {
    const vertical = side === "left" || side === "right", lines = vertical ? width : height, span = vertical ? height : width;
    const pixel = (line, k) => { const x = vertical ? (side === "left" ? line : width - 1 - line) : k, y = vertical ? k : (side === "top" ? line : height - 1 - line), p = (y * width + x) * 4; return [rgba[p], rgba[p + 1], rgba[p + 2]]; };
    const [r0, g0, b0] = pixel(0, 0);
    let n = 0;
    for (; n < lines; n++) {
      let off = 0;
      for (let k = 0; k < span; k++) { const [r, g, b] = pixel(n, k); if (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) > 18) off++; }
      if (off > span * 0.01) break;
    }
    // A real bar ends at a sharp edge: the first line of the picture differs from the bar almost all the way across.
    // A dark or white photo fades out instead (smoke, sky, a night shot), so its edge is never cut.
    if (n > 0 && n < lines) {
      let off = 0;
      for (let k = 0; k < span; k++) { const [r, g, b] = pixel(n, k); if (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) > 18) off++; }
      if (off < span * 0.6) return 0;
    }
    return n;
  }

  function looksLikeScreenshot({ type = "", name = "", width = 0, height = 0, camera = false, rgba = null, sw = 0, sh = 0 } = {}) {
    let signs = 0;
    if (!camera) signs++;
    const named = /png/i.test(type) || SCREENSHOT_NAME.test(name), phoneShape = width && height ? height / width >= 1.9 : false;
    // One of these is a must: a downloaded picture or a wide share card (1.91:1) with dark edges is not a screenshot.
    if (!named && !phoneShape) return false;
    if (named) signs++;
    if (phoneShape) signs++;
    if (rgba && sw && sh) {
      // App chrome: flat bands at the very top and bottom (status bar, header, tab bar).
      const rows = lineScores(rgba, sw, sh, false, 0, sw), band = Math.max(2, Math.round(sh * 0.03));
      const flat = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += rows[i]; return s / (b - a) < 0.35; };
      if (flat(0, band) && flat(sh - band, sh)) signs++;
    }
    return signs >= 2;
  }

  function find(rgba, width, height, { screenshot = false } = {}) {
    if (!rgba || width < 32 || height < 32) return null;
    let box = null, kind = "";
    if (screenshot) {
      const rows = lineScores(rgba, width, height, false, 0, width);
      const rowRuns = runs(rows, 0.5, Math.max(2, Math.round(height * 0.012)));
      const best = rowRuns[0];
      if (!best || best.size < height * 0.12) return null;                       // a text-only screen
      if (rowRuns[1] && rowRuns[1].size > best.size * 0.5 && rowRuns[1].size > height * 0.08) return null; // two photos
      const cols = lineScores(rgba, width, height, true, best.start, best.end + 1);
      const colRuns = runs(cols, 0.5, Math.max(2, Math.round(width * 0.012)));
      const across = colRuns[0];
      if (!across || across.size < width * 0.25) return null;
      if (colRuns[1] && colRuns[1].size > across.size * 0.5 && colRuns[1].size > width * 0.12) return null; // side by side
      box = { x: across.start, y: best.start, width: across.size, height: best.size };
      kind = "screenshot";
    } else {
      box = { x: 0, y: 0, width, height };
    }
    // Then any flat bars left around the picture (black, white or one colour), on every photo.
    const sub = (b) => { const out = new Uint8ClampedArray(b.width * b.height * 4); for (let y = 0; y < b.height; y++) out.set(rgba.subarray(((b.y + y) * width + b.x) * 4, ((b.y + y) * width + b.x + b.width) * 4), y * b.width * 4); return out; };
    const inner = sub(box), cut = { top: flatEdge(inner, box.width, box.height, "top"), bottom: flatEdge(inner, box.width, box.height, "bottom"), left: flatEdge(inner, box.width, box.height, "left"), right: flatEdge(inner, box.width, box.height, "right") };
    // A flat bar only counts when it is a real bar (3 % or more) and the picture inside isn't flat itself.
    for (const side of ["top", "bottom"]) if (cut[side] < box.height * 0.03 || cut[side] >= box.height * 0.45) cut[side] = 0;
    for (const side of ["left", "right"]) if (cut[side] < box.width * 0.03 || cut[side] >= box.width * 0.45) cut[side] = 0;
    if (cut.top || cut.bottom || cut.left || cut.right) {
      box = { x: box.x + cut.left, y: box.y + cut.top, width: box.width - cut.left - cut.right, height: box.height - cut.top - cut.bottom };
      kind = kind || "borders";
    }
    if (!kind) return null;
    if (box.width * box.height < width * height * (kind === "screenshot" ? 0.15 : 0.3)) return null; // too small to be sure
    if (box.width * box.height > width * height * 0.97) return null;           // nothing worth trimming
    return { ...box, kind };
  }

  // JPEG with camera details (EXIF Make or Model in IFD0): a camera photo, never a screenshot.
  function hasCamera(bytes) {
    if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
    for (let i = 2; i + 4 < bytes.length && i < 131072;) {
      if (bytes[i] !== 0xff) return false;
      const marker = bytes[i + 1], length = bytes[i + 2] << 8 | bytes[i + 3];
      if (marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
        const t = i + 10, le = bytes[t] === 0x49, u16 = p => le ? bytes[p] | bytes[p + 1] << 8 : bytes[p] << 8 | bytes[p + 1];
        const u32 = p => le ? (bytes[p] | bytes[p + 1] << 8 | bytes[p + 2] << 16 | bytes[p + 3] << 24) >>> 0 : (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0;
        const ifd = t + u32(t + 4), entries = u16(ifd);
        for (let e = 0; e < entries && e < 200; e++) { const tag = u16(ifd + 2 + e * 12); if (tag === 0x010f || tag === 0x0110) return true; }
        return false;
      }
      if (marker === 0xda) return false;
      i += 2 + length;
    }
    return false;
  }

  const api = { find, looksLikeScreenshot, hasCamera };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.danzstakPhotoTrim = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
