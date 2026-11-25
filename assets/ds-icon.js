// UI kit icon helper (docs/tasks/39-modern-look.md section 2). Returns an outline Lucide icon from assets/icons.svg.
// The icon is decoration: the button or link around it carries the accessible name.
//   button.prepend(window.danzstakIcon("bell"));  window.danzstakIcon("house", { filled: true, size: "bar" })
(function () {
  "use strict";
  const SVG = "http://www.w3.org/2000/svg";
  const sprite = new URL("icons.svg", document.currentScript ? document.currentScript.src : location.href).pathname;
  window.danzstakIcon = function danzstakIcon(name, options) {
    const opts = options || {};
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", ["ds-icon", opts.size ? `ds-icon--${opts.size}` : "", opts.filled ? "ds-icon--filled" : ""].filter(Boolean).join(" "));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(SVG, "use");
    use.setAttribute("href", `${sprite}#${String(name).replace(/[^a-z0-9-]/g, "")}`);
    svg.append(use);
    return svg;
  };
})();
