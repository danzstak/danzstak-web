"use strict";

const featurePanel = document.getElementById("featureView");
const featureHeading = document.getElementById("featureTitle");
const featureText = document.getElementById("featureDescription");
const localKey = "danzstak_dev_sections";

function readSections() {
  try { return JSON.parse(localStorage.getItem(localKey) || "{}"); }
  catch { return {}; }
}

function writeSections(value) {
  localStorage.setItem(localKey, JSON.stringify(value));
}

function field(label, type, placeholder) {
  const wrap = document.createElement("label");
  wrap.style.display = "grid";
  wrap.style.gap = "7px";
  wrap.style.margin = "14px 0";
  wrap.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  input.style.padding = "12px";
  input.style.border = "1px solid #ccd0d5";
  input.style.borderRadius = "8px";
  wrap.appendChild(input);
  return { wrap, input };
}

function renderWorkspace(name) {
  let workspace = featurePanel.querySelector(".feature-workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.className = "feature-workspace";
    featurePanel.appendChild(workspace);
  }
  workspace.replaceChildren();
  const saved = readSections();

  if (["Friends", "Notifications", "Photos", "Videos"].includes(name)) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = saved[name]?.length
      ? saved[name].join(" · ")
      : "No items yet. This area is ready for live account data.";
    workspace.appendChild(message);
    return;
  }

  if (name === "Messages") {
    const message = field("New message", "text", "Write a private message");
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.textContent = "Save Draft";
    button.addEventListener("click", () => {
      const value = message.input.value.trim();
      if (!value) return message.input.focus();
      saved.Messages = [...(saved.Messages || []), value];
      writeSections(saved);
      message.input.value = "";
      featureText.textContent = "Draft saved privately in this browser until the messaging backend is deployed.";
    });
    workspace.append(message.wrap, button);
    return;
  }

  if (name === "Events") {
    const title = field("Event name", "text", "Show or performance");
    const date = field("Date", "date", "");
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.textContent = "Add Event";
    button.addEventListener("click", () => {
      if (!title.input.value.trim() || !date.input.value) return title.input.focus();
      saved.Events = [...(saved.Events || []), `${title.input.value.trim()} — ${date.input.value}`];
      writeSections(saved);
      featureText.textContent = "Event saved locally: " + saved.Events.at(-1);
      title.input.value = "";
      date.input.value = "";
    });
    workspace.append(title.wrap, date.wrap, button);
    return;
  }

  if (name === "Settings") {
    const notifications = document.createElement("label");
    notifications.style.display = "flex";
    notifications.style.gap = "10px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = saved.Settings?.notifications !== false;
    notifications.append(checkbox, document.createTextNode("Email notifications"));
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.textContent = "Save Settings";
    button.addEventListener("click", () => {
      saved.Settings = { notifications: checkbox.checked };
      writeSections(saved);
      featureText.textContent = "Settings saved in this browser until account synchronization is deployed.";
    });
    workspace.append(notifications, document.createElement("br"), button);
  }
}

document.querySelectorAll("[data-feature]").forEach(control => {
  control.addEventListener("click", () => {
    const name = control.dataset.feature;
    setTimeout(() => renderWorkspace(name), 0);
  });
});

const search = document.querySelector(".search");
search.addEventListener("input", () => {
  const query = search.value.trim().toLowerCase();
  document.querySelectorAll("#feed .post").forEach(post => {
    post.hidden = Boolean(query) && !post.textContent.toLowerCase().includes(query);
  });
});

document.querySelector('[data-feature="Music"]')?.remove();
document.querySelectorAll(".story span").forEach(label => {
  if (label.textContent.trim() === "Music Spotlight") label.textContent = "Creator Spotlight";
});
const uploadNotice = document.querySelector(".composer-actions .muted");
if (uploadNotice) uploadNotice.textContent = "Original content only — no music or third-party copyrighted material";

const composerActions = document.querySelector(".composer-actions");
const publishButton = document.getElementById("publishBtn");
if (composerActions && publishButton) {
  const certification = document.createElement("label");
  certification.style.display = "flex";
  certification.style.alignItems = "flex-start";
  certification.style.gap = "9px";
  certification.style.marginTop = "12px";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "originalContentCertification";
  certification.append(checkbox, document.createTextNode("I certify this is entirely my original content and authorize DANZSTAK and its users to share it within the platform."));
  composerActions.parentElement.insertBefore(certification, composerActions);
  publishButton.addEventListener("click", event => {
    if (checkbox.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert("You must certify that the post is entirely your original content.");
    checkbox.focus();
  }, true);
}
