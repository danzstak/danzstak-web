"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
const profileGallery = [];
const profileApi = "https://api.danzstak.com";
const viewingOtherProfile = Boolean(new URLSearchParams(location.search).get("user"));

async function saveCloudProfile(changes) {
  const response = await fetch(profileApi + "/profiles", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Profile could not be saved");
  window.danzstakCurrentProfile = data.profile || window.danzstakCurrentProfile;
  return data.profile;
}

async function uploadCloudProfileMedia(file, field) {
  const ticketResponse = await fetch(profileApi + "/stories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type })
  });
  if (!ticketResponse.ok) throw new Error("Image upload could not start");
  const ticket = await ticketResponse.json();
  const uploadResponse = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploadResponse.ok) throw new Error("Image upload failed");
  return saveCloudProfile({ [field]: ticket.mediaKey });
}

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
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Profile images must be JPG, PNG, or WebP.");
      input.value = "";
      return;
    }
    if (window.danzstakCurrentProfile?.cloudProfile) {
      button.disabled = true;
      try {
        const profile = await uploadCloudProfileMedia(file, field === "avatar" ? "avatarKey" : "coverKey");
        if (field === "avatar" && profile?.picture) { target.style.backgroundImage = `url("${profile.picture}")`; target.textContent = ""; }
        if (field === "cover" && profile?.cover) target.style.backgroundImage = `url("${profile.cover}")`;
        target.classList.add("has-photo");
      } catch (error) { alert(error.message); }
      finally { button.disabled = false; input.value = ""; }
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const sessionUrl = URL.createObjectURL(file);
      target.style.backgroundImage = `url("${sessionUrl}")`;
      target.classList.add("has-photo");
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
  if (saved.cover) {
    cover.style.backgroundImage = `url("${saved.cover}")`;
    cover.style.backgroundPosition = `${saved.coverX ?? 50}% ${saved.coverY ?? 50}%`;
    cover.style.backgroundSize = saved.coverFit ? "contain" : "cover";
    cover.style.backgroundRepeat = "no-repeat";
    cover.style.backgroundColor = "#0b0b12";
    cover.classList.add("has-photo");
  }
}

function addRemoveImageButton(label, field, target) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    if (!confirm(`${label}?`)) return;
    if (window.danzstakCurrentProfile?.cloudProfile) {
      button.disabled = true;
      try { await saveCloudProfile({ [field === "avatar" ? "avatarKey" : "coverKey"]: "" }); }
      catch (error) { alert(error.message); button.disabled = false; return; }
      button.disabled = false;
    }
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
const coverElement = document.querySelector(".cover");
const repositionButton = document.createElement("button");
repositionButton.type = "button";
repositionButton.textContent = "Reposition Cover";
let repositioning = false;
let dragStart = null;
repositionButton.addEventListener("click", () => {
  if (!coverElement.classList.contains("has-photo")) return alert("Add a cover photo first.");
  repositioning = !repositioning;
  repositionButton.classList.toggle("active", repositioning);
  repositionButton.textContent = repositioning ? "Done Repositioning" : "Reposition Cover";
  coverElement.classList.toggle("repositioning", repositioning);
});
coverElement.addEventListener("pointerdown", event => {
  if (!repositioning) return;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  const cloud = window.danzstakCurrentProfile;
  dragStart = { x: event.clientX, y: event.clientY, coverX: cloud?.cloudProfile ? (cloud.coverX ?? 50) : (saved.coverX ?? 50), coverY: cloud?.cloudProfile ? (cloud.coverY ?? 50) : (saved.coverY ?? 50) };
  coverElement.setPointerCapture(event.pointerId);
});
coverElement.addEventListener("pointermove", event => {
  if (!repositioning || !dragStart) return;
  const rect = coverElement.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, dragStart.coverX + ((event.clientX - dragStart.x) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, dragStart.coverY + ((event.clientY - dragStart.y) / rect.height) * 100));
  coverElement.style.backgroundPosition = `${x}% ${y}%`;
  coverElement.dataset.coverX = String(x);
  coverElement.dataset.coverY = String(y);
});
coverElement.addEventListener("pointerup", async () => {
  if (!dragStart) return;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  saved.coverX = Number(coverElement.dataset.coverX || dragStart.coverX);
  saved.coverY = Number(coverElement.dataset.coverY || dragStart.coverY);
  localStorage.setItem(profileMediaKey, JSON.stringify(saved));
  if (window.danzstakCurrentProfile?.cloudProfile) {
    try { await saveCloudProfile({ coverX: saved.coverX, coverY: saved.coverY }); }
    catch (error) { alert(error.message); }
  }
  dragStart = null;
});
mediaTools.appendChild(repositionButton);
const fitCoverButton = document.createElement("button");
fitCoverButton.type = "button";
fitCoverButton.textContent = "Fit Entire Cover";
fitCoverButton.addEventListener("click", async () => {
  if (!coverElement.classList.contains("has-photo")) return alert("Add a cover photo first.");
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  saved.coverFit = !saved.coverFit;
  localStorage.setItem(profileMediaKey, JSON.stringify(saved));
  coverElement.style.backgroundSize = saved.coverFit ? "contain" : "cover";
  coverElement.style.backgroundRepeat = "no-repeat";
  fitCoverButton.classList.toggle("active", saved.coverFit);
  fitCoverButton.textContent = saved.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
  if (window.danzstakCurrentProfile?.cloudProfile) {
    try { await saveCloudProfile({ coverFit: saved.coverFit }); }
    catch (error) { alert(error.message); }
  }
});
try {
  const savedCover = JSON.parse(localStorage.getItem(profileMediaKey) || "{}");
  fitCoverButton.classList.toggle("active", Boolean(savedCover.coverFit));
  fitCoverButton.textContent = savedCover.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
} catch { /* Ignore corrupt local drafts. */ }
mediaTools.appendChild(fitCoverButton);
const videoButton = document.createElement("button");
videoButton.type = "button";
videoButton.textContent = "Add Profile Video";
const videoInput = document.createElement("input");
videoInput.type = "file";
videoInput.accept = "video/mp4,video/webm,video/quicktime";
videoInput.hidden = true;
videoButton.addEventListener("click", () => {
  if (confirm("Do you certify that you created this video and that any music in it is your original material? Standalone audio uploads are not allowed.")) videoInput.click();
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
if (viewingOtherProfile) {
  editButton.hidden = true;
  mediaTools.hidden = true;
}

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
  const avatar = document.getElementById("profileInitial");
  if (profile.picture) { avatar.style.backgroundImage = `url("${profile.picture}")`; avatar.classList.add("has-photo"); avatar.textContent = ""; }
  else avatar.textContent = name.charAt(0).toUpperCase() || "D";
}

editButton.addEventListener("click", () => {
  const profile = window.danzstakCurrentProfile?.cloudProfile ? window.danzstakCurrentProfile : savedProfile();
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
panel.addEventListener("submit", async event => {
  event.preventDefault();
  if (!panel.reportValidity()) return;
  const profile = Object.fromEntries(new FormData(panel).entries());
  profile.handle = profile.handle.replace(/^@/, "");
  const status = document.getElementById("profileStatus");
  const submit = panel.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    if (window.danzstakCurrentProfile?.cloudProfile) {
      const saved = await saveCloudProfile(profile);
      applyProfile(saved || profile);
      status.textContent = "Profile saved to your DanzStak account.";
    } else {
      localStorage.setItem(profileKey, JSON.stringify(profile));
      applyProfile(profile);
      status.textContent = "Profile saved in this browser. Cloud sync is temporarily unavailable.";
    }
    panel.hidden = true;
  } catch (error) {
    status.textContent = error.message;
  } finally { submit.disabled = false; }
  status.hidden = false;
});

applyProfile(savedProfile());
try { applyProfileMedia(JSON.parse(localStorage.getItem(profileMediaKey) || "{}")); } catch { /* Ignore corrupt local drafts. */ }
window.addEventListener("danzstak:profile-loaded", event => {
  const profile = event.detail || {};
  applyProfile(profile.cloudProfile ? profile : savedProfile());
  if (profile.cloudProfile) {
    fitCoverButton.classList.toggle("active", Boolean(profile.coverFit));
    fitCoverButton.textContent = profile.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
  }
});
