"use strict";
// Tribes without their own picture get DanzStak art instead of a letter in a box (owner 2026-11-18: "those letters in
// the box look really janky ... make it like DanzStak so it's dope"). A gradient picked from the Tribe's name on the
// DanzStak palette, a fine diagonal grain and a white line icon for the category. Pure SVG, no images, no fonts.
(() => {
  const palettes = [["#ff5a1f", "#7a1f05"], ["#e5452e", "#2b0d0a"], ["#ffc93c", "#ff6fa8"], ["#9e1b1b", "#0e0d0d"], ["#ff6fa8", "#3b0c3f"], ["#2bd9c5", "#0f2e26"], ["#ff8a3d", "#1d1d22"], ["#8b5cf6", "#140b2e"]];
  const icons = {
    band: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    dj: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6"/><path d="M12 5v2M19 12h-2"/>',
    events: '<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    fans: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 12V5a1.5 1.5 0 0 1 3 0v7M14 12V8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.6-3L4 13a1.5 1.5 0 0 1 2.6-1.4L8 13"/>',
    venue: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    scene: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    industry: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    art: '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="9.5" r="1.2"/><circle cx="14.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="13.5" r="1.2"/>',
    talk: '<path d="M4 5h16v11H9l-5 4z"/>'
  };
  const kindOf = category => ({ Creators: "band", Artists: "art", "DJs & Producers": "dj", Events: "events", Fans: "fans", "Venues & Promoters": "venue", "Local Scenes": "scene", "Industry Networking": "industry" })[category] || "talk";
  function hash(text) { let h = 2166136261; for (const ch of String(text || "")) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Returns an <svg> element (decorative) that fills its box.
  function art(name, category) {
    const [a, b] = palettes[hash(name) % palettes.length], id = "ta" + hash(name + category).toString(36);
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.setAttribute("class", "tribe-art");
    svg.innerHTML = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><pattern id="${id}p" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="1.2" height="6" fill="#fff" opacity=".09"/></pattern></defs><rect width="64" height="64" fill="url(#${id}g)"/><rect width="64" height="64" fill="url(#${id}p)"/><g transform="translate(16 16) scale(1.35)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[kindOf(category)]}</g>`;
    return svg;
  }
  window.danzstakTribeArt = Object.freeze({ art, kindOf });
})();
