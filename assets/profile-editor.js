"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
const profileGallery = [];

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

const mediaTools = document.createElement("div");
mediaTools.className = "profile-media-tools";

function addProfileImageButton(label, target, field) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.hidden = true;
  button.addEventListener("click", () => {
    if (confirm("Do you certify that you created this image and it contains no third-party copyrighted material?")) input.click();
  });
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1024 * 1024) {
      alert("Profile images must be JPG, PNG, or WebP and no larger than 1 MB.");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
      saved[field] = reader.result;
      try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
      catch { return alert("This image could not be saved in the browser. Choose a smaller file."); }
      applyProfileMedia(saved);
    });
    reader.readAsDataURL(file);
  });
  mediaTools.append(button, input);
}

function applyProfileMedia(saved) {
  const avatar = document.getElementById("profileInitial");
  const cover = document.querySelector(".cover");
  if (saved.avatar) { avatar.style.backgroundImage = `url("${saved.avatar}")`; avatar.classList.add("has-photo"); }
  if (saved.cover) { cover.style.backgroundImage = `url("${saved.cover}")`; cover.classList.add("has-photo"); }
}

function addRemoveImageButton(label, field, target) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    if (!confirm(`${label}?`)) return;
    const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
    delete saved[field];
    localStorage.setItem(profileMediaKey, JSON.stringify(saved));
    target.style.backgroundImage = "";
    target.classList.remove("has-photo");
  });
  mediaTools.appendChild(button);
}

addProfileImageButton("Change Profile Photo", document.getElementById("profileInitial"), "avatar");
addProfileImageButton("Change Cover Photo", document.querySelector(".cover"), "cover");
addRemoveImageButton("Remove Profile Photo", "avatar", document.getElementById("profileInitial"));
addRemoveImageButton("Remove Cover Photo", "cover", document.querySelector(".cover"));
const videoButton = document.createElement("button");
videoButton.type = "button";
videoButton.textContent = "Add Profile Video";
const videoInput = document.createElement("input");
videoInput.type = "file";
videoInput.accept = "video/mp4,video/webm,video/quicktime";
videoInput.hidden = true;
videoButton.addEventListener("click", () => {
  if (confirm("Do you certify that you created this video and it contains no music or third-party copyrighted material?")) videoInput.click();
});
videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("video/") || file.size > 100 * 1024 * 1024) {
    alert("Profile videos must be MP4, WebM, or MOV and no larger than 100 MB.");
    videoInput.value = "";
    return;
  }
  profileGallery.push({ kind: "video", url: URL.createObjectURL(file), name: file.name });
  alert("Profile video added for this browser session. Open the Media tab to view it.");
});
mediaTools.append(videoButton, videoInput);
actions.insertAdjacentElement("afterend", mediaTools);

const tabs = document.createElement("nav");
tabs.className = "profile-tabs";
tabs.setAttribute("aria-label", "Profile sections");
for (const name of ["Posts", "About", "Friends", "Media"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  tab.classList.toggle("active", name === "About");
  tabs.appendChild(tab);
}
const tabMessage = document.createElement("div");
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
  if (name !== "About") {
    tabMessage.replaceChildren();
    if (name === "Media" && profileGallery.length) {
      for (const item of [...profileGallery]) {
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "14px";
        const video = document.createElement("video");
        video.src = item.url;
        video.controls = true;
        video.style.width = "100%";
        video.style.maxHeight = "480px";
        video.style.borderRadius = "10px";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "secondary";
        remove.textContent = "Delete Video";
        remove.addEventListener("click", () => {
          if (!confirm("Delete this profile video?")) return;
          const index = profileGallery.indexOf(item);
          if (index >= 0) profileGallery.splice(index, 1);
          URL.revokeObjectURL(item.url);
          wrap.remove();
          if (!profileGallery.length) tabMessage.textContent = "No media to show yet.";
        });
        wrap.append(video, remove);
        tabMessage.appendChild(wrap);
      }
    } else {
      tabMessage.textContent = name === "Posts" ? "Your posts will appear here." : `No ${name.toLowerCase()} to show yet.`;
    }
  }
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
try { applyProfileMedia(JSON.parse(localStorage.getItem(profileMediaKey) || "{}")); } catch { /* Ignore corrupt local drafts. */ }
window.addEventListener("danzstak:profile-loaded", () => applyProfile(savedProfile()));
