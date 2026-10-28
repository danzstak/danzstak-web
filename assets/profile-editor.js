"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
const profileApi = "https://api.danzstak.com";
async function profileFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("DanzStak is taking too long to respond. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}
let viewingOtherProfile = Boolean(new URLSearchParams(location.search).get("user") || new URLSearchParams(location.search).get("member"));

async function saveCloudProfile(changes) {
  const response = await profileFetch(profileApi + "/profiles", {
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
  const ticketResponse = await profileFetch(profileApi + "/stories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, purpose: "profile" })
  });
  if (!ticketResponse.ok) throw new Error("Media upload could not start");
  const ticket = await ticketResponse.json();
  const uploadDeadline = Math.max(120000, Math.ceil(file.size / (64 * 1024)) * 1000);
  const uploadResponse = await profileFetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, uploadDeadline);
  if (!uploadResponse.ok) throw new Error("Media upload failed");
  return ticket.mediaKey;
}

async function uploadCloudProfileMedia(file, field) {
  const mediaKey = await uploadCloudMedia(file);
  // A lost save response can still mean the profile was committed. Retain the upload.
  return await saveCloudProfile({ [field]: mediaKey });
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
  button.dataset.mediaField = field;
  const input = document.createElement("input");
  input.dataset.mediaField = field;
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

async function removeProfileImage(field, target) {
  const cloud = window.danzstakCurrentProfile?.cloudProfile;
  if (cloud) {
    const profile = await saveCloudProfile({ [field === "avatar" ? "avatarKey" : "coverKey"]: "" });
    applyProfile(profile || window.danzstakCurrentProfile);
  }
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  delete saved[field];
  try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
  catch (error) { if (!cloud) throw new Error("The photo could not be removed from browser storage. Please try again."); }
  if (!cloud) {
    target.style.backgroundImage = "";
    target.classList.remove("has-photo");
    if (field === "avatar") target.textContent = document.getElementById("profileName").textContent.trim().charAt(0).toUpperCase() || "D";
  }
}

function addRemoveImageButton(label, field, target) {
  const button = document.createElement("button");
  button.dataset.mediaField = field;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    if (!confirm(`${label}?`)) return;
    button.disabled = true;
    try { await removeProfileImage(field, target); }
    catch (error) { alert(error.message); }
    finally { button.disabled = false; }
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
repositionButton.dataset.mediaField = "cover";
repositionButton.textContent = "Reposition Cover";
const finishReposition = document.createElement("button");
finishReposition.type = "button"; finishReposition.className = "cover-reposition-done"; finishReposition.textContent = "Done repositioning"; finishReposition.hidden = true;
coverElement.appendChild(finishReposition);
finishReposition.addEventListener("click", () => repositionButton.click());
let repositioning = false;
let dragStart = null;
let coverPositionSaving = false;
repositionButton.addEventListener("click", () => {
  if (!coverElement.classList.contains("has-photo")) return alert("Add a cover photo first.");
  repositioning = !repositioning;
  repositionButton.classList.toggle("active", repositioning);
  repositionButton.textContent = repositioning ? "Done Repositioning" : "Reposition Cover";
  coverElement.classList.toggle("repositioning", repositioning);
  finishReposition.hidden = !repositioning;
  if (repositioning) coverElement.scrollIntoView({block:"center",behavior:"smooth"});
  else panel.scrollIntoView({block:"start",behavior:"smooth"});
});
coverElement.addEventListener("pointerdown", event => {
  if (!repositioning || coverPositionSaving || event.target.closest?.("button")) return;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  const cloud = window.danzstakCurrentProfile;
  dragStart = { x: event.clientX, y: event.clientY, coverX: cloud?.cloudProfile ? (cloud.coverX ?? 50) : (saved.coverX ?? 50), coverY: cloud?.cloudProfile ? (cloud.coverY ?? 50) : (saved.coverY ?? 50) };
  coverElement.dataset.coverX = String(dragStart.coverX);
  coverElement.dataset.coverY = String(dragStart.coverY);
  coverElement.setPointerCapture(event.pointerId);
});
coverElement.addEventListener("pointermove", event => {
  if (!repositioning || !dragStart) return;
  const rect = coverElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(0, Math.min(100, dragStart.coverX + ((event.clientX - dragStart.x) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, dragStart.coverY + ((event.clientY - dragStart.y) / rect.height) * 100));
  coverElement.style.backgroundPosition = `${x}% ${y}%`;
  coverElement.dataset.coverX = String(x);
  coverElement.dataset.coverY = String(y);
});
async function persistCoverPosition(position) {
  const cloud = window.danzstakCurrentProfile?.cloudProfile;
  if (cloud) await saveCloudProfile(position);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  Object.assign(saved, position);
  try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
  catch { if (!cloud) throw new Error("Cover position could not be saved in this browser."); }
}
function restoreCoverPosition(position) {
  coverElement.style.backgroundPosition = `${position.coverX}% ${position.coverY}%`;
  coverElement.dataset.coverX = String(position.coverX);
  coverElement.dataset.coverY = String(position.coverY);
}
coverElement.addEventListener("pointerup", async () => {
  if (!dragStart) return;
  const previous = dragStart;
  dragStart = null;
  const position = {
    coverX: Number(coverElement.dataset.coverX ?? previous.coverX),
    coverY: Number(coverElement.dataset.coverY ?? previous.coverY)
  };
  if (position.coverX === previous.coverX && position.coverY === previous.coverY) return;
  coverPositionSaving = true;
  try { await persistCoverPosition(position); }
  catch (error) { restoreCoverPosition(previous); alert(error.message); }
  finally { coverPositionSaving = false; }
});
coverElement.addEventListener("pointercancel", () => {
  if (!dragStart) return;
  restoreCoverPosition(dragStart);
  dragStart = null;
});
mediaTools.appendChild(repositionButton);
const fitCoverButton = document.createElement("button");
fitCoverButton.type = "button";
fitCoverButton.dataset.mediaField = "cover";
fitCoverButton.textContent = "Fit Entire Cover";
async function toggleCoverFit() {
  if (!coverElement.classList.contains("has-photo")) return alert("Add a cover photo first.");
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  const cloud = window.danzstakCurrentProfile;
  const coverFit = !(cloud?.cloudProfile ? cloud.coverFit : saved.coverFit);
  fitCoverButton.disabled = true;
  try {
    if (cloud?.cloudProfile) await saveCloudProfile({ coverFit });
    saved.coverFit = coverFit;
    try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); } catch { /* Cloud save remains authoritative. */ }
    coverElement.style.backgroundSize = coverFit ? "contain" : "cover";
    coverElement.style.backgroundRepeat = "no-repeat";
    fitCoverButton.classList.toggle("active", coverFit);
    fitCoverButton.textContent = coverFit ? "Fill Cover Box" : "Fit Entire Cover";
  } catch (error) { alert(error.message); }
  finally { fitCoverButton.disabled = false; }
}
fitCoverButton.addEventListener("click", toggleCoverFit);
try {
  const savedCover = JSON.parse(localStorage.getItem(profileMediaKey) || "{}");
  fitCoverButton.classList.toggle("active", Boolean(savedCover.coverFit));
  fitCoverButton.textContent = savedCover.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
} catch { /* Ignore corrupt local drafts. */ }
mediaTools.appendChild(fitCoverButton);
const videoButton = document.createElement("button");
videoButton.type = "button";
videoButton.dataset.mediaField = "video";
videoButton.textContent = "Add Profile Video";
videoButton.hidden = true;
const videoInput = document.createElement("input");
videoInput.dataset.mediaField = "video";
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
  removeVideoButton.disabled = true;
  videoButton.disabled = true;
  try {
    const mediaKey = await uploadCloudMedia(file);
    const response = await profileFetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be saved");
    setProfileVideoControls(mediaKey);
    alert("Profile video saved. Open the Media tab to view it.");
  } catch (error) { alert(error.message); }
  finally { videoButton.disabled = false; removeVideoButton.disabled = false; videoInput.value = ""; }
});
mediaTools.append(videoButton, videoInput);
const removeVideoButton = document.createElement("button");
removeVideoButton.type = "button";
removeVideoButton.dataset.mediaField = "video";
removeVideoButton.textContent = "Remove Profile Video";
removeVideoButton.hidden = true;
removeVideoButton.addEventListener("click", async () => {
  if (!confirm("Remove profile video?")) return;
  removeVideoButton.disabled = true;
  try {
    const response = await profileFetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey: "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be removed");
    setProfileVideoControls("");
    alert("Profile video removed from your profile.");
  } catch (error) { alert(error.message); }
  finally { removeVideoButton.disabled = false; videoButton.disabled = false; }
});
mediaTools.appendChild(removeVideoButton);
let profileVideoControlsVersion = 0;
function setProfileVideoControls(mediaKey) {
  profileVideoControlsVersion++;
  videoButton.hidden = false;
  removeVideoButton.hidden = !mediaKey;
}
async function revealProfileVideoControls() {
  const version = ++profileVideoControlsVersion;
  try {
    const response = await profileFetch(profileApi + "/profile-video", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (version !== profileVideoControlsVersion) return;
    setProfileVideoControls(data.mediaKey);
  } catch { /* Keep the existing controls when the lookup is unavailable. */ }
}

actions.insertAdjacentElement("afterend", mediaTools);
if (viewingOtherProfile) {
  editButton.hidden = true;
  mediaTools.hidden = true;
}

const tabs = document.createElement("nav");
tabs.className = "profile-tabs";
tabs.setAttribute("aria-label", "Profile sections");
tabs.setAttribute("role", "tablist");
for (const name of ["Posts", "Featured", "Memories", "About", "Friends", "Media"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  if (name === "Memories") tab.hidden = true;
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
  if (post.postId) { article.dataset.postId = post.postId; article.dataset.isOwner = String(post.isOwner === true); article.dataset.viewCount = String(post.viewCount || 0); }
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
  if (/^[a-f0-9-]{36}$/.test(String(post.postId || ""))) {
    const open = document.createElement("a");
    open.className = "secondary profile-post-open";
    open.href = "feed.html#post-" + encodeURIComponent(post.postId);
    open.textContent = "View in Feed";
    article.appendChild(open);
  }
  window.danzstakRenderSharedPost?.(article, post);
  window.danzstakRenderMediaTags?.(article, post);
  if (post.isOwner === true && post.postId) {
    const feature = document.createElement("button");
    feature.type = "button"; feature.className = "secondary";
    const paint = () => { feature.textContent = post.featured ? "Remove from Featured" : "Feature on profile"; feature.setAttribute("aria-pressed", String(post.featured === true)); };
    paint();
    feature.addEventListener("click", async () => {
      feature.disabled = true;
      try {
        const response = await profileFetch(profileApi + "/secure-posts/" + encodeURIComponent(post.postId), {method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({featured:!post.featured})});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Featured post could not be saved.");
        post.featured = !post.featured; paint();
        if (!post.featured && tabs.querySelector('[data-profile-tab="Featured"]').getAttribute("aria-selected") === "true") article.remove();
      } catch (error) { alert(error.message); }
      finally { feature.disabled = false; }
    });
    article.appendChild(feature);
  }
  if (post.canRemoveFromProfile === true && post.postId) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary profile-wall-remove";
    remove.textContent = "Remove from my profile";
    remove.addEventListener("click", async () => {
      if (!confirm("Remove this post from your profile?")) return;
      remove.disabled = true;
      try {
        const response = await profileFetch(profileApi + "/secure-posts/" + encodeURIComponent(post.postId), { method: "DELETE", credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "The post could not be removed.");
        article.remove();
      } catch (error) { alert(error.message); }
      finally { remove.disabled = false; }
    });
    article.appendChild(remove);
  }
  return article;
}

function profileWallComposer(profile) {
  const section = document.createElement("section");
  section.className = "profile-wall-composer";
  if (!profile.canPostToProfile) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = profile.profilePostPermission === "friends" ? "Only accepted friends can post on this profile." : "Only this member can post on their profile.";
    section.appendChild(note);
    return section;
  }
  if (profile.isOwner) return section;
  const form = document.createElement("form");
  const heading = document.createElement("h3");
  const textarea = document.createElement("textarea");
  const certifyLabel = document.createElement("label");
  const certify = document.createElement("input");
  const submit = document.createElement("button");
  const status = document.createElement("p");
  heading.textContent = `Post on ${profile.name || "this member"}’s profile`;
  textarea.name = "content"; textarea.maxLength = 5000; textarea.required = true; textarea.placeholder = "Write something…";
  certify.type = "checkbox"; certify.required = true;
  certifyLabel.className = "profile-wall-certify";
  certifyLabel.append(certify, document.createTextNode("This is my original content and may be shared on DanzStak."));
  submit.type = "submit"; submit.className = "button"; submit.textContent = "Post";
  status.className = "muted"; status.setAttribute("role", "status");
  form.append(heading, textarea, certifyLabel, submit, status);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true; status.textContent = "Posting…";
    try {
      const response = await profileFetch(profileApi + "/secure-posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: textarea.value, audience: "public", originalContentCertified: true, profileMemberId: profile.memberId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The post could not be published.");
      textarea.value = ""; certify.checked = false; status.textContent = "Posted to this profile.";
      await loadProfilePosts(false);
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  section.appendChild(form);
  return section;
}

let profileTabVersion = 0;
async function loadProfilePosts(mediaOnly = false, collection = "posts") {
  const version = profileTabVersion;
  tabMessage.textContent = mediaOnly ? "Loading media…" : "Loading posts…";
  try {
    const response = await profileFetch(profileApi + "/secure-posts", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Profile posts could not be loaded");
    const data = await response.json();
    if (version !== profileTabVersion) return;
    const profileEmail = String(window.danzstakCurrentProfile?.email || "").toLowerCase();
    const profileMemberId = String(window.danzstakCurrentProfile?.memberId || "");
    let posts = window.danzstakProfileCollections.select(data.posts || [], collection, profileEmail, !viewingOtherProfile, new Date(), profileMemberId);
    if (mediaOnly) posts = posts.filter(post => post.mediaUrl && ["image", "video"].includes(post.mediaType));
    tabMessage.replaceChildren();
    if (collection === "posts" && !mediaOnly && window.danzstakCurrentProfile && typeof profileWallComposer === "function") tabMessage.appendChild(profileWallComposer(window.danzstakCurrentProfile));
    if (collection !== "posts") {
      const note = document.createElement("p"); note.className = "muted";
      note.textContent = collection === "memories" ? "Only you can see this Memories view. These are your posts from this day in previous years; their original audiences stay unchanged." : "Featured posts keep their original audience. Highlighting a post does not make it public.";
      tabMessage.appendChild(note);
      if (!posts.length) { const empty = document.createElement("p"); empty.textContent = collection === "memories" ? "No memories from this day yet." : "No featured posts to show yet."; tabMessage.appendChild(empty); }
    }
    for (const post of posts) tabMessage.appendChild(profilePostCard(post));
    if (mediaOnly) {
      const params = new URLSearchParams();
      const profileEmail = String(window.danzstakCurrentProfile?.email || "");
      if (profileEmail) params.set("email", profileEmail);
      const videoResponse = await profileFetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" });
      if (version !== profileTabVersion) return;
      if (!videoResponse.ok && videoResponse.status !== 404) throw new Error("Profile video is temporarily unavailable.");
      if (videoResponse.ok) {
        const stored = await videoResponse.json();
        if (version !== profileTabVersion) return;
        if (stored.mediaUrl) {
          tabMessage.appendChild(profilePostCard({ content: "Profile video", mediaType: "video", mediaUrl: stored.mediaUrl }));
        } else if (stored.mediaKey && !viewingOtherProfile) {
          const viewResponse = await profileFetch(profileApi + "/stories", {
            method: "POST", credentials: "include", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view", mediaKey: stored.mediaKey, mediaType: "video" })
          });
          if (viewResponse.ok) {
            const view = await viewResponse.json();
            if (version !== profileTabVersion) return;
            tabMessage.appendChild(profilePostCard({ content: "Profile video", mediaType: "video", mediaUrl: view.mediaUrl }));
          }
        }
      }
    }
    if (!posts.length && !tabMessage.childElementCount) { tabMessage.textContent = mediaOnly ? "No photos or videos to show yet." : "No posts to show yet."; return; }
  } catch (error) {
    if (version !== profileTabVersion) return;
    if (tabMessage.childElementCount) {
      const notice = document.createElement("p");
      notice.className = "muted";
      notice.textContent = "Some profile media could not be loaded. Reopen Media to retry.";
      tabMessage.appendChild(notice);
    } else tabMessage.textContent = error.message;
  }
}

async function loadProfileFriends() {
  const version = profileTabVersion;
  if (viewingOtherProfile) { tabMessage.textContent = "This member’s friend list is private."; return; }
  tabMessage.textContent = "Loading friends…";
  try {
    const [friendsResult, directoryResult] = await Promise.allSettled([
      profileFetch(profileApi + "/friends", { credentials: "include", cache: "no-store" }),
      profileFetch(profileApi + "/calls/directory", { credentials: "include", cache: "no-store" })
    ]);
    const response = friendsResult.status === "fulfilled" ? friendsResult.value : null;
    if (!response?.ok) throw new Error("Friends could not be loaded");
    const data = await response.json();
    const directoryResponse = directoryResult.status === "fulfilled" ? directoryResult.value : null;
    const online = new Set(directoryResponse?.ok
      ? ((await directoryResponse.json()).users || [])
        .filter(user => user.online === true)
        .map(user => String(user.email || "").toLowerCase())
      : []);
    if (version !== profileTabVersion) return;
    tabMessage.replaceChildren();
    if (!(data.friends || []).length) { tabMessage.textContent = "No friends yet."; return; }
    const grid = document.createElement("div"); grid.className = "profile-friend-grid";
    for (const friend of data.friends) {
      const link = document.createElement("a"); link.className = "profile-friend-card"; link.href = "profile.html?member=" + encodeURIComponent(friend.memberId);
      const avatar = friend.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
      if (friend.picture) { avatar.src = friend.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
      else { avatar.textContent = (friend.name || "DanzStak member").charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
      const copy = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = friend.name || "DanzStak member";
      const status = document.createElement("span");
      const isOnline = online.has(String(friend.email || "").toLowerCase());
      status.className = isOnline ? "profile-friend-presence online" : "profile-friend-presence";
      status.title = isOnline ? "Online" : "Offline";
      status.setAttribute("aria-hidden", "true");
      const availability = document.createElement("small"); availability.textContent = isOnline ? "Online" : "Offline";
      copy.append(name, availability); link.append(avatar, copy, status); grid.appendChild(link);
    }
    tabMessage.appendChild(grid);
  } catch (error) { if (version === profileTabVersion) tabMessage.textContent = error.message; }
}

tabs.addEventListener("click", async event => {
  const tab = event.target.closest("[data-profile-tab]");
  if (!tab) return;
  profileTabVersion += 1;
  tabs.querySelectorAll("button").forEach(button => { const selected = button === tab; button.classList.toggle("active", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
  const name = tab.dataset.profileTab;
  details.hidden = name !== "About";
  tabMessage.hidden = name === "About";
  if (name === "Posts") await loadProfilePosts(false);
  else if (name === "Featured") await loadProfilePosts(false, "featured");
  else if (name === "Memories" && !viewingOtherProfile) await loadProfilePosts(false, "memories");
  else if (name === "Friends") await loadProfileFriends();
  else if (name === "Media") await loadProfilePosts(true);
});
tabs.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = [...tabs.querySelectorAll('[role="tab"]:not([hidden])')];
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
  '<label>DanzStak language<select name="language" data-profile-language></select></label>' +
  '<label>Who can post on your profile?<select name="profilePostPermission"><option value="owner">Only me</option><option value="friends">Friends</option><option value="anyone">Anyone on DanzStak</option></select></label>' +
  '<p class="edit-note">Share only information you want members to see. Profile text must be your original content.</p>' +
  '<div class="edit-actions"><button class="secondary" type="button" data-cancel>Cancel</button><button class="button" type="submit">Save Changes</button></div>' +
  '<div class="profile-import"><button type="button" data-facebook-import>Import from Facebook</button><p>Preview your export, set Public, Friends, or Only me in batches, and review shared-source posts before copying them.</p></div>';
profileCard.appendChild(panel);
const profileLanguage = panel.querySelector("[data-profile-language]");
for (const [code, label] of (window.danzstakLanguages || [["en", "English"]])) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = label;
  profileLanguage.appendChild(option);
}
const mediaItems = [...mediaTools.children];
for (const [field,label] of [["avatar","Profile photo"],["cover","Cover photo"],["video","Profile video"]]) {
  const menu = document.createElement("details"); menu.className = "profile-media-menu";
  const summary = document.createElement("summary"); summary.textContent = label; menu.appendChild(summary);
  for (const control of mediaItems) if (control.dataset.mediaField === field) menu.appendChild(control);
  mediaTools.appendChild(menu);
}
panel.insertBefore(mediaTools, panel.querySelector("label"));
panel.querySelector("[data-facebook-import]").addEventListener("click", event => window.openDanzStakFacebookImport?.(event.currentTarget));

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
  panel.elements.profilePostPermission.value = profile.profilePostPermission || "owner";
  panel.elements.language.value = (() => { try { return localStorage.getItem("danzstak_language") || document.documentElement.lang || "en"; } catch { return document.documentElement.lang || "en"; } })();
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
});

panel.querySelector("[data-cancel]").addEventListener("click", () => { panel.hidden = true; repositioning = false; finishReposition.hidden = true; coverElement.classList.remove("repositioning"); repositionButton.classList.remove("active"); repositionButton.textContent = "Reposition Cover"; });
panel.addEventListener("submit", async event => {
  event.preventDefault();
  if (!panel.reportValidity()) return;
  const profile = Object.fromEntries(new FormData(panel).entries());
  profile.handle = profile.handle.replace(/^@/, "");
  const language = profile.language;
  delete profile.language;
  if (window.danzstakSetLanguage) window.danzstakSetLanguage(language);
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
  tabs.querySelector('[data-profile-tab="Memories"]').hidden = event.detail?.isOwner !== true;
  const profile = event.detail || {};
  if (profile.isOwner === true) { viewingOtherProfile = false; editButton.hidden = false; mediaTools.hidden = false; }
  applyProfile(profile.cloudProfile ? profile : savedProfile());
  if (profile.cloudProfile) {
    fitCoverButton.classList.toggle("active", Boolean(profile.coverFit));
    fitCoverButton.textContent = profile.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
    if (!viewingOtherProfile) revealProfileVideoControls();
  }
});
