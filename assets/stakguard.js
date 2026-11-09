"use strict";
(() => {
  const months = document.getElementById("monitorMonths");
  const count = document.getElementById("monitorMonthCount");
  const total = document.getElementById("monitorTotal");
  function updatePrice() { const value = Math.min(12, Math.max(1, Number(months.value) || 1)); count.textContent = `${value} ${value === 1 ? "month" : "months"}`; total.textContent = `$${value * 4}`; }
  months.addEventListener("change", updatePrice);
  updatePrice();

  const dialog = document.getElementById("removalDialog");
  const dialogTitle = document.getElementById("removalDialogTitle");
  const sourceName = document.getElementById("removalSource");
  const draft = document.getElementById("removalDraft");
  const copyDraft = document.getElementById("copyRemovalDraft");
  const emailDraft = document.getElementById("emailRemovalDraft");
  const officialForm = document.getElementById("officialRemovalForm");
  const removalStatus = document.getElementById("removalStatus");

  function openRequest(source) {
    dialogTitle.textContent = `Prepare request for ${source.name}`;
    sourceName.textContent = `Send to ${source.email} from your own email account, or use the official suppression form.`;
    draft.value = source.requestTemplate;
    emailDraft.href = `mailto:${source.email}?subject=${encodeURIComponent(source.subject)}&body=${encodeURIComponent(source.requestTemplate)}`;
    officialForm.href = source.url;
    removalStatus.textContent = "";
    dialog.showModal();
    draft.focus();
    draft.setSelectionRange(0, 0);
    draft.scrollTop = 0;
  }

  copyDraft.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(draft.value);
      removalStatus.textContent = "Request copied. Review it in your email before sending.";
    } catch {
      draft.focus();
      draft.select();
      removalStatus.textContent = "Copy was blocked by this browser. The request is selected so you can copy it manually.";
    }
  });

  const registry = document.getElementById("sourceRegistry");
  (window.STAKGUARD_BROKER_REGISTRY || []).forEach(source => {
    const item = document.createElement("li");
    const details = document.createElement("div");
    const name = document.createElement("strong");
    const status = document.createElement("span");
    const checked = document.createElement("small");
    const actions = document.createElement("div");
    const official = document.createElement("a");
    name.textContent = source.name;
    status.textContent = `${source.jurisdiction} · ${source.status}`;
    checked.textContent = `Last checked ${source.checked}`;
    details.append(name, status, checked);
    actions.className = "source-actions";
    official.href = source.url;
    official.target = "_blank";
    official.rel = "noopener noreferrer";
    official.textContent = "Official page";
    actions.appendChild(official);
    if (source.channel === "email_and_form" && source.email && source.requestTemplate) {
      const prepare = document.createElement("button");
      prepare.type = "button";
      prepare.textContent = "Prepare request";
      prepare.addEventListener("click", () => openRequest(source));
      actions.prepend(prepare);
    }
    item.append(details, actions);
    registry.appendChild(item);
  });
})();
