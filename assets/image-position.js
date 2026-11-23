"use strict";
// Directive F12 (owner 2026-11-19): "on all pictures I should be able to move them around to fit them in the box."
// One shared component for every picture a member places (profile cover, profile picture, the photo under the name,
// Tribe cover). open() shows the picture inside a preview of the exact box it lives in: drag to move it, pinch / the
// slider / the mouse wheel to zoom, Save. A position is { x, y, zoom }: x and y are the picture's point that lines up
// with the same point of the box, in percent (the meaning of CSS object-position / background-position), zoom 1–3.
// apply() draws a picture with a position, crop() turns one into a square JPEG (profile pictures appear in many small
// places, so they are saved cropped), remember()/recall() keep a position on this phone when the server can't yet.
(() => {
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const number = (value, fallback) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value));
  const round = value => Math.round(value * 100) / 100;
  const normalize = position => ({
    x: round(clamp(number(position?.x, 50), 0, 100)),
    y: round(clamp(number(position?.y, 50), 0, 100)),
    zoom: round(clamp(number(position?.zoom, 1), 1, 3))
  });
  const t = text => (typeof window.danzstakTranslate === "function" ? window.danzstakTranslate(text) : text) || text;

  // Natural size of a picture (cached by URL).
  const sizes = new Map();
  function naturalSize(url) {
    if (!url) return Promise.reject(new Error("no picture"));
    if (!sizes.has(url)) sizes.set(url, new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = "async"; image.referrerPolicy = "no-referrer";
      image.onload = () => (image.naturalWidth && image.naturalHeight ? resolve({ w: image.naturalWidth, h: image.naturalHeight }) : reject(new Error("empty picture")));
      image.onerror = () => { sizes.delete(url); reject(new Error("picture failed to load")); };
      image.src = url;
    }));
    return sizes.get(url);
  }
  const backgroundUrl = element => {
    const match = /url\((["']?)(.*?)\1\)/.exec(element.style.backgroundImage || getComputedStyle(element).backgroundImage || "");
    return match ? match[2] : "";
  };

  // Background pictures with a zoom need their size in pixels (CSS has no "cover × 1.4"), so they are re-measured when
  // their box changes size.
  const zoomed = new WeakMap();
  let resizer = null;
  function sizeBackground(element) {
    const info = zoomed.get(element), box = element.getBoundingClientRect();
    if (!info || !box.width || !box.height) return;
    const scale = Math.max(box.width / info.w, box.height / info.h) * info.zoom;
    element.style.backgroundSize = `${Math.ceil(info.w * scale)}px ${Math.ceil(info.h * scale)}px`;
  }
  function apply(element, position, url) {
    if (!element) return;
    const p = normalize(position);
    if (element.tagName === "IMG") {
      // The caller's box clips it (overflow hidden); the zoom grows around the chosen point so that point stays put.
      element.style.objectFit = "cover";
      element.style.objectPosition = `${p.x}% ${p.y}%`;
      element.style.transformOrigin = `${p.x}% ${p.y}%`;
      element.style.transform = p.zoom > 1 ? `scale(${p.zoom})` : "";
      return;
    }
    element.style.backgroundPosition = `${p.x}% ${p.y}%`;
    element.style.backgroundRepeat = "no-repeat";
    if (p.zoom <= 1) { zoomed.delete(element); resizer?.unobserve(element); element.style.backgroundSize = "cover"; return; }
    const source = url || backgroundUrl(element);
    naturalSize(source).then(({ w, h }) => {
      zoomed.set(element, { w, h, zoom: p.zoom });
      resizer ||= new ResizeObserver(entries => entries.forEach(entry => sizeBackground(entry.target)));
      resizer.observe(element);
      sizeBackground(element);
    }).catch(() => { element.style.backgroundSize = "cover"; });
  }

  // A position kept on this phone until the server stores it (keyed by the picture's address without its signature).
  const LOCAL_KEY = "danzstak_picture_positions";
  // The path alone, so the same picture matches through the media bucket and the CDN.
  const pictureKey = url => { try { const parsed = new URL(url, location.href); return /^(blob|data):$/.test(parsed.protocol) ? "" : parsed.pathname; } catch { return ""; } };
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; } catch { return {}; } };
  function remember(url, position) {
    const key = pictureKey(url); if (!key) return;
    const all = readLocal(); all[key] = normalize(position);
    const keys = Object.keys(all); for (const old of keys.slice(0, Math.max(0, keys.length - 40))) delete all[old];
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch { /* optional */ }
  }
  function recall(url) { const key = pictureKey(url); const found = key ? readLocal()[key] : null; return found ? normalize(found) : null; }

  // Draw a position into a JPEG of the given box (default a 1080px square).
  async function crop(source, position, { aspect = 1, size = 1080, type = "image/jpeg", quality = 0.9 } = {}) {
    const blob = source instanceof Blob ? source : await (await fetch(source, { mode: "cors", credentials: "omit", cache: "reload" })).blob();
    const bitmap = await createImageBitmap(blob), p = normalize(position);
    const width = aspect >= 1 ? size : Math.round(size * aspect), height = aspect >= 1 ? Math.round(size / aspect) : size;
    const scale = Math.max(width / bitmap.width, height / bitmap.height) * p.zoom, drawW = bitmap.width * scale, drawH = bitmap.height * scale;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); context.fillStyle = "#0b0b0c"; context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, -(drawW - width) * p.x / 100, -(drawH - height) * p.y / 100, drawW, drawH);
    bitmap.close?.();
    return await new Promise((resolve, reject) => canvas.toBlob(out => (out ? resolve(out) : reject(new Error("encode"))), type, quality));
  }

  const words = {
    title: "Move to fit", save: "Save", cancel: "Cancel", hint: "Drag to move. Pinch or slide to zoom.",
    zoom: "Zoom", zoomIn: "Zoom in", zoomOut: "Zoom out", area: "Picture position. Drag, or use the arrow keys and + or −.",
    failed: "This picture couldn't be opened. Try another one."
  };
  let sheet = null, active = null;
  function build() {
    sheet = document.createElement("dialog");
    sheet.className = "ds-fit-sheet";
    sheet.setAttribute("aria-labelledby", "dsFitTitle");
    sheet.innerHTML = '<header class="ds-fit-bar"><button type="button" class="ds-fit-cancel"></button><h2 id="dsFitTitle"></h2><button type="button" class="ds-fit-save"></button></header>'
      + '<div class="ds-fit-stage"><div class="ds-fit-box" tabindex="0" role="group"><img class="ds-fit-image" alt="" draggable="false"><span class="ds-fit-grid" aria-hidden="true"></span></div></div>'
      + '<div class="ds-fit-extras" aria-hidden="true"></div>'
      + '<div class="ds-fit-zoom"><button type="button" class="ds-fit-step" data-step="-0.2">−</button><input type="range" class="ds-fit-range" min="1" max="3" step="0.01"><button type="button" class="ds-fit-step" data-step="0.2">+</button></div>'
      + '<p class="ds-fit-hint"></p>';
    document.body.append(sheet);
    const box = sheet.querySelector(".ds-fit-box"), range = sheet.querySelector(".ds-fit-range");
    sheet.querySelector(".ds-fit-cancel").addEventListener("click", () => finish(null));
    sheet.querySelector(".ds-fit-save").addEventListener("click", () => finish(active ? normalize(active.position) : null));
    sheet.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
    range.addEventListener("input", () => setZoom(Number(range.value)));
    for (const button of sheet.querySelectorAll(".ds-fit-step")) button.addEventListener("click", () => setZoom((active?.position.zoom || 1) + Number(button.dataset.step)));
    const pointers = new Map();
    let pan = null, pinch = null;
    box.addEventListener("pointerdown", event => {
      if (!active) return;
      event.preventDefault();
      box.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      box.classList.add("is-moving");
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: active.position.zoom }; pan = null;
      } else if (pointers.size === 1) pan = { x: event.clientX, y: event.clientY, from: { ...active.position } };
    });
    box.addEventListener("pointermove", event => {
      if (!active || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        setZoom(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      } else if (pan) move(pan.from, event.clientX - pan.x, event.clientY - pan.y);
    });
    const release = event => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1 && active) { const [only] = [...pointers.values()]; pan = { x: only.x, y: only.y, from: { ...active.position } }; }
      if (!pointers.size) { pan = null; box.classList.remove("is-moving"); }
    };
    box.addEventListener("pointerup", release);
    box.addEventListener("pointercancel", release);
    // The box is only ever dragged: no page scroll or fling may start from it (a fast flick would otherwise turn the next
    // tap, e.g. Save, into "stop the fling" instead of a click).
    box.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
    box.addEventListener("wheel", event => { if (!active) return; event.preventDefault(); setZoom(active.position.zoom * Math.exp(-event.deltaY / 400)); }, { passive: false });
    box.addEventListener("keydown", event => {
      if (!active) return;
      const step = event.shiftKey ? 10 : 2, keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (keys[event.key]) { event.preventDefault(); const [dx, dy] = keys[event.key]; setPosition({ x: active.position.x + dx, y: active.position.y + dy }); }
      else if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(active.position.zoom + 0.1); }
      else if (event.key === "-" || event.key === "_") { event.preventDefault(); setZoom(active.position.zoom - 0.1); }
    });
    addEventListener("resize", () => { if (active) layout(); });
  }
  // The picture follows the finger: a drag of dx pixels moves the picture dx pixels, as far as it overflows the box.
  function move(from, dx, dy) {
    const box = sheet.querySelector(".ds-fit-box").getBoundingClientRect(), { w, h } = active.size;
    const scale = Math.max(box.width / w, box.height / h) * from.zoom, overflowX = w * scale - box.width, overflowY = h * scale - box.height;
    setPosition({ x: overflowX > 0.5 ? from.x - (dx / overflowX) * 100 : from.x, y: overflowY > 0.5 ? from.y - (dy / overflowY) * 100 : from.y });
  }
  function setPosition(next) {
    active.position = normalize({ ...active.position, ...next });
    paint();
  }
  function setZoom(zoom) { setPosition({ zoom }); }
  function paint() {
    const p = active.position;
    apply(sheet.querySelector(".ds-fit-image"), p);
    for (const image of sheet.querySelectorAll(".ds-fit-extra img")) apply(image, p);
    const range = sheet.querySelector(".ds-fit-range");
    range.value = String(p.zoom);
    range.setAttribute("aria-valuetext", `${Math.round(p.zoom * 100)}%`);
    sheet.querySelector(".ds-fit-box").setAttribute("aria-valuetext", `${Math.round(p.x)}%, ${Math.round(p.y)}%, ${Math.round(p.zoom * 100)}%`);
  }
  // The preview is the exact box, as big as the screen allows.
  function layout() {
    const stage = sheet.querySelector(".ds-fit-stage"), box = sheet.querySelector(".ds-fit-box");
    const room = stage.getBoundingClientRect(), pad = getComputedStyle(stage);
    const maxW = Math.max(120, room.width - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)), maxH = Math.max(120, room.height - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom));
    let width = maxW, height = width / active.aspect;
    if (height > maxH) { height = maxH; width = height * active.aspect; }
    box.style.width = `${Math.floor(width)}px`; box.style.height = `${Math.floor(height)}px`;
  }
  function finish(result) {
    if (!active) return;
    const done = active; active = null;
    if (sheet.open) sheet.close();
    if (done.objectUrl) URL.revokeObjectURL(done.objectUrl);
    done.resolve(result);
  }
  async function open({ src, aspect = 1, round = false, position, title, extras = [] } = {}) {
    if (!sheet) build();
    if (active) finish(null);
    const objectUrl = src instanceof Blob ? URL.createObjectURL(src) : "", url = objectUrl || String(src || "");
    let size;
    try { size = await naturalSize(url); }
    catch (error) { if (objectUrl) URL.revokeObjectURL(objectUrl); window.showAppFeedback?.(t(words.failed), { urgent: true }); return null; }
    return await new Promise(resolve => {
      active = { resolve, objectUrl, size, aspect: Math.max(0.2, Math.min(6, Number(aspect) || 1)), position: normalize(position) };
      sheet.querySelector("h2").textContent = t(title || words.title);
      sheet.querySelector(".ds-fit-cancel").textContent = t(words.cancel);
      sheet.querySelector(".ds-fit-save").textContent = t(words.save);
      sheet.querySelector(".ds-fit-hint").textContent = t(words.hint);
      const box = sheet.querySelector(".ds-fit-box");
      box.classList.toggle("is-round", Boolean(round));
      box.setAttribute("aria-label", t(words.area));
      sheet.querySelector(".ds-fit-range").setAttribute("aria-label", t(words.zoom));
      const [minus, plus] = sheet.querySelectorAll(".ds-fit-step");
      minus.setAttribute("aria-label", t(words.zoomOut)); plus.setAttribute("aria-label", t(words.zoomIn));
      sheet.querySelector(".ds-fit-image").src = url;
      const extrasBox = sheet.querySelector(".ds-fit-extras");
      extrasBox.replaceChildren(...extras.map(extra => {
        const figure = document.createElement("figure"); figure.className = "ds-fit-extra" + (extra.round ? " is-round" : "");
        const frame = document.createElement("span"); frame.className = "ds-fit-extra-frame"; frame.style.aspectRatio = String(Math.max(0.2, Math.min(6, Number(extra.aspect) || 1)));
        const image = document.createElement("img"); image.src = url; image.alt = ""; frame.append(image);
        const label = document.createElement("figcaption"); label.textContent = t(extra.label || "");
        figure.append(frame, label);
        return figure;
      }));
      extrasBox.hidden = !extras.length;
      if (!sheet.open) sheet.showModal();
      layout(); paint();
      box.focus({ preventScroll: true });
    });
  }

  window.danzstakImagePosition = Object.freeze({ open, apply, crop, normalize, remember, recall, naturalSize });
})();
