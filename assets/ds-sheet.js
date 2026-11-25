// UI kit sheet (docs/tasks/39-modern-look.md section 3): a bottom sheet on phones, a centred dialog from 760px.
// Drag handle, a ✕ in the corner, a tap on the dim backdrop or Escape closes it, and so does the phone's Back:
// opening adds one history step, closing goes back through it (so a page's own Back routing sees the sheet first).
//   const sheet = window.danzstakSheet.open({ title: "Who can see it?", content: node, onClose() {} });
//   sheet.close();
// Pages with their own popstate routing call danzstakSheet.closeFromHistory() first; it returns true when it closed one.
(function () {
  "use strict";
  const stack = [];
  let serial = 0;
  const icon = name => window.danzstakIcon ? window.danzstakIcon(name) : document.createTextNode("×");

  function open({ title = "", content, onClose, container = document.body, opener = document.activeElement, className = "" } = {}) {
    const id = ++serial;
    const root = document.createElement("div");
    root.className = ["ds", "ds-sheet", className].filter(Boolean).join(" "); // className "ds--day": Day on a page that hasn't moved
    // The dim backdrop is not a control (screen readers use ✕ or Escape); a tap on it closes the sheet.
    const backdrop = document.createElement("div");
    backdrop.className = "ds-sheet__backdrop"; backdrop.setAttribute("aria-hidden", "true");
    const panel = document.createElement("div");
    panel.className = "ds-sheet__panel";
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
    const heading = document.createElement("h2");
    heading.className = "ds-sheet__title"; heading.id = `dsSheetTitle${id}`; heading.textContent = title;
    panel.setAttribute("aria-labelledby", heading.id);
    const close = document.createElement("button");
    close.type = "button"; close.className = "ds-icon-btn ds-sheet__close"; close.setAttribute("aria-label", "Close"); close.append(icon("x"));
    const handle = document.createElement("span"); handle.className = "ds-sheet__handle"; handle.setAttribute("aria-hidden", "true");
    const head = document.createElement("div"); head.className = "ds-sheet__head";
    head.append(document.createElement("span"), heading, close);
    const body = document.createElement("div"); body.className = "ds-sheet__body";
    if (content) body.append(content);
    panel.append(handle, head, body);
    root.append(backdrop, panel);
    container.append(root);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-open")));

    const entry = { id, root, closed: false, onClose, opener };
    entry.close = ({ fromHistory = false } = {}) => {
      if (entry.closed) return;
      if (!fromHistory && history.state?.danzstakSheet === id) { history.back(); return; } // popstate closes it
      entry.closed = true;
      const at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
      root.classList.remove("is-open");
      const done = () => { if (content && content.parentNode === body) body.removeChild(content); root.remove(); };
      const ms = parseFloat(getComputedStyle(root).getPropertyValue("--ds-motion-sheet")) || 0;
      if (ms) setTimeout(done, ms); else done();
      try { onClose?.(); } finally { if (opener && opener.isConnected) opener.focus?.({ preventScroll: true }); }
    };
    backdrop.addEventListener("click", () => entry.close());
    close.addEventListener("click", () => entry.close());
    root.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); entry.close(); return; }
      if (event.key !== "Tab") return; // keep focus inside the sheet
      const focusable = [...panel.querySelectorAll("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter(n => !n.disabled && n.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    stack.push(entry);
    history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), danzstakSheet: id }, "");
    requestAnimationFrame(() => (body.querySelector("[aria-checked='true'],input,button,textarea") || close).focus({ preventScroll: true }));
    return { close: () => entry.close(), root, body };
  }

  // Closes every sheet whose history step is no longer current. True when one was closed.
  function closeFromHistory() {
    let closed = false;
    for (const entry of [...stack].reverse()) {
      if (history.state?.danzstakSheet === entry.id) break;
      entry.close({ fromHistory: true }); closed = true;
    }
    return closed;
  }
  addEventListener("popstate", closeFromHistory);
  window.danzstakSheet = Object.freeze({ open, closeFromHistory, isOpen: () => stack.length > 0 });
})();
