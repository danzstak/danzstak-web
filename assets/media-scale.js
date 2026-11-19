"use strict";
// Owner 2026-11-19: "I need all the video and images scaled to 720p for faster load time" — "vertical and horizontal
// scaling for the boxes". Every photo a member picks is scaled down in the phone before it uploads, so the box it lands
// in loads fast: landscape fits 1280×720, portrait fits 720×1280 (720p either way), never scaled up. One shared hook for
// every file picker on the page (Mix, profile, Tribes, SYNC, EPK, events): it runs before the page's own change handler
// and hands that handler the smaller file. GIFs (animation), HEIC the browser can't draw, and non-images pass through
// untouched; an input can opt out with data-no-scale. Videos are scaled on the server (see docs/tasks/37-media-720p.md).
(() => {
  if (globalThis.danzstakMediaScale) return;
  const LONG = 1280, SHORT = 720, QUALITY = 0.82;
  const scalable = file => file instanceof File && /^image\/(jpeg|png|webp)$/i.test(file.type);
  // Box for this photo: 1280×720 when it is wider than tall, 720×1280 when it is taller (720p in both directions).
  function targetSize(width, height) {
    const [maxW, maxH] = width >= height ? [LONG, SHORT] : [SHORT, LONG];
    const scale = Math.min(1, maxW / width, maxH / height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  }
  async function decode(file) {
    if (typeof createImageBitmap === "function") {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.decoding = "async"; image.src = url;
      await image.decode();
      return image;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
  async function scaleImage(file) {
    if (!scalable(file)) return file;
    let source;
    try { source = await decode(file); } catch { return file; }
    const width = source.width || source.naturalWidth, height = source.height || source.naturalHeight;
    if (!width || !height) return file;
    const size = targetSize(width, height);
    if (size.scale >= 1) { source.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);
    source.close?.();
    // PNG keeps transparency; JPEG and WebP stay their own type so the upload ticket's content type still matches.
    const type = file.type.toLowerCase() === "image/png" ? "image/png" : file.type.toLowerCase();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type, lastModified: file.lastModified });
  }
  async function scaleFiles(files) { return Promise.all([...files].map(file => scaleImage(file).catch(() => file))); }

  const replaying = new WeakSet();
  document.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || replaying.has(input)) return;
    if (input.hasAttribute("data-no-scale") || !input.files?.length || ![...input.files].some(scalable)) return;
    if (typeof DataTransfer !== "function") return;
    // Hold the page's own handler until the smaller photos are ready, then hand them over with a fresh change event.
    event.stopImmediatePropagation();
    input.setAttribute("aria-busy", "true");
    scaleFiles(input.files).then(files => {
      try { const transfer = new DataTransfer(); files.forEach(file => transfer.items.add(file)); input.files = transfer.files; } catch {}
    }).finally(() => {
      input.removeAttribute("aria-busy");
      replaying.add(input);
      try { input.dispatchEvent(new Event("change", { bubbles: true })); } finally { replaying.delete(input); }
    });
  }, true);

  globalThis.danzstakMediaScale = { scaleImage, targetSize };
})();
