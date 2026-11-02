"use strict";

let appFeedbackTimer = 0;
let appFeedbackHideTimer = 0;

function feedbackElement() {
  let toast = document.querySelector(".danzstak-app-feedback");
  if (toast) return toast;
  toast = document.createElement("div");
  toast.className = "danzstak-app-feedback";
  toast.hidden = true;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  document.body.appendChild(toast);
  return toast;
}

window.danzstakShowFeedback = function danzstakShowFeedback(message, { urgent = false, timeout = 5000 } = {}) {
  const toast = feedbackElement();
  clearTimeout(appFeedbackTimer);
  clearTimeout(appFeedbackHideTimer);
  const source = String(message || "DanzStak could not complete that action.");
  toast.textContent = window.danzstakTranslate?.(source) || source;
  toast.setAttribute("role", urgent ? "alert" : "status");
  toast.setAttribute("aria-live", urgent ? "assertive" : "polite");
  toast.hidden = false;
  toast.classList.remove("is-visible");
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  appFeedbackTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    appFeedbackHideTimer = setTimeout(() => { toast.hidden = true; }, 180);
  }, timeout);
};

window.danzstakConfirm = function danzstakConfirm(message, {
  title = "Confirm action",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
} = {}) {
  if (typeof HTMLDialogElement === "undefined") return Promise.resolve(window.confirm(String(message || title)));
  return new Promise(resolve => {
    const opener = document.activeElement;
    const dialog = document.createElement("dialog");
    const form = document.createElement("form");
    const heading = document.createElement("h2");
    const copy = document.createElement("p");
    const actions = document.createElement("div");
    const cancel = document.createElement("button");
    const confirm = document.createElement("button");
    dialog.className = "danzstak-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "danzstakConfirmTitle");
    form.method = "dialog";
    heading.id = "danzstakConfirmTitle";
    heading.textContent = title;
    copy.textContent = String(message || "Are you sure?");
    actions.className = "danzstak-confirm-actions";
    cancel.type = "submit";
    cancel.value = "cancel";
    cancel.textContent = cancelLabel;
    confirm.type = "submit";
    confirm.value = "confirm";
    confirm.textContent = confirmLabel;
    confirm.className = danger ? "is-danger" : "is-primary";
    actions.append(cancel, confirm);
    form.append(heading, copy, actions);
    dialog.append(form);
    document.body.append(dialog);
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(value);
    };
    dialog.addEventListener("close", () => finish(dialog.returnValue === "confirm"), { once: true });
    dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close("cancel"); });
    dialog.showModal();
    cancel.focus();
  });
};

window.addEventListener("danzstak:feedback", event => {
  window.danzstakShowFeedback(event.detail?.message, event.detail || {});
});
