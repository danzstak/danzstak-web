"use strict";
(() => {
  const escape = value => String(value).replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
  const months = document.getElementById("monitorMonths");
  const count = document.getElementById("monitorMonthCount");
  const total = document.getElementById("monitorTotal");
  function updatePrice() { const value = Math.min(12, Math.max(1, Number(months.value) || 1)); count.textContent = `${value} ${value === 1 ? "month" : "months"}`; total.textContent = `$${value * 4}`; }
  months.addEventListener("change", updatePrice);
  updatePrice();

  const registry = document.getElementById("sourceRegistry");
  (window.STAKGUARD_BROKER_REGISTRY || []).forEach(source => {
    const item = document.createElement("li");
    item.innerHTML = `<div><strong>${escape(source.name)}</strong><span>${escape(source.jurisdiction)} · ${escape(source.status)}</span><small>Last checked ${escape(source.checked)}</small></div><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">Official page</a>`;
    registry.appendChild(item);
  });
})();
