"use strict";
// Audit 36 D2/D3: a link to an event or product that doesn't exist says so and offers the way back. Before: the event
// page kept "Loading event…" as its title forever, and the product page showed a bare "This product link is not valid"
// with nowhere to go. One helper for both pages.
(() => {
  if (window.danzstakPageMissing) return;
  const t = value => window.danzstakTranslate?.(value) || value;
  // status: the page's role=status line (keeps the message); heading: the page's <h1>, or one is added before status.
  window.danzstakPageMissing = (status, { title, back, href, heading = null }) => {
    const h1 = heading || status.parentElement.querySelector(":scope > h1.page-missing-title") || document.createElement("h1");
    if (!h1.isConnected) { h1.className = "page-missing-title"; status.before(h1); }
    h1.textContent = t(title);
    document.title = `${t(title)} | DanzStak`;
    let link = status.parentElement.querySelector(":scope > a.page-missing-back");
    if (!link) { link = document.createElement("a"); link.className = "page-missing-back ds-btn-tonal"; status.after(link); }
    link.href = href;
    link.textContent = t(back);
  };
})();
