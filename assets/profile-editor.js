"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");

const bioElement = document.createElement("p");
bioElement.className = "profile-bio";
bioElement.textContent = "Add a short bio so people know more about you.";
handleElement.insertAdjacentElement("afterend", bioElement);

function detail(label, id) {
  const box = document.createElement("div");
  box.className = "detail";
  const title = document.createElement("span");
  title.className = "label";
  title.textContent = label;
  const value = document.createElement("span");
  value.className = "value";
  value.id = id;
  value.textContent = "Not added";
  box.append(title, value);
  details.appendChild(box);
}

detail("Location", "profileLocation");
detail("Work", "profileWork");
detail("Website", "profileWebsite");

const actions = document.createElement("div");
actions.className = "profile-actions";
const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "button";
editButton.textContent = "Edit Profile";
actions.appendChild(editButton);
bioElement.insertAdjacentElement("afterend", actions);

const tabs = document.createElement("nav");
tabs.className = "profile-tabs";
tabs.setAttribute("aria-label", "Profile sections");
for (const name of ["Posts", "About", "Friends", "Photos"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  tab.classList.toggle("active", name === "About");
  tabs.appendChild(tab);
}
const tabMessage = document.createElement("p");
tabMessage.className = "profile-tab-message";
tabMessage.hidden = true;
details.insertAdjacentElement("beforebegin", tabs);
details.insertAdjacentElement("afterend", tabMessage);

tabs.addEventListener("click", event => {
  const tab = event.target.closest("[data-profile-tab]");
  if (!tab) return;
  tabs.querySelectorAll("button").forEach(button => button.classList.toggle("active", button === tab));
  const name = tab.dataset.profileTab;
  details.hidden = name !== "About";
  tabMessage.hidden = name === "About";
  if (name !== "About") tabMessage.textContent = name === "Posts" ? "Your posts will appear here." : `No ${name.toLowerCase()} to show yet.`;
});

const panel = document.createElement("form");
panel.className = "edit-profile-panel";
panel.hidden = true;
panel.innerHTML = '<h2>Edit Profile</h2>' +
  '<label>Display name<input name="name" maxlength="80" autocomplete="name" required></label>' +
  '<label>Username<input name="handle" maxlength="24" pattern="[A-Za-z0-9._]+" required></label>' +
  '<label>Bio<textarea name="bio" maxlength="160"></textarea></label>' +
  '<label>Location<input name="location" maxlength="80"></label>' +
  '<label>Work<input name="work" maxlength="100"></label>' +
  '<label>Website<input name="website" type="url" maxlength="200" placeholder="https://"></label>' +
  '<p class="edit-note">Share only information you want members to see. Profile text must be your original content.</p>' +
  '<div class="edit-actions"><button class="secondary" type="button" data-cancel>Cancel</button><button class="button" type="submit">Save Changes</button></div>';
profileCard.appendChild(panel);

function savedProfile() {
  try { return JSON.parse(localStorage.getItem(profileKey) || "{}"); }
  catch { return {}; }
}

function applyProfile(profile) {
  if (profile.name) document.getElementById("profileName").textContent = profile.name;
  if (profile.handle) handleElement.textContent = "@" + profile.handle;
  bioElement.textContent = profile.bio || "Add a short bio so people know more about you.";
  document.getElementById("profileLocation").textContent = profile.location || "Not added";
  document.getElementById("profileWork").textContent = profile.work || "Not added";
  document.getElementById("profileWebsite").textContent = profile.website || "Not added";
  const name = document.getElementById("profileName").textContent.trim();
  document.getElementById("profileInitial").textContent = name.charAt(0).toUpperCase() || "D";
}

editButton.addEventListener("click", () => {
  const profile = savedProfile();
  panel.elements.name.value = profile.name || document.getElementById("profileName").textContent;
  panel.elements.handle.value = profile.handle || handleElement.textContent.replace(/^@/, "");
  panel.elements.bio.value = profile.bio || "";
  panel.elements.location.value = profile.location || "";
  panel.elements.work.value = profile.work || "";
  panel.elements.website.value = profile.website || "";
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
});

panel.querySelector("[data-cancel]").addEventListener("click", () => { panel.hidden = true; });
panel.addEventListener("submit", event => {
  event.preventDefault();
  if (!panel.reportValidity()) return;
  const profile = Object.fromEntries(new FormData(panel).entries());
  profile.handle = profile.handle.replace(/^@/, "");
  localStorage.setItem(profileKey, JSON.stringify(profile));
  applyProfile(profile);
  panel.hidden = true;
  const status = document.getElementById("profileStatus");
  status.textContent = "Profile saved in this browser. Cloud sync will activate with the backend deployment.";
  status.hidden = false;
});

applyProfile(savedProfile());
window.addEventListener("danzstak:profile-loaded", () => applyProfile(savedProfile()));
