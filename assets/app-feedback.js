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
  toast.textContent = String(message || "DanzStak could not complete that action.");
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

window.addEventListener("danzstak:feedback", event => {
  window.danzstakShowFeedback(event.detail?.message, event.detail || {});
});
