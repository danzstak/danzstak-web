"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
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

async function uploadCloudMedia(file) {
  const ticketResponse = await fetch(profileApi + "/stories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type })
  });
  if (!ticketResponse.ok) throw new Error("Media upload could not start");
  const ticket = await ticketResponse.json();
  const uploadResponse = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploadResponse.ok) throw new Error("Media upload failed");
  return ticket.mediaKey;
}

async function uploadCloudProfileMedia(file, field) {
  return saveCloudProfile({ [field]: await uploadCloudMedia(file) });
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
videoInput.addEventListener("change", async () => {
  const file = videoInput.files[0];
  if (!file) return;
  if (!videoInput.accept.split(",").includes(file.type)) {
    alert("Profile videos must be MP4, WebM, or MOV.");
    videoInput.value = "";
    return;
  }
  videoButton.disabled = true;
  try {
    const mediaKey = await uploadCloudMedia(file);
    const response = await fetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be saved");
    alert("Profile video saved. Open the Media tab to view it.");
  } catch (error) { alert(error.message); }
  finally { videoButton.disabled = false; videoInput.value = ""; }
});
mediaTools.append(videoButton, videoInput);
const removeVideoButton = document.createElement("button");
removeVideoButton.type = "button";
removeVideoButton.textContent = "Remove Profile Video";
removeVideoButton.addEventListener("click", async () => {
  if (!confirm("Remove profile video?")) return;
  removeVideoButton.disabled = true;
  try {
    const response = await fetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey: "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be removed");
    alert("Profile video removed from your profile and storage.");
  } catch (error) { alert(error.message); }
  finally { removeVideoButton.disabled = false; }
});
mediaTools.appendChild(removeVideoButton);
actions.insertAdjacentElement("afterend", mediaTools);
if (viewingOtherProfile) {
  editButton.hidden = true;
  mediaTools.hidden = true;
}

const tabs = document.createElement("nav");
tabs.className = "profile-tabs";
tabs.setAttribute("aria-label", "Profile sections");
tabs.setAttribute("role", "tablist");
for (const name of ["Posts", "About", "Friends", "Media"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  tab.classList.toggle("active", name === "About");
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(name === "About"));
  tab.tabIndex = name === "About" ? 0 : -1;
  tabs.appendChild(tab);
}
const tabMessage = document.createElement("div");
tabMessage.className = "profile-tab-message";
tabMessage.hidden = true;
tabMessage.setAttribute("role", "tabpanel");
tabMessage.setAttribute("aria-live", "polite");
details.insertAdjacentElement("beforebegin", tabs);
details.insertAdjacentElement("afterend", tabMessage);

function profilePostCard(post) {
  const article = document.createElement("article");
  article.className = "profile-post-card";
  const meta = document.createElement("div");
  meta.className = "profile-post-meta";
  const time = document.createElement("time");
  const created = post.createdAt ? new Date(post.createdAt) : null;
  time.textContent = created && !Number.isNaN(created.valueOf()) ? created.toLocaleString() : "Recent post";
  const audience = document.createElement("span");
  audience.textContent = post.audience === "private" ? "Only me" : post.audience === "friends" ? "Friends" : "Public";
  meta.append(time, audience);
  const text = document.createElement("p");
  text.textContent = post.content || "Shared media";
  article.append(meta, text);
  if (post.mediaUrl && ["image", "video"].includes(post.mediaType)) {
    const media = document.createElement(post.mediaType === "image" ? "img" : "video");
    media.className = "profile-post-media";
    media.src = post.mediaUrl;
    if (post.mediaType === "image") media.alt = post.content || "Profile post photo";
    else { media.controls = true; media.preload = "metadata"; }
    article.appendChild(media);
  }
  return article;
}

async function loadProfilePosts(mediaOnly = false) {
  tabMessage.textContent = mediaOnly ? "Loading media…" : "Loading posts…";
  try {
    const response = await fetch(profileApi + "/secure-posts", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Profile posts could not be loaded");
    const data = await response.json();
    const profileEmail = String(window.danzstakCurrentProfile?.email || "").toLowerCase();
    let posts = (data.posts || []).filter(post => String(post.authorEmail || post.userEmail || post.email || "").toLowerCase() === profileEmail);
    if (mediaOnly) posts = posts.filter(post => post.mediaUrl && ["image", "video"].includes(post.mediaType));
    tabMessage.replaceChildren();
    if (mediaOnly) {
      const params = new URLSearchParams();
      const profileEmail = String(window.danzstakCurrentProfile?.email || "");
      if (profileEmail) params.set("email", profileEmail);
      const videoResponse = await fetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" });
      if (videoResponse.ok) {
        const stored = await videoResponse.json();
        if (stored.mediaKey) {
          const viewResponse = await fetch(profileApi + "/stories", {
            method: "POST", credentials: "include", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view", mediaKey: stored.mediaKey, mediaType: "video" })
          });
          if (viewResponse.ok) {
            const view = await viewResponse.json();
            tabMessage.appendChild(profilePostCard({ content: "Profile video", mediaType: "video", mediaUrl: view.mediaUrl }));
          }
        }
      }
    }
    if (!posts.length && !tabMessage.childElementCount) { tabMessage.textContent = mediaOnly ? "No photos or videos to show yet." : "No posts to show yet."; return; }
    for (const post of posts) tabMessage.appendChild(profilePostCard(post));
  } catch (error) { tabMessage.textContent = error.message; }
}

async function loadProfileFriends() {
  if (viewingOtherProfile) { tabMessage.textContent = "This member’s friend list is private."; return; }
  tabMessage.textContent = "Loading friends…";
  try {
    const response = await fetch(profileApi + "/friends", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Friends could not be loaded");
    const data = await response.json();
    tabMessage.replaceChildren();
    if (!(data.friends || []).length) { tabMessage.textContent = "No friends yet."; return; }
    const grid = document.createElement("div"); grid.className = "profile-friend-grid";
    for (const friend of data.friends) {
      const link = document.createElement("a"); link.className = "profile-friend-card"; link.href = "profile.html?user=" + encodeURIComponent(friend.email);
      const avatar = friend.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
      if (friend.picture) { avatar.src = friend.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
      else { avatar.textContent = (friend.name || friend.email).charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
      const copy = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = friend.name || friend.email;
      const email = document.createElement("small"); email.textContent = friend.email;
      copy.append(name, email); link.append(avatar, copy); grid.appendChild(link);
    }
    tabMessage.appendChild(grid);
  } catch (error) { tabMessage.textContent = error.message; }
}

tabs.addEventListener("click", async event => {
  const tab = event.target.closest("[data-profile-tab]");
  if (!tab) return;
  tabs.querySelectorAll("button").forEach(button => { const selected = button === tab; button.classList.toggle("active", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
  const name = tab.dataset.profileTab;
  details.hidden = name !== "About";
  tabMessage.hidden = name === "About";
  if (name === "Posts") await loadProfilePosts(false);
  else if (name === "Friends") await loadProfileFriends();
  else if (name === "Media") await loadProfilePosts(true);
});
tabs.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = [...tabs.querySelectorAll('[role="tab"]')];
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
  buttons[next].click();
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
  else { avatar.style.backgroundImage = ""; avatar.classList.remove("has-photo"); avatar.textContent = name.charAt(0).toUpperCase() || "D"; }
  const cover = document.querySelector(".cover");
  if (profile.cover) {
    cover.style.backgroundImage = `url("${profile.cover}")`;
    cover.style.backgroundPosition = `${profile.coverX ?? 50}% ${profile.coverY ?? 50}%`;
    cover.style.backgroundSize = profile.coverFit ? "contain" : "cover";
    cover.style.backgroundRepeat = "no-repeat";
    cover.classList.add("has-photo");
  } else if (viewingOtherProfile || profile.cloudProfile) {
    cover.style.backgroundImage = "";
    cover.classList.remove("has-photo");
  }
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

if (!viewingOtherProfile) {
  applyProfile(savedProfile());
  try { applyProfileMedia(JSON.parse(localStorage.getItem(profileMediaKey) || "{}")); } catch { /* Ignore corrupt local drafts. */ }
}
window.addEventListener("danzstak:profile-loaded", event => {
  const profile = event.detail || {};
  applyProfile(profile.cloudProfile ? profile : savedProfile());
  if (profile.cloudProfile) {
    fitCoverButton.classList.toggle("active", Boolean(profile.coverFit));
    fitCoverButton.textContent = profile.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
  }
});
