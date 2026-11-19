"use strict";
// SYNC video call screen (fix-it "Call screen", owner 2026-11-17). Layout only: media, signalling and devices are untouched.
// - The other person's video fills the screen (cover, framed a little above centre where faces are); double-tap toggles
//   fit-to-screen and back.
// - A bottom band is reserved for subtitles only while subtitles are on (task 21), so captions never cover the picture.
// - Your own camera window floats on top: long-press (~300 ms; mouse: just drag) to move it, it snaps to the nearest
//   corner inside the safe area and never over the call buttons, and the corner is remembered on this device.
//   A quick tap swaps the big and small views.
(() => {
  const KEY = "danzstak_call_pip_corner", CORNERS = ["tl", "tr", "bl", "br"], HOLD_MS = 300;
  const t = value => window.danzstakTranslate?.(value) || value;
  const grid = () => document.getElementById("videoGrid");
  const pip = () => grid()?.querySelector(".local-video");
  let corner = "tr";
  try { const saved = localStorage.getItem(KEY); if (CORNERS.includes(saved)) corner = saved; } catch {}

  function setCorner(next, remember = true) {
    if (!CORNERS.includes(next)) return;
    corner = next;
    const g = grid(); if (g) g.dataset.pipCorner = next;
    if (remember) try { localStorage.setItem(KEY, next); } catch {}
  }
  function nearestCorner(x, y) {
    const g = grid().getBoundingClientRect();
    return (y < g.top + g.height / 2 ? "t" : "b") + (x < g.left + g.width / 2 ? "l" : "r");
  }
  function swap() { const g = grid(); if (!g) return; g.dataset.swapped = g.dataset.swapped === "1" ? "0" : "1"; announce(t(g.dataset.swapped === "1" ? "Showing your camera big" : "Showing the other person big")); }
  function toggleFit() { const g = grid(); if (!g) return; g.dataset.fit = g.dataset.fit === "contain" ? "cover" : "contain"; announce(t(g.dataset.fit === "contain" ? "Whole picture" : "Full screen")); }
  function announce(text) { let live = document.getElementById("callScreenLive"); if (!live) { live = document.createElement("p"); live.id = "callScreenLive"; live.className = "sr-only"; live.setAttribute("aria-live", "polite"); document.body.appendChild(live); } live.textContent = text; }

  function install() {
    const g = grid(), small = pip();
    if (!g || !small || g.dataset.callScreen) return;
    g.dataset.callScreen = "1"; g.dataset.fit = "cover"; g.dataset.swapped = "0";
    setCorner(corner, false);
    small.tabIndex = 0; small.setAttribute("role", "button");
    small.setAttribute("aria-label", t("Your camera. Tap to swap views, long-press to move. Arrow keys move it to a corner."));
    // Drag with long-press (touch) or a plain drag (mouse/pen).
    let start = null, holdTimer = null, dragging = false, moved = false;
    const begin = () => { dragging = true; small.classList.add("is-dragging"); navigator.vibrate?.(12); };
    small.addEventListener("pointerdown", event => {
      if (event.button > 0) return;
      const box = small.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, dx: event.clientX - box.left, dy: event.clientY - box.top, id: event.pointerId, touch: event.pointerType === "touch" };
      moved = false; dragging = false;
      try { small.setPointerCapture(event.pointerId); } catch {}
      if (start.touch) holdTimer = setTimeout(begin, HOLD_MS);
    });
    small.addEventListener("pointermove", event => {
      if (!start || event.pointerId !== start.id) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (!dragging) {
        if (start.touch && distance > 10) { clearTimeout(holdTimer); start = null; return; } // a swipe, not a long-press
        if (!start.touch && distance > 6) begin();
        if (!dragging) return;
      }
      moved = true; event.preventDefault();
      const g2 = g.getBoundingClientRect();
      small.style.setProperty("left", `${Math.max(0, Math.min(g2.width - small.offsetWidth, event.clientX - g2.left - start.dx))}px`, "important");
      small.style.setProperty("top", `${Math.max(0, Math.min(g2.height - small.offsetHeight, event.clientY - g2.top - start.dy))}px`, "important");
      small.style.setProperty("right", "auto", "important"); small.style.setProperty("bottom", "auto", "important");
    });
    const finish = event => {
      if (!start || event.pointerId !== start.id) return;
      clearTimeout(holdTimer);
      if (dragging && moved) { const box = small.getBoundingClientRect(); setCorner(nearestCorner(box.left + box.width / 2, box.top + box.height / 2)); }
      else if (!dragging || !moved) { if (event.type === "pointerup" && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) swap(); }
      for (const p of ["left", "top", "right", "bottom"]) small.style.removeProperty(p);
      small.classList.remove("is-dragging"); dragging = false; start = null;
    };
    small.addEventListener("pointerup", finish);
    small.addEventListener("pointercancel", finish);
    small.addEventListener("contextmenu", event => event.preventDefault());
    small.addEventListener("keydown", event => {
      const map = { ArrowUp: c => "t" + c[1], ArrowDown: c => "b" + c[1], ArrowLeft: c => c[0] + "l", ArrowRight: c => c[0] + "r" };
      if (map[event.key]) { event.preventDefault(); setCorner(map[event.key](corner)); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); swap(); }
    });
    // Double-tap the big video: fit the whole picture / fill the screen.
    let lastTap = 0;
    g.addEventListener("pointerup", event => {
      if (small.contains(event.target)) return;
      const now = Date.now();
      if (now - lastTap < 320) { toggleFit(); lastTap = 0; } else lastTap = now;
    });
    g.addEventListener("dblclick", event => { if (!small.contains(event.target)) event.preventDefault(); });
    // Subtitle band (filled by task 21 when subtitles are on).
    if (!document.getElementById("callSubtitles")) {
      const band = document.createElement("div"); band.id = "callSubtitles"; band.className = "call-subtitles"; band.hidden = true; band.setAttribute("aria-live", "polite");
      g.parentElement.insertBefore(band, g.nextSibling);
    }
  }

  function setSubtitles(on) {
    document.body.dataset.callSubtitles = on ? "on" : "off";
    const band = document.getElementById("callSubtitles"); if (band) { band.hidden = !on; if (!on) band.textContent = ""; }
  }
  function showSubtitle(text) { const band = document.getElementById("callSubtitles"); if (band && !band.hidden) band.textContent = String(text || "").slice(0, 400); }
  // New calls start in the familiar layout (other person big, filled), keeping the remembered corner.
  new MutationObserver(() => { const g = grid(); if (g && document.body.dataset.callMode !== "video") { g.dataset.swapped = "0"; g.dataset.fit = "cover"; } })
    .observe(document.body, { attributes: true, attributeFilter: ["data-call-mode"] });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
  window.danzstakCallScreen = { setCorner, corner: () => corner, swap, toggleFit, setSubtitles, showSubtitle };
})();
