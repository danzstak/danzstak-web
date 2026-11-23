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
  async function decodeWithImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.decoding = "async"; image.src = url;
      await image.decode();
      return image;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
  // Owner 2026-11-22 ("Some how we lost the profile picture"): a profile picture was saved cut off, a JPEG whose end never
  // arrived (the phone handed over a photo that hadn't finished downloading). createImageBitmap refuses such a photo while
  // an <img> still shows its top part, so it used to upload as it was. It is stopped here, on every picker.
  async function open(file) {
    if (typeof createImageBitmap !== "function") return { source: await decodeWithImage(file) };
    try { return { source: await createImageBitmap(file, { imageOrientation: "from-image" }) }; } catch {}
    try { return { source: await createImageBitmap(file) }; } catch { return { broken: true }; }
  }
  // { file } to upload (scaled when asked), or { file, broken: true } for a photo the browser can't fully read.
  async function prepare(file, scale = true) {
    if (!scalable(file)) return { file };
    let opened;
    try { opened = await open(file); } catch { return { file }; }
    if (opened.broken) return { file, broken: true };
    const source = opened.source, width = source.width || source.naturalWidth, height = source.height || source.naturalHeight;
    if (!scale || !width || !height) { source.close?.(); return { file }; }
    const size = targetSize(width, height);
    if (size.scale >= 1) { source.close?.(); return { file }; }
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);
    source.close?.();
    // PNG keeps transparency; JPEG and WebP stay their own type so the upload ticket's content type still matches.
    const type = file.type.toLowerCase() === "image/png" ? "image/png" : file.type.toLowerCase();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
    if (!blob || blob.size >= file.size) return { file };
    return { file: new File([blob], file.name, { type, lastModified: file.lastModified }) };
  }
  async function scaleImage(file) { return (await prepare(file)).file; }
  const BROKEN = "This photo didn't finish loading on your phone. Open it in your gallery, then pick it again.";
  function tellBroken() {
    const host = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
    let note = document.getElementById("danzstakPhotoNotice");
    if (!note) {
      note = document.createElement("p"); note.id = "danzstakPhotoNotice"; note.setAttribute("role", "status"); note.setAttribute("aria-live", "polite");
      Object.assign(note.style, { position: "fixed", left: "16px", right: "16px", bottom: "calc(88px + env(safe-area-inset-bottom))", zIndex: "2147483000", maxWidth: "520px", margin: "0 auto", padding: "12px 16px", borderRadius: "14px", background: "#0b0b0c", color: "#ffffff", font: "600 15px/1.4 system-ui, sans-serif", textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,.28)" });
    }
    if (note.parentNode !== host) host.append(note);
    note.textContent = globalThis.danzstakTranslate?.(BROKEN) || BROKEN; note.hidden = false;
    clearTimeout(tellBroken.timer); tellBroken.timer = setTimeout(() => { note.hidden = true; }, 7000);
  }

  const replaying = new WeakSet();
  document.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || replaying.has(input)) return;
    if (!input.files?.length || ![...input.files].some(scalable)) return;
    if (typeof DataTransfer !== "function") return;
    // Hold the page's own handler until the photos are checked (and scaled, unless the input has data-no-scale), then
    // hand it the photos that can be read, with a fresh change event. A photo that can't be read never reaches it.
    const scale = !input.hasAttribute("data-no-scale");
    event.stopImmediatePropagation();
    input.setAttribute("aria-busy", "true");
    Promise.all([...input.files].map(file => prepare(file, scale).catch(() => ({ file })))).then(results => {
      const good = results.filter(result => !result.broken).map(result => result.file);
      if (good.length < results.length) tellBroken();
      if (!good.length) { input.value = ""; return false; }
      try { const transfer = new DataTransfer(); good.forEach(file => transfer.items.add(file)); input.files = transfer.files; } catch {}
      return true;
    }, () => true).then(replay => {
      input.removeAttribute("aria-busy");
      if (!replay) return;
      replaying.add(input);
      try { input.dispatchEvent(new Event("change", { bubbles: true })); } finally { replaying.delete(input); }
    });
  }, true);

  globalThis.danzstakMediaScale = { scaleImage, targetSize };
})();
