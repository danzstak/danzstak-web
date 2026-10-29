"use strict";

const devicePreferenceMemory = new Map();

try {
  document.documentElement.classList.toggle("dark-mode", readDevicePreference("danzstak_dark_mode") === "1");
  document.documentElement.classList.toggle("reduce-motion", readDevicePreference("danzstak_reduce_motion") === "1");
  document.documentElement.lang = readDevicePreference("danzstak_language") || navigator.language || "en";
} catch { /* Device preferences remain optional when storage is unavailable. */ }

const featurePanel = document.getElementById("featureView");
const featureHeading = document.getElementById("featureTitle");
const featureText = document.getElementById("featureDescription");
const localKey = "danzstak_dev_sections";
const postPreferencesKey = "danzstak-post-preferences";
const notificationControls = [...document.querySelectorAll('[data-feature="Notifications"]')];
const notificationAnnouncer = document.createElement("div");
notificationAnnouncer.className = "visually-hidden";
notificationAnnouncer.setAttribute("role", "status");
notificationAnnouncer.setAttribute("aria-live", "polite");
document.body.appendChild(notificationAnnouncer);
let lastNotificationCount = null;
const notificationSourceCounts = { social: null, engagement: null };
let notificationCountLoading = false;

function isLocalHost() {
  return location.hostname === "127.0.0.1" || location.hostname === "localhost";
}

function updateNotificationCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  for (const control of notificationControls) {
    if (!control.dataset.baseLabel) control.dataset.baseLabel = control.dataset.feature || control.textContent.trim();
    const badge = control.querySelector(".nav-count");
    if (badge) { badge.hidden = safeCount === 0; badge.textContent = safeCount > 99 ? "99+" : String(safeCount); }
    else control.textContent = safeCount ? `${control.dataset.baseLabel} (${safeCount})` : control.dataset.baseLabel;
    control.setAttribute("aria-label", safeCount ? `${control.dataset.baseLabel}, ${safeCount} new` : control.dataset.baseLabel);
  }
  if (lastNotificationCount !== null && safeCount !== lastNotificationCount) notificationAnnouncer.textContent = safeCount ? `${safeCount} new notification${safeCount === 1 ? "" : "s"}.` : "No new notifications.";
  lastNotificationCount = safeCount;
}

function formatNotificationTimestamp(value) {
  const created = new Date(value || "");
  if (Number.isNaN(created.valueOf())) return "";
  return created.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatReactionNotification(displayName, reaction) {
  const label = String(reaction || "").trim();
  const phrases = {
    Like: "liked your post.",
    Dislike: "disliked your post.",
    Love: "loved your post.",
    Laugh: "laughed at your post.",
    Wow: "reacted Wow to your post.",
    Sad: "reacted Sad to your post.",
    Fire: "reacted Fire to your post."
  };
  return `${displayName} ${phrases[label] || "reacted to your post."}`;
}

async function refreshNotificationCount() {
  if (document.hidden || notificationCountLoading) return;
  if (readSections().Settings?.notifications === false) {
    updateNotificationCount(0);
    return;
  }
  notificationCountLoading = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const responses = await Promise.allSettled([
      fetch("https://api.danzstak.com/notifications", { credentials: "include", cache: "no-store", signal: controller.signal }),
      fetch("https://api.danzstak.com/engagement-notifications", { credentials: "include", cache: "no-store", signal: controller.signal })
    ]);
    let succeeded = false;
    for (const [index, result] of responses.entries()) {
      if (result.status !== "fulfilled" || !result.value.ok) continue;
      const key = index === 0 ? "social" : "engagement";
      const notices = ((await result.value.json()).notifications || []);
      notificationSourceCounts[key] = key === "engagement" ? notices.filter(notice => notice.unread !== false).length : notices.length;
      succeeded = true;
    }
    if (succeeded) updateNotificationCount(Object.values(notificationSourceCounts).reduce((total, count) => total + (count || 0), 0));
  } catch { /* The next scheduled refresh will retry. */ }
  finally { clearTimeout(timeout); notificationCountLoading = false; }
}

function readDevicePreference(key) {
  if (devicePreferenceMemory.has(key)) return devicePreferenceMemory.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}
function cacheDevicePreference(key, value) {
  devicePreferenceMemory.set(key, String(value));
  try { localStorage.setItem(key, value); } catch { /* Keep the current device choice in memory. */ }
}
let transientSections = null;
function readSections() {
  if (transientSections) return transientSections;
  try { return JSON.parse(localStorage.getItem(localKey) || "{}"); }
  catch { return {}; }
}

function writeSections(value) {
  try { localStorage.setItem(localKey, JSON.stringify(value)); transientSections = null; }
  catch { transientSections = value; }
}

function openTextActionDialog({ title, description, label, placeholder = "", submitLabel, maxLength = 500 }) {
  document.querySelector(".text-action-dialog")?.close();
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "post-report-dialog text-action-dialog";
    const form = document.createElement("form");
    form.method = "dialog";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = description;
    const field = document.createElement("label");
    field.append(document.createTextNode(label));
    const textarea = document.createElement("textarea");
    textarea.rows = 5;
    textarea.maxLength = maxLength;
    textarea.required = true;
    textarea.placeholder = placeholder;
    field.appendChild(textarea);
    const status = document.createElement("p");
    status.className = "post-report-status";
    status.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "post-report-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = submitLabel;
    actions.append(cancel, submit);
    form.append(heading, copy, field, status, actions);
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    let settled = false;
    const finish = value => { if (settled) return; settled = true; resolve(value); dialog.close(); };
    cancel.addEventListener("click", () => finish(null));
    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = textarea.value.trim();
      if (!value) { status.textContent = "Enter a message before continuing."; textarea.focus(); return; }
      finish(value);
    });
    dialog.addEventListener("close", () => { if (!settled) { settled = true; resolve(null); } dialog.remove(); }, { once: true });
    dialog.showModal();
    textarea.focus();
  });
}

function dataSaverEnabled() {
  try { return readDevicePreference("danzstak_data_saver") === "1"; }
  catch { return false; }
}

function applyDataSaver(enabled) {
  try { cacheDevicePreference("danzstak_data_saver", enabled ? "1" : "0"); } catch {}
  document.documentElement.classList.toggle("data-saver", enabled);
  document.querySelectorAll("video").forEach(video => {
    video.preload = enabled ? "none" : "metadata";
    video.autoplay = !enabled;
    if (enabled) video.pause();
    else if (video.dataset.inView === "true" || video.closest(".story")) video.play().catch(() => {});
  });
  if (typeof renderPlayableReels === "function" && typeof reelsList !== "undefined") renderPlayableReels();
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

function openPostInFeed(post) {
  const feedSearch = document.querySelector(".search");
  if (feedSearch?.value) { feedSearch.value = ""; filterFeedPosts(); }
  featurePanel.hidden = true;
  document.getElementById("newsFeedView").hidden = false;
  history.pushState(null, "", "#" + (post.id || "feed"));
  if (typeof restoreWorkspaceRoute === "function") restoreWorkspaceRoute();
  post.tabIndex = -1;
  post.focus({ preventScroll: true });
  post.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderPublishedEvents(publishedEvents) {
  publishedEvents.replaceChildren();
  const eventPosts = [...document.querySelectorAll("#feed .post")].filter(post => post.querySelector(".post-content")?.textContent.startsWith("📅 Event:"));
  if (!eventPosts.length) {
    const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "No published events yet."; publishedEvents.appendChild(empty);
  }
  for (const post of eventPosts) {
    const card = document.createElement("article"); card.className = "published-event-card";
    const content = document.createElement("p"); content.textContent = post.querySelector(".post-content").textContent;
    const meta = document.createElement("small"); meta.textContent = post.querySelector("time")?.textContent || "Published on DanzStak";
    const view = document.createElement("button"); view.type = "button"; view.className = "secondary"; view.textContent = "View in Your Mix";
    view.addEventListener("click", () => openPostInFeed(post));
    post.tabIndex = -1;
    card.append(content, meta, view); publishedEvents.appendChild(card);
  }
}

function renderSavedPosts(list) {
  list.replaceChildren();
  const preferences = readPostPreferences();
  const posts = [...document.querySelectorAll("#feed .post[data-post-id]")].filter(post => preferences[String(post.dataset.postId)]?.saved === true);
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No saved posts yet. Choose Save on any post, photo or video to keep it here.";
    list.appendChild(empty);
  }
  for (const post of posts) {
    const card = document.createElement("article"); card.className = "published-event-card";
    const content = document.createElement("p"); content.textContent = post.querySelector(".post-content")?.textContent || "Saved media";
    const author = document.createElement("small"); author.textContent = post.querySelector(".post-header a")?.textContent || "DanzStak post";
    const view = document.createElement("button"); view.type = "button"; view.className = "secondary"; view.textContent = "View post";
    view.addEventListener("click", () => openPostInFeed(post));
    card.append(content, author);
    const media = post.querySelector(".post-media");
    if (media) {
      const preview = media.cloneNode(false);
      preview.removeAttribute("id");
      preview.className = "saved-post-media";
      if (preview.tagName === "VIDEO") { preview.controls = true; preview.autoplay = false; preview.muted = false; preview.preload = "metadata"; }
      card.appendChild(preview);
    }
    card.appendChild(view); list.appendChild(card);
  }
}

async function friendActionFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("The friend service took too long to respond. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}

function createFriendRequestForm() {
  const form = document.createElement("form");
  form.className = "friend-request-form";
  const email = field("Add a friend by email", "email", "name@example.com");
  email.input.required = true;
  email.input.maxLength = 254;
  email.input.autocomplete = "email";
  const send = document.createElement("button");
  send.type = "submit"; send.className = "primary"; send.textContent = "Send friend request";
  const status = document.createElement("p"); status.className = "muted"; status.setAttribute("role", "status");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (send.disabled || !form.reportValidity()) return;
    const address = email.input.value.trim().toLowerCase();
    send.disabled = true;
    status.textContent = "Sending friend request…";
    try {
      const response = await friendActionFetch("/friends/request", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Friend request could not be sent. Please try again.");
      status.textContent = data.alreadyFriends ? "You are already friends with this member." : "Friend request sent. It will appear in their DanzStak notifications.";
      if (email.input.value.trim().toLowerCase() === address) email.input.value = "";
    } catch (error) { status.textContent = error.message || "Friend request could not be sent. Please try again."; }
    finally { send.disabled = false; }
  });
  form.append(email.wrap, send, status);
  return form;
}

async function groupFetch(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("The group service took too long to respond. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}

async function migrateLocalGroups(localGroups, remoteGroups) {
  const groups = [...remoteGroups], pending = [], joinedIds = [];
  const key = group => `${String(group.name || "").toLowerCase()}|${group.category}`;
  const known = new Set(groups.filter(group => group.isOwner === true).map(key));
  for (const local of localGroups.filter(group => !group.cloud)) {
    if (known.has(key(local))) continue;
    try {
      const response = await groupFetch("/groups", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: local.name, category: local.category, description: local.description, communityStandards: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.group?.id) { pending.push(local); continue; }
      groups.push({ ...result.group, custom: true, cloud: true });
      joinedIds.push(result.group.id);
      known.add(key(local));
    } catch { pending.push(local); }
  }
  return { groups, pending, joinedIds };
}

async function respondToNotificationRequest(row, email, accept) {
  const buttons = [...row.querySelectorAll(".notification-actions button")];
  if (buttons.some(button => button.disabled)) return false;
  buttons.forEach(button => { button.disabled = true; });
  row.querySelector(".notification-request-status")?.remove();
  try {
    const response = await friendActionFetch("/friends/respond", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, accept })
    });
    if (!response.ok) throw new Error("Friend request could not be updated. Please try again.");
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    const status = document.createElement("p");
    status.className = "notification-request-status muted";
    status.setAttribute("role", "status");
    status.textContent = "Friend request could not be updated. Please try again.";
    row.appendChild(status);
    return false;
  }
  row.remove();
  await refreshNotificationCount().catch(() => {});
  if (typeof loadOnlineUsers === "function") Promise.resolve(loadOnlineUsers()).catch(() => {});
  if (typeof loadFriends === "function") Promise.resolve(loadFriends()).catch(() => {});
  return true;
}

let workspaceRenderVersion = 0;

async function openAccountActivity(opener) {
  document.querySelector(".account-activity-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.className = "account-activity-dialog";
  dialog.setAttribute("aria-labelledby", "accountActivityTitle");
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.id = "accountActivityTitle";
  title.textContent = "Your DanzStak activity";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "activity-close";
  close.setAttribute("aria-label", "Close activity history");
  close.textContent = "Close";
  const summary = document.createElement("p");
  summary.className = "activity-summary";
  summary.textContent = "Loading your recent activity…";
  summary.setAttribute("role", "status");
  const list = document.createElement("div");
  list.className = "activity-list";
  header.append(title, close);
  dialog.append(header, summary, list);
  document.body.appendChild(dialog);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { dialog.remove(); opener?.focus(); }, { once: true });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.showModal();
  close.focus();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("https://api.danzstak.com/secure-posts", { credentials: "include", cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Activity could not be loaded.");
    const posts = Array.isArray(data.posts) ? data.posts.slice(0, 20) : [];
    const engagementByPost = {};
    let next = 0;
    const worker = async () => {
      while (next < posts.length) {
        const post = posts[next++];
        try {
          const engagementResponse = await fetch("https://api.danzstak.com/engagement?postId=" + encodeURIComponent(post.postId), { credentials: "include", cache: "no-store", signal: controller.signal });
          if (engagementResponse.ok) engagementByPost[post.postId] = await engagementResponse.json();
        } catch (error) { if (error.name === "AbortError") throw error; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, posts.length) }, worker));
    const activity = window.danzstakActivityCore?.buildActivity(posts, engagementByPost, 100) || [];
    list.replaceChildren();
    const postCount = activity.filter(item => item.type === "post").length;
    const commentCount = activity.filter(item => item.type === "comment").length;
    summary.textContent = `${postCount} recent post${postCount === 1 ? "" : "s"} and ${commentCount} recent comment${commentCount === 1 ? "" : "s"}.`;
    if (!activity.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No recent posts or comments are available yet.";
      list.appendChild(empty);
      return;
    }
    for (const item of activity) {
      const link = document.createElement("a");
      link.className = "activity-item";
      link.href = "feed.html?view=feed#post-" + encodeURIComponent(item.postId);
      const kind = document.createElement("strong");
      kind.textContent = item.type === "post" ? "You published a post" : "You commented on a post";
      const text = document.createElement("span");
      text.textContent = item.text.length > 180 ? item.text.slice(0, 177) + "…" : item.text;
      const meta = document.createElement("small");
      const created = new Date(item.createdAt);
      meta.textContent = created.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) + (item.audience ? " · " + item.audience : "");
      link.append(kind, text, meta);
      list.appendChild(link);
    }
  } catch (error) {
    summary.textContent = error.name === "AbortError" ? "Activity took too long to load. Close this panel and try again." : error.message;
  } finally { clearTimeout(timeout); }
}

function renderWorkspace(name) {
  const renderVersion = ++workspaceRenderVersion;
  const isCurrentWorkspace = () => renderVersion === workspaceRenderVersion && !featurePanel.hidden;
  let workspace = featurePanel.querySelector(".feature-workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.className = "feature-workspace";
    featurePanel.appendChild(workspace);
  }
  workspace.replaceChildren();
  workspace.classList.remove("settings-workspace", "events-workspace", "groups-workspace");
  const saved = readSections();

  if (name === "Saved") {
    featureText.textContent = "Posts, photos and videos you saved. Choose Saved again on a post to remove it.";
    const list = document.createElement("div"); list.className = "published-events saved-posts";
    workspace.appendChild(list);
    renderSavedPosts(list);
    return;
  }

  if (name === "Groups") {
    workspace.classList.add("groups-workspace");
    featureText.textContent = "Discover Tribes, keep up with communities you joined, and meet people who share your interests.";
    const groupCategoryName = category => ({Artists:"Visual Artist", Creators:"Bands", "Venues & Promoters":"Venues", "Local Scenes":"Scenes", "Industry Networking":"Industry"})[category] || category;
    const legacyCategoryOrder = ["Artists", "DJs & Producers", "Fans", "Venues & Promoters", "Events", "Local Scenes", "Creators", "Industry Networking", "Politics", "Religion"];
    const categories = ["Artists", "Creators", "DJs & Producers", "Fans", "Venues & Promoters", "Local Scenes", "Industry Networking", "Events", "Politics", "Religion"];
    const toolbar = document.createElement("div");
    toolbar.className = "groups-toolbar";
    const tabs = document.createElement("div");
    tabs.className = "groups-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Tribe views");
    let groupView = "discover";
    const viewButtons = {};
    for (const [value, label] of [["discover", "Discover"], ["joined", "Your Tribes"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "groups-tab";
      button.textContent = label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(value === groupView));
      button.addEventListener("click", () => {
        groupView = value;
        Object.entries(viewButtons).forEach(([key, item]) => item.setAttribute("aria-selected", String(key === value)));
        renderGroups();
      });
      viewButtons[value] = button;
      tabs.appendChild(button);
    }
    const discoverControls = document.createElement("div");
    discoverControls.className = "groups-discovery-controls";
    const groupSearch = document.createElement("input");
    groupSearch.type = "search";
    groupSearch.placeholder = "Search Tribes";
    groupSearch.setAttribute("aria-label", "Search Tribes");
    const categoryFilter = document.createElement("select");
    categoryFilter.setAttribute("aria-label", "Filter Tribes by category");
    const allCategories = document.createElement("option");
    allCategories.value = "";
    allCategories.textContent = "All categories";
    categoryFilter.appendChild(allCategories);
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = groupCategoryName(category);
      categoryFilter.appendChild(option);
    }
    const createToggle = document.createElement("button");
    createToggle.type = "button";
    createToggle.className = "primary groups-create-toggle";
    createToggle.textContent = "+ Create Tribe";
    createToggle.setAttribute("aria-expanded", "false");
    discoverControls.append(groupSearch, categoryFilter, createToggle);
    toolbar.append(tabs, discoverControls);
    const createBox = document.createElement("div");
    createBox.className = "group-create-box";
    createBox.hidden = true;
    createToggle.addEventListener("click", () => {
      createBox.hidden = !createBox.hidden;
      createToggle.setAttribute("aria-expanded", String(!createBox.hidden));
      createToggle.textContent = createBox.hidden ? "+ Create Tribe" : "Close";
      if (!createBox.hidden) groupName.input.focus();
    });
    const groupName = field("Tribe name", "text", "Name your tribe");
    const categoryLabel = document.createElement("label");
    categoryLabel.textContent = "Category";
    const categorySelect = document.createElement("select");
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = groupCategoryName(category);
      categorySelect.appendChild(option);
    }
    categoryLabel.appendChild(categorySelect);
    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "primary";
    createButton.textContent = "Checking group service…";
    createButton.disabled = true;
    const standardsLabel = document.createElement("label");
    standardsLabel.className = "group-standards-agreement";
    const standardsCheckbox = document.createElement("input");
    standardsCheckbox.type = "checkbox";
    standardsLabel.append(standardsCheckbox, document.createTextNode("I agree to enforce DanzStak Community Standards: no hate speech, harassment, threats, or targeted abuse."));
    const standardsError = document.createElement("p");
    standardsError.className = "group-standards-error";
    standardsError.textContent = "You must agree to the Community Standards before creating a group.";
    standardsError.hidden = true;
    standardsCheckbox.addEventListener("change", () => { standardsError.hidden = standardsCheckbox.checked; });
    createBox.append(groupName.wrap, categoryLabel, standardsLabel, standardsError, createButton);
    const grid = document.createElement("div");
    grid.className = "groups-grid";
    grid.setAttribute("aria-live", "polite");
    let customGroups = [...(saved.CustomGroups || [])];
    const membershipChanges = new Map();
    const detail = document.createElement("section");
    detail.className = "tribe-detail";
    detail.hidden = true;
    const groupIcon = category => ({ Artists:"🎨", Creators:"🎸", "DJs & Producers":"🎛️", Fans:"🤘", "Venues & Promoters":"🎟️", "Local Scenes":"📍", "Industry Networking":"🤝", Events:"📅", Politics:"💬", Religion:"🕊️" })[category] || "👥";

    async function saveGroupMembership(group, nextJoined) {
      const response = await groupFetch("/groups/membership", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ groupId: group.id, joined: nextJoined })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Membership could not be saved");
      saved.GroupsJoined = saved.GroupsJoined || {};
      saved.GroupsJoined[group.id] = nextJoined;
      membershipChanges.set(group.id, nextJoined);
      group.joined = nextJoined;
      writeSections(saved);
    }

    function showTribeDirectory() {
      detail.hidden = true;
      toolbar.hidden = false;
      grid.hidden = false;
      featureText.textContent = "Discover Tribes, keep up with communities you joined, and meet people who share your interests.";
      renderGroups();
    }

    function renderTribePosts(group, target) {
      target.replaceChildren();
      const posts = (window.danzstakLoadedPosts || []).filter(post => post.groupId === group.id);
      if (!posts.length) {
        const empty = document.createElement("div"); empty.className = "tribe-feed-empty";
        const title = document.createElement("strong"); title.textContent = "Start the conversation";
        const copy = document.createElement("span"); copy.textContent = "The first post in this Tribe will appear here.";
        empty.append(title, copy); target.appendChild(empty); return;
      }
      for (const post of posts) {
        if (typeof window.createPostElement !== "function") continue;
        const article = window.createPostElement(post.content, post.authorName, post.createdAt, post.audience, post.mediaUrl, post.mediaType, post.postId, post.isOwner, post.userId, post.commentPolicy, post.editHistory, post.location, post.authorPicture, post.groupId, post.groupName);
        article.dataset.viewCount = String(post.viewCount || 0);
        window.danzstakRenderSharedPost?.(article, post);
        window.danzstakRenderMediaTags?.(article, post);
        target.appendChild(article);
      }
    }

    async function renderCrew(group, panel) {
      panel.replaceChildren();
      const loading = document.createElement("p"); loading.className = "muted"; loading.textContent = "Loading The Crew…"; panel.appendChild(loading);
      try {
        const response = await groupFetch("/groups/" + encodeURIComponent(group.id) + "/members", { credentials: "include", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data.members)) throw new Error(data.error || "The Crew could not be loaded");
        panel.replaceChildren();
        const heading = document.createElement("div"); heading.className = "tribe-crew-heading";
        const title = document.createElement("strong"); title.textContent = "The Crew";
        const count = document.createElement("span"); count.textContent = `${data.members.length} ${data.members.length === 1 ? "member" : "members"}`;
        heading.append(title, count); panel.appendChild(heading);
        for (const member of data.members) {
          const row = document.createElement("div"); row.className = "tribe-crew-member";
          const memberId = String(member.memberId || ""), validMemberId = /^[a-f0-9-]{36}$/.test(memberId), profileUrl = member.isMe ? "profile.html" : validMemberId ? "profile.html?member=" + encodeURIComponent(memberId) : "";
          const avatar = document.createElement(profileUrl ? "a" : "span"); avatar.className = "tribe-crew-avatar";
          if (profileUrl) { avatar.href = profileUrl; avatar.setAttribute("aria-label", "Open " + (member.name || "member") + " profile"); }
          if (member.picture) { const image = document.createElement("img"); image.src = member.picture; image.alt = ""; image.referrerPolicy = "no-referrer"; avatar.appendChild(image); }
          else avatar.textContent = String(member.name || "D").charAt(0).toUpperCase();
          const identity = document.createElement("div");
          const name = document.createElement(profileUrl ? "a" : "strong"); name.textContent = member.name || "DanzStak member"; name.className = "tribe-crew-name"; if (profileUrl) name.href = profileUrl;
          const role = document.createElement("span"); role.textContent = member.role === "elder" ? "Elder" : "The Crew";
          identity.append(name, role); row.append(avatar, identity);
          if (data.canManageElders && !member.isMe) {
            const manage = document.createElement("button"); manage.type = "button"; manage.className = "secondary tribe-elder-toggle";
            manage.textContent = member.role === "elder" ? "Return to Crew" : "Invite as Elder";
            manage.addEventListener("click", async () => {
              manage.disabled = true;
              try {
                const update = await groupFetch("/groups/" + encodeURIComponent(group.id) + "/elders", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: member.memberId, elder: member.role !== "elder" }) });
                const result = await update.json().catch(() => ({}));
                if (!update.ok) throw new Error(result.error || "Elder role could not be updated");
                await renderCrew(group, panel);
              } catch (error) { alert(error.message); manage.disabled = false; }
            });
            row.appendChild(manage);
          }
          panel.appendChild(row);
        }
      } catch (error) { loading.textContent = error.message; }
    }

    function openTribe(group) {
      toolbar.hidden = true; createBox.hidden = true; grid.hidden = true; detail.hidden = false; detail.replaceChildren();
      featureText.textContent = group.name;
      const back = document.createElement("button"); back.type = "button"; back.className = "tribe-back"; back.textContent = "← Back to Tribes"; back.addEventListener("click", showTribeDirectory);
      const hero = document.createElement("header"); hero.className = "tribe-hero";
      const cover = document.createElement("div"); cover.className = "tribe-hero-cover";
      if (group.coverUrl) { cover.style.backgroundImage = `linear-gradient(180deg,transparent 45%,rgba(8,12,20,.72)),url("${String(group.coverUrl).replace(/["\\]/g, "")}")`; cover.classList.add("has-photo"); }
      else { cover.textContent = groupIcon(group.category); cover.setAttribute("aria-hidden", "true"); }
      if ((group.isElder || group.isOwner) && group.custom) {
        const editCover = document.createElement("button"); editCover.type = "button"; editCover.className = "tribe-cover-edit"; editCover.textContent = group.coverUrl ? "Change cover" : "Add cover";
        const coverInput = document.createElement("input"); coverInput.type = "file"; coverInput.accept = "image/jpeg,image/png,image/webp,image/gif"; coverInput.hidden = true;
        editCover.addEventListener("click", () => coverInput.click());
        coverInput.addEventListener("change", async () => {
          const file = coverInput.files?.[0]; if (!file || !file.type.startsWith("image/")) return;
          editCover.disabled = true; editCover.textContent = "Uploading…"; let uploadedMediaKey = "";
          try {
            const ticketResponse = await postActionFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, purpose: "post" }) }, 15000);
            const ticket = await ticketResponse.json().catch(() => ({})); if (!ticketResponse.ok || !ticket.uploadUrl) throw new Error(ticket.error || "Cover upload could not start");
            const uploadOptions = { method: "PUT", headers: { "Content-Type": file.type }, body: file };
            const uploadResponse = typeof window.fetchWithDeadline === "function" ? await window.fetchWithDeadline(ticket.uploadUrl, uploadOptions, typeof window.mediaUploadDeadline === "function" ? window.mediaUploadDeadline(file) : 120000) : await fetch(ticket.uploadUrl, uploadOptions);
            if (!uploadResponse.ok) throw new Error("Cover upload failed");
            uploadedMediaKey = ticket.mediaKey;
            const saveResponse = await groupFetch("/groups/" + encodeURIComponent(group.id) + "/cover", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey: ticket.mediaKey }) });
            const savedCover = await saveResponse.json().catch(() => ({})); if (!saveResponse.ok || !savedCover.coverUrl) throw new Error(savedCover.error || "Cover could not be saved");
            uploadedMediaKey = ""; group.coverUrl = savedCover.coverUrl; openTribe(group);
          } catch (error) {
            if (uploadedMediaKey && typeof window.discardUploadedMedia === "function") await window.discardUploadedMedia(uploadedMediaKey).catch(() => {});
            alert(error.message); editCover.disabled = false; editCover.textContent = group.coverUrl ? "Change cover" : "Add cover";
          }
        });
        cover.append(editCover, coverInput);
      }
      const identity = document.createElement("div"); identity.className = "tribe-hero-identity";
      const title = document.createElement("h4"); title.textContent = group.name;
      const meta = document.createElement("p"); const count = Number(group.memberCount || 0); meta.textContent = `🔒 Tribe · ${count ? count + " in The Crew" : "The Crew"}`;
      const elder = document.createElement("span"); elder.className = "tribe-elder-badge"; elder.textContent = group.isElder || group.isOwner ? "Elder" : groupCategoryName(group.category);
      identity.append(title, meta, elder);
      const membership = document.createElement("button"); membership.type = "button"; membership.className = "primary tribe-membership";
      const paintMembership = () => { const joined = Boolean(saved.GroupsJoined?.[group.id]); membership.textContent = joined ? "✓ Joined" : "+ Join Tribe"; membership.classList.toggle("is-selected", joined); };
      paintMembership();
      membership.addEventListener("click", async () => { membership.disabled = true; try { await saveGroupMembership(group, !saved.GroupsJoined?.[group.id]); paintMembership(); openTribe(group); } catch (error) { alert(error.message); } finally { membership.disabled = false; } });
      hero.append(cover, identity, membership);
      const nav = document.createElement("div"); nav.className = "tribe-nav"; nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", group.name + " sections");
      const panels = document.createElement("div"); panels.className = "tribe-panels";
      const discussion = document.createElement("section"), about = document.createElement("section"), crew = document.createElement("section");
      discussion.className = "tribe-panel"; about.className = "tribe-panel"; crew.className = "tribe-panel"; about.hidden = crew.hidden = true;
      const switchPanel = value => {
        discussion.hidden = value !== "discussion"; about.hidden = value !== "about"; crew.hidden = value !== "crew";
        nav.querySelectorAll("button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.panel === value)));
        if (value === "crew" && !crew.dataset.loaded) { crew.dataset.loaded = "true"; renderCrew(group, crew); }
      };
      for (const [value, label] of [["discussion", "Discussion"], ["crew", "The Crew"], ["about", "About"]]) {
        const button = document.createElement("button"); button.type = "button"; button.dataset.panel = value; button.textContent = label; button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(value === "discussion")); button.addEventListener("click", () => switchPanel(value)); nav.appendChild(button);
      }
      if (saved.GroupsJoined?.[group.id]) {
        const composer = document.createElement("div"); composer.className = "tribe-composer";
        const input = document.createElement("textarea"); input.maxLength = 5000; input.placeholder = "Write something to " + group.name + "…"; input.setAttribute("aria-label", "Write a post to " + group.name);
        const mediaTools = document.createElement("div"); mediaTools.className = "tribe-composer-media-tools";
        const mediaPreview = document.createElement("div"); mediaPreview.className = "tribe-composer-media-preview"; mediaPreview.hidden = true;
        let selectedMedia = null;
        const clearSelectedMedia = () => {
          if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
          selectedMedia = null; mediaPreview.hidden = true; mediaPreview.replaceChildren();
          mediaTools.querySelectorAll('input[type="file"]').forEach(fileInput => { fileInput.value = ""; });
        };
        const addMediaPicker = (label, accept, kind) => {
          const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = label;
          const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = accept; fileInput.hidden = true;
          button.addEventListener("click", () => fileInput.click());
          fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0]; if (!file) return;
            if (!file.type.startsWith(kind + "/") || kind === "video" && file.size > 100 * 1024 * 1024) {
              fileInput.value = ""; alert(kind === "video" ? "Video must be MP4, WebM, or MOV and smaller than 100 MB." : "Choose a supported photo."); return;
            }
            clearSelectedMedia();
            selectedMedia = { file, kind, url: URL.createObjectURL(file) };
            const media = document.createElement(kind === "image" ? "img" : "video"); media.src = selectedMedia.url; media.className = "tribe-composer-preview-media";
            if (kind === "video") { media.controls = true; media.playsInline = true; }
            const remove = document.createElement("button"); remove.type = "button"; remove.className = "tribe-composer-remove-media"; remove.textContent = "Remove"; remove.addEventListener("click", clearSelectedMedia);
            mediaPreview.replaceChildren(media, remove); mediaPreview.hidden = false;
          });
          mediaTools.append(button, fileInput);
        };
        addMediaPicker("Photo", "image/jpeg,image/png,image/webp,image/gif", "image");
        addMediaPicker("Video", "video/mp4,video/webm,video/quicktime", "video");
        const certify = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; certify.append(checkbox, document.createTextNode(" This is my original content."));
        const publish = document.createElement("button"); publish.type = "button"; publish.className = "primary"; publish.textContent = "Post";
        const status = document.createElement("p"); status.className = "muted"; status.setAttribute("role", "status");
        publish.addEventListener("click", async () => {
          const content = input.value.trim(); if (!content && !selectedMedia) return input.focus(); if (!checkbox.checked) { status.textContent = "Confirm that this is your original content."; return checkbox.focus(); }
          publish.disabled = true; status.textContent = "Posting…";
          let uploadedMediaKey = "";
          try {
            let mediaKey = "", mediaType = "";
            if (selectedMedia) {
              const ticketResponse = await postActionFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: selectedMedia.file.type, purpose: "post" }) }, 15000);
              const ticket = await ticketResponse.json().catch(() => ({})); if (!ticketResponse.ok || !ticket.uploadUrl) throw new Error(ticket.error || "Media upload could not start");
              const uploadOptions = { method: "PUT", headers: { "Content-Type": selectedMedia.file.type }, body: selectedMedia.file };
              const uploadResponse = typeof window.fetchWithDeadline === "function"
                ? await window.fetchWithDeadline(ticket.uploadUrl, uploadOptions, typeof window.mediaUploadDeadline === "function" ? window.mediaUploadDeadline(selectedMedia.file) : 120000)
                : await fetch(ticket.uploadUrl, uploadOptions);
              if (!uploadResponse.ok) throw new Error("Media upload failed");
              mediaKey = ticket.mediaKey; mediaType = ticket.mediaType; uploadedMediaKey = mediaKey;
            }
            const response = await postActionFetch("/secure-posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: content || "Shared media", groupId: group.id, mediaKey, mediaType, originalContentCertified: true }) });
            const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "Post could not be shared with this Tribe");
            uploadedMediaKey = ""; input.value = ""; checkbox.checked = false; clearSelectedMedia(); status.textContent = "Posted to " + group.name + ".";
            if (typeof window.loadPosts === "function") await window.loadPosts(); renderTribePosts(group, feed);
          } catch (error) {
            if (uploadedMediaKey && typeof window.discardUploadedMedia === "function") await window.discardUploadedMedia(uploadedMediaKey).catch(() => {});
            status.textContent = error.message;
          } finally { publish.disabled = false; }
        });
        composer.append(input, mediaTools, mediaPreview, certify, publish, status); discussion.appendChild(composer);
      } else {
        const prompt = document.createElement("div"); prompt.className = "tribe-join-prompt"; prompt.textContent = "Join this Tribe to post, comment, and meet The Crew."; discussion.appendChild(prompt);
      }
      const feed = document.createElement("div"); feed.className = "tribe-feed"; discussion.appendChild(feed); renderTribePosts(group, feed);
      const aboutCard = document.createElement("div"); aboutCard.className = "tribe-about-card"; const aboutTitle = document.createElement("h5"); aboutTitle.textContent = "About this Tribe"; const description = document.createElement("p"); description.textContent = group.description; const standard = document.createElement("p"); standard.textContent = "Community standards: no hate speech, harassment, threats, or targeted abuse."; aboutCard.append(aboutTitle, description, standard); about.appendChild(aboutCard);
      panels.append(discussion, crew, about); detail.append(back, hero, nav, panels); detail.scrollIntoView({ block: "start" });
    }

    if (window.danzstakOpenTribeHandler) window.removeEventListener("danzstak:open-tribe", window.danzstakOpenTribeHandler);
    window.danzstakOpenTribeHandler = event => {
      const group = customGroups.find(item => item.id === event.detail?.groupId);
      if (group) { window.danzstakPendingTribeId = ""; openTribe(group); }
    };
    window.addEventListener("danzstak:open-tribe", window.danzstakOpenTribeHandler);

    function renderGroups() {
      grid.replaceChildren();
      const defaults = categories.map(category => ({ id: `default-${legacyCategoryOrder.indexOf(category)}`, name: groupCategoryName(category), category, description: `Connect in ${(groupCategoryName(category)).toLowerCase()}.`, custom: false }));
      const query = groupSearch.value.trim().toLowerCase();
      const groups = [...customGroups, ...defaults]
        .filter(group => groupView !== "joined" || Boolean(saved.GroupsJoined?.[group.id]))
        .filter(group => !categoryFilter.value || group.category === categoryFilter.value)
        .filter(group => !query || `${group.name} ${group.description || ""} ${groupCategoryName(group.category)}`.toLowerCase().includes(query))
        .sort((a, b) => Number(Boolean(saved.GroupsJoined?.[b.id])) - Number(Boolean(saved.GroupsJoined?.[a.id])) || Number(Boolean(b.custom)) - Number(Boolean(a.custom)) || String(a.name).localeCompare(String(b.name)));
      if (!groups.length) {
        const empty = document.createElement("div");
        empty.className = "groups-empty";
        const heading = document.createElement("strong");
        heading.textContent = groupView === "joined" ? "You have not joined a Tribe yet" : "No Tribes match that search";
        const copy = document.createElement("span");
        copy.textContent = groupView === "joined" ? "Choose Discover to find communities." : "Try another name or category.";
        empty.append(heading, copy);
        grid.appendChild(empty);
        return;
      }
      for (const group of groups) {
        const isSensitiveDiscussion = ["Politics", "Religion"].includes(group.category);
        const card = document.createElement("article");
        card.className = "group-card" + (isSensitiveDiscussion ? " group-card--moderated" : "");
        const cover = document.createElement("div");
        cover.className = "group-card-cover";
        cover.setAttribute("aria-hidden", "true");
        cover.textContent = groupIcon(group.category);
        const title = document.createElement("h4");
        const open = document.createElement("button"); open.type = "button"; open.className = "group-open"; open.textContent = group.name; open.addEventListener("click", () => openTribe(group)); title.appendChild(open);
        const category = document.createElement("span");
        category.className = "group-category";
        category.textContent = groupCategoryName(group.category);
        const description = document.createElement("p");
        description.textContent = group.description;
        const meta = document.createElement("div");
        meta.className = "group-meta";
        meta.textContent = `${Number(group.memberCount || 0) ? Number(group.memberCount) + " in The Crew · " : ""}${group.isElder || group.isOwner ? "Elder · " : ""}${groupCategoryName(group.category)}`;
        const join = document.createElement("button");
        join.type = "button";
        join.className = "primary";
        const joined = Boolean(saved.GroupsJoined?.[group.id]);
        const pendingSync = group.custom && !group.cloud;
        join.textContent = pendingSync ? "Waiting to sync" : joined ? "Joined" : "Join Tribe";
        join.disabled = pendingSync;
        if (pendingSync) join.title = "This tribe is saved on this device. Reopen Tribes when connected to retry syncing it.";
        join.classList.toggle("is-selected", joined);
        join.addEventListener("click", async () => {
          const nextJoined = !saved.GroupsJoined?.[group.id];
          join.disabled = true;
          try {
            await saveGroupMembership(group, nextJoined);
            join.textContent = nextJoined ? "Joined" : "Join Tribe";
            join.classList.toggle("is-selected", nextJoined);
            renderGroups();
          } catch (error) {
            alert(error.message);
          } finally {
            join.disabled = false;
          }
        });
        card.append(cover, category, title, meta, description);
        const moderation = document.createElement("div");
        moderation.className = "group-moderation-notice";
        const moderationTitle = document.createElement("strong");
        moderationTitle.textContent = isSensitiveDiscussion ? "Moderated discussion" : "Community standards";
        const moderationText = document.createElement("span");
        moderationText.textContent = isSensitiveDiscussion ? "Debate ideas, not people. No hate speech or harassment." : "Be respectful. No hate speech or harassment.";
        const report = document.createElement("button");
        report.type = "button";
        report.className = "group-report";
        report.textContent = "Report a problem";
        report.addEventListener("click", async () => {
          const details = await openTextActionDialog({ title: "Report this Tribe", description: "Tell DanzStak moderators what needs review. Do not include private information.", label: "What happened?", placeholder: "Describe the safety or community concern", submitLabel: "Submit report" });
          if (!details?.trim()) return;
          report.disabled = true;
          try {
            const response = await groupFetch("/reports", {
              method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetType: "group", groupId: group.id, reason: "other", details: details.trim() })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.report?.reportId) throw new Error(data.error || "Report could not be submitted. Please try again.");
            report.textContent = "Report submitted";
          } catch (error) { alert(error.message); report.disabled = false; }
        });
        moderation.append(moderationTitle, moderationText, report);
        card.appendChild(moderation);
        card.appendChild(join);
        if (group.custom && group.isOwner !== false) {
          if (group.cloud && group.isOwner === true) {
            const announce = document.createElement("button");
            announce.type = "button";
            announce.className = "group-everyone";
            announce.textContent = "Notify @everyone";
            announce.title = "Send an in-app announcement to current Tribe members";
            announce.addEventListener("click", async () => {
              const message = await openTextActionDialog({ title: "Notify everyone in " + group.name, description: "This sends one in-app announcement to every current Tribe member.", label: "Announcement", placeholder: "Share an update with the Tribe", submitLabel: "Send announcement" });
              if (!message?.trim()) return;
              announce.disabled = true;
              try {
                const response = await groupFetch("/groups/" + encodeURIComponent(group.id) + "/everyone", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim() }) });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || "Announcement could not be sent.");
                announce.textContent = `Notified ${result.notified || 0}`;
                setTimeout(() => { announce.textContent = "Notify @everyone"; }, 3000);
              } catch (error) { alert(error.message); }
              finally { announce.disabled = false; }
            });
            card.appendChild(announce);
          }
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "group-delete";
          remove.textContent = "Delete Tribe";
          remove.addEventListener("click", async () => {
            if (!confirm("Delete this group?")) return;
            remove.disabled = true;
            if (group.cloud) {
              const response = await groupFetch("/groups/" + encodeURIComponent(group.id), { method: "DELETE", credentials: "include" }).catch(() => null);
              if (!response?.ok) { remove.disabled = false; alert("Group could not be deleted."); return; }
            }
            customGroups = customGroups.filter(item => item.id !== group.id);
            saved.CustomGroups = customGroups.filter(item => !item.cloud);
            writeSections(saved);
            renderGroups();
          });
          card.appendChild(remove);
        }
        grid.appendChild(card);
      }
    }

    createButton.addEventListener("click", async () => {
      if (createButton.dataset.mode === "retry") { renderWorkspace("Groups"); return; }
      const value = groupName.input.value.trim();
      if (!value) return groupName.input.focus();
      if (!standardsCheckbox.checked) {
        standardsError.hidden = false;
        standardsCheckbox.focus();
        return;
      }
      createButton.disabled = true;
      try {
        const response = await groupFetch("/groups", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: value, category: categorySelect.value, description: "A new DanzStak community group.", communityStandards: true }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.group) throw new Error(result.error || "Group could not be created");
        customGroups.unshift({ ...result.group, custom: true, cloud: true });
        saved.GroupsJoined = saved.GroupsJoined || {};
        saved.GroupsJoined[result.group.id] = true;
        membershipChanges.set(result.group.id, true);
        saved.CustomGroups = customGroups.filter(item => !item.cloud);
        writeSections(saved);
      } catch (error) { alert(error.message); createButton.disabled = false; return; }
      groupName.input.value = "";
      standardsCheckbox.checked = false;
      renderGroups();
      createButton.disabled = false;
    });
    groupSearch.addEventListener("input", renderGroups);
    categoryFilter.addEventListener("change", renderGroups);
    workspace.append(toolbar, createBox, grid, detail);
    renderGroups();
    groupFetch("/groups", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(async data => {
        if (!Array.isArray(data?.groups)) {
          createButton.textContent = "Create Tribe (updating)";
          createButton.title = "Group creation will be available after the current backend update.";
          return;
        }
        createButton.textContent = "Create Tribe";
        createButton.title = "";
        delete createButton.dataset.mode;
        createButton.disabled = false;
        const cloud = data.groups.map(group => ({ ...group, custom: true, cloud: true }));
        const migration = await migrateLocalGroups(customGroups, cloud);
        const knownIds = new Set(migration.groups.map(group => group.id));
        const createdDuringMigration = customGroups.filter(group => group.cloud && !knownIds.has(group.id));
        customGroups = [...createdDuringMigration, ...migration.groups, ...migration.pending];
        saved.CustomGroups = migration.pending;
        saved.GroupsJoined = saved.GroupsJoined || {};
        migration.joinedIds.forEach(id => { saved.GroupsJoined[id] = true; membershipChanges.set(id, true); });
        writeSections(saved);
        renderGroups();
        if (window.danzstakPendingTribeId) {
          const pendingGroup = customGroups.find(group => group.id === window.danzstakPendingTribeId);
          if (pendingGroup) { window.danzstakPendingTribeId = ""; openTribe(pendingGroup); }
        }
      })
      .catch(() => { createButton.textContent = "Retry Group Service"; createButton.dataset.mode = "retry"; createButton.disabled = false; });
    groupFetch("/groups/membership", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "list" }) })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!Array.isArray(data?.groupIds)) return;
        saved.GroupsJoined = Object.fromEntries([...data.groupIds.map(groupId => [groupId, true]), ...membershipChanges]);
        writeSections(saved);
        renderGroups();
      })
      .catch(() => {});
    return;
  }

  if (name === "Notifications") {
    featureText.textContent = "Friend requests and account activity appear here.";
    const list = document.createElement("div");
    list.className = "notification-list";
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", "Notifications");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("aria-busy", "true");
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.setAttribute("role", "status");
    loading.textContent = "Loading notifications…";
    list.appendChild(loading);
    workspace.appendChild(list);
    async function loadNotificationSources() {
      let results = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const notificationController = new AbortController();
        const notificationTimeout = setTimeout(() => notificationController.abort(), 10000);
        try {
          results = await Promise.allSettled([
            fetch("https://api.danzstak.com/notifications", { credentials: "include", cache: "no-store", signal: notificationController.signal }),
            fetch("https://api.danzstak.com/calls/directory", { credentials: "include", cache: "no-store", signal: notificationController.signal }),
            fetch("https://api.danzstak.com/engagement-notifications", { credentials: "include", cache: "no-store", signal: notificationController.signal }),
            fetch("https://api.danzstak.com/friends", { credentials: "include", cache: "no-store", signal: notificationController.signal })
          ]);
        } finally { clearTimeout(notificationTimeout); }
        const socialReady = results[0]?.status === "fulfilled" && results[0].value.ok;
        const engagementReady = results[2]?.status === "fulfilled" && results[2].value.ok;
        if (socialReady || engagementReady) break;
      }
      return results;
    }
    loadNotificationSources().then(async results => {
        const response = results[0].status === "fulfilled" ? results[0].value : null;
        const directoryResponse = results[1].status === "fulfilled" ? results[1].value : null;
        const engagementResponse = results[2].status === "fulfilled" ? results[2].value : null;
        const friendsResponse = results[3].status === "fulfilled" ? results[3].value : null;
        if (!response?.ok && !engagementResponse?.ok) throw new Error("Notifications could not be loaded");
        const data = response?.ok ? await response.json() : { notifications: [] };
        const engagement = engagementResponse?.ok ? (await engagementResponse.json()).notifications || [] : [];
        notificationSourceCounts.social = response?.ok ? (data.notifications || []).length : notificationSourceCounts.social;
        notificationSourceCounts.engagement = engagementResponse?.ok ? engagement.filter(notice => notice.unread !== false).length : notificationSourceCounts.engagement;
        data.notifications = [...(data.notifications || []), ...engagement].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        const directory = directoryResponse?.ok ? (await directoryResponse.json()).users || [] : [];
        const friends = friendsResponse?.ok ? (await friendsResponse.json()).friends || [] : [];
        const people = new Map();
        for (const friend of friends) {
          const email = String(friend.email || "").toLowerCase();
          if (email) people.set(email, friend);
        }
        for (const person of directory) {
          const email = String(person.email || "").toLowerCase();
          if (!email) continue;
          const known = people.get(email) || {};
          people.set(email, { ...known, ...person, name: person.name || known.name, picture: person.picture || known.picture });
        }
        updateNotificationCount(Object.values(notificationSourceCounts).reduce((total, count) => total + (count || 0), 0));
        list.replaceChildren();
        list.setAttribute("aria-busy", "false");
        if (!(data.notifications || []).length) {
          const empty = document.createElement("p");
          empty.className = "muted";
          empty.textContent = "No new notifications.";
          list.appendChild(empty);
          return;
        }
        for (const notice of data.notifications) {
          const person = people.get(String(notice.email || "").toLowerCase());
          const displayName = person?.name || "DanzStak member";
          const row = document.createElement("article");
          row.className = "notification-row";
          row.classList.toggle("is-read", notice.unread === false);
          const memberId = String(person?.memberId || "").trim();
          const avatar = document.createElement(memberId ? "a" : "span");
          avatar.className = "notification-avatar";
          if (memberId) {
            avatar.href = `profile.html?member=${encodeURIComponent(memberId)}`;
            avatar.setAttribute("aria-label", "Open " + displayName + " profile");
          }
          if (person?.picture) {
            const picture = document.createElement("img");
            picture.src = person.picture;
            picture.alt = "";
            picture.referrerPolicy = "no-referrer";
            avatar.appendChild(picture);
          }
          else {
            avatar.textContent = displayName.charAt(0).toUpperCase();
            if (!memberId) avatar.setAttribute("aria-hidden", "true");
          }
          const message = document.createElement("p");
          message.textContent = notice.type === "message"
            ? `${displayName}: ${notice.preview || "New message"}`
            : notice.type === "group_everyone"
              ? `${displayName} notified @everyone in ${notice.groupName || "your Tribe"}: ${notice.preview || "New announcement"}`
            : notice.type === "reaction"
              ? formatReactionNotification(displayName, notice.preview)
              : notice.type === "tag"
                ? `${displayName} tagged you in a post.`
                : notice.type === "reply"
                  ? `${displayName} replied to you: ${notice.preview || "New reply"}`
                : notice.type === "comment"
                ? `${displayName} commented: ${notice.preview || "New comment"}`
                : `${displayName} sent you a friend request.`;
          const copy = document.createElement("div");
          copy.className = "notification-copy";
          copy.appendChild(message);
          const timestamp = formatNotificationTimestamp(notice.createdAt);
          if (timestamp) {
            const time = document.createElement("time");
            time.dateTime = notice.createdAt;
            time.textContent = timestamp;
            copy.appendChild(time);
          }
          const actions = document.createElement("div");
          actions.className = "notification-actions";
          if (notice.type === "group_everyone") {
            const open = document.createElement("a");
            open.className = "primary";
            open.textContent = "Open Tribe";
            open.href = "feed.html#groups";
            actions.appendChild(open);
          } else if (["reaction", "comment", "reply", "tag"].includes(notice.type)) {
            const open = document.createElement("a");
            open.className = "primary";
            open.textContent = "View post";
            open.setAttribute("aria-label", "View post from " + displayName);
            open.href = `feed.html#post-${encodeURIComponent(notice.postId)}`;
            actions.appendChild(open);
          } else if (notice.type === "message") {
            const open = document.createElement("button");
            open.type = "button";
            open.className = "primary";
            open.textContent = "Open chat";
            open.setAttribute("aria-label", "Open chat with " + displayName);
            open.addEventListener("click", () => {
              if (typeof window.openMessageDrawer === "function") window.openMessageDrawer(notice.email);
              setTimeout(() => {
                refreshNotificationCount();
                if ((featurePanel.dataset?.workspaceName || featureHeading.textContent) === "Notifications") renderWorkspace("Notifications");
              }, 1500);
            });
            actions.appendChild(open);
          } else for (const [label, accept] of [["Accept", true], ["Decline", false]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.setAttribute("aria-label", label + " friend request from " + displayName);
            button.className = accept ? "primary" : "secondary";
            button.addEventListener("click", async () => {
              await respondToNotificationRequest(row, notice.email, accept);
            });
            actions.appendChild(button);
          }
          row.append(avatar, copy, actions);
          list.appendChild(row);
        }
        if (engagement.length) {
          postActionFetch("/engagement-notifications/read", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then(marked => { if (marked.ok) { notificationSourceCounts.engagement = 0; updateNotificationCount((notificationSourceCounts.social || 0)); } })
            .catch(() => {});
        }
      })
      .catch(() => {
        list.setAttribute("aria-busy", "false");
        list.replaceChildren();
        const error = document.createElement("p");
        error.className = "muted";
        error.setAttribute("role", "alert");
        error.textContent = "Notifications could not be loaded.";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "secondary";
        retry.textContent = "Retry";
        retry.addEventListener("click", () => renderWorkspace("Notifications"));
        list.append(error, retry);
      });
    return;
  }

  if (name === "Friends") {
    featureText.textContent = "All accepted friends appear here, including friends who are offline.";
    workspace.appendChild(createFriendRequestForm());
    const list = document.createElement("div");
    list.className = "friends-workspace-list";
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", "Friends");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("aria-busy", "true");
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.setAttribute("role", "status");
    loading.textContent = "Loading friends…";
    list.appendChild(loading);
    workspace.appendChild(list);
    const friendsController = new AbortController();
    const friendsTimeout = setTimeout(() => friendsController.abort(), 10000);
    Promise.allSettled([
      fetch("https://api.danzstak.com/friends", { credentials: "include", cache: "no-store", signal: friendsController.signal }),
      fetch("https://api.danzstak.com/calls/directory", { credentials: "include", cache: "no-store", signal: friendsController.signal })
    ]).then(async ([friendsResult, directoryResult]) => {
      if (friendsResult.status === "rejected" && friendsResult.reason?.name === "AbortError") throw friendsResult.reason;
      const friendsResponse = friendsResult.status === "fulfilled" ? friendsResult.value : null;
      const directoryResponse = directoryResult.status === "fulfilled" ? directoryResult.value : null;
      if (!friendsResponse?.ok) throw new Error("Friends could not be loaded");
      const friends = (await friendsResponse.json()).friends || [];
      const presenceAvailable = directoryResponse?.ok === true;
      const directoryPeople = new Map(presenceAvailable
        ? ((await directoryResponse.json()).users || [])
          .filter(user => user.email)
          .map(user => [String(user.email).toLowerCase(), user])
        : []);
      list.replaceChildren();
      list.setAttribute("aria-busy", "false");
      if (!friends.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No accepted friends yet.";
        list.appendChild(empty);
      }
      for (const friend of friends) {
        const directoryFriend = directoryPeople.get(String(friend.email || "").toLowerCase()) || {};
        const person = {
          ...directoryFriend,
          ...friend,
          name: friend.name || directoryFriend.name,
          picture: friend.picture || directoryFriend.picture
        };
        const row = document.createElement("div");
        row.className = "friend-workspace-row";
        const friendMemberId = String(person.memberId || "");
        const hasProfileRoute = /^[a-f0-9-]{36}$/.test(friendMemberId);
        if (hasProfileRoute) row.setAttribute("data-member-id", friendMemberId);
        const link = document.createElement(hasProfileRoute ? "a" : "div");
        link.className = "friend-card friend-card-large";
        if (hasProfileRoute) {
          link.href = "profile.html?member=" + encodeURIComponent(friendMemberId);
          link.setAttribute("aria-label", "Open " + (person.name || "DanzStak member") + " profile");
        }
        const avatar = person.picture ? document.createElement("img") : document.createElement("span");
        avatar.className = "friend-avatar";
        if (person.picture) { avatar.src = person.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
        else { avatar.textContent = (person.name || "DanzStak member").charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
        const details = document.createElement("span");
        details.className = "friend-details";
        const displayName = document.createElement("strong");
        displayName.textContent = person.name || "DanzStak member";
        const status = document.createElement("small");
        const friendIsOnline = directoryFriend.online === true;
        status.textContent = friendIsOnline ? "Online" : presenceAvailable ? "Offline" : "Status unavailable";
        details.append(displayName, status);
        const presence = document.createElement("span");
        presence.className = friendIsOnline ? "friend-presence online" : "friend-presence";
        presence.setAttribute("aria-hidden", "true");
        presence.title = status.textContent;
        link.append(avatar, details, presence);
        const message = document.createElement("button");
        message.type = "button";
        message.className = "friend-message-action";
        message.textContent = "Message";
        message.setAttribute("aria-label", "Message " + displayName.textContent);
        message.addEventListener("click", () => openMessageDrawer(person.email));
        row.append(link, message);
        list.appendChild(row);
      }
    }).catch(error => {
      list.setAttribute("aria-busy", "false");
      list.replaceChildren();
      const failure = document.createElement("p");
      failure.className = "muted";
      failure.setAttribute("role", "alert");
      failure.textContent = error.name === "AbortError" ? "Friends took too long to load." : error.message;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "secondary";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => renderWorkspace("Friends"));
      list.append(failure, retry);
    }).finally(() => clearTimeout(friendsTimeout));
    return;
  }

  if (["Photos", "Videos"].includes(name)) {
    featureText.textContent = name === "Photos" ? "Photos shared in your DanzStak feed." : "Videos shared in your DanzStak feed.";
    const wantedTag = name === "Photos" ? "IMG" : "VIDEO";
    const media = [...document.querySelectorAll("#feed .post .post-media")].filter(item => item.tagName === wantedTag);
    if (!media.length) {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = `No ${name.toLowerCase()} are available in your feed yet.`;
      workspace.appendChild(message);
      return;
    }
    const gallery = document.createElement("div");
    gallery.className = "feed-media-gallery";
    for (const source of media) {
      const card = document.createElement("article");
      card.className = "feed-media-card";
      const copy = source.cloneNode();
      copy.removeAttribute("loading");
      if (copy.tagName === "VIDEO") { copy.controls = true; copy.autoplay = false; copy.muted = false; }
      const caption = document.createElement("p");
      caption.textContent = source.closest(".post")?.querySelector(".post-content")?.textContent || "Shared on DanzStak";
      card.append(copy, caption);
      gallery.appendChild(card);
    }
    workspace.appendChild(gallery);
    return;
  }

  if (name === "Messages") {
    document.getElementById("messagesNav")?.click();
    featureText.textContent = "Messages opened.";
    return;
  }

  if (name === "Events") {
    featureText.textContent = "Create event announcements and find events shared in your feed.";
    workspace.classList.add("events-workspace");
    const title = field("Event name", "text", "Show or performance");
    const date = field("Date", "date", "");
    const audience = document.createElement("select");
    audience.setAttribute("aria-label", "Event audience");
    for (const [value, label] of [["public", "Public"], ["friends", "Friends"], ["private", "Only me"]]) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; audience.appendChild(option);
    }
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.textContent = "Add Event";
    const eventCertification = document.createElement("label");
    eventCertification.className = "event-certification";
    const eventCertified = document.createElement("input");
    eventCertified.type = "checkbox";
    eventCertification.append(eventCertified, document.createTextNode("I created this event announcement and authorize sharing it through DanzStak."));
    const publishedHeading = document.createElement("h4");
    publishedHeading.textContent = "Published events";
    const publishedEvents = document.createElement("div");
    publishedEvents.className = "published-events";
    renderPublishedEvents(publishedEvents);
    button.addEventListener("click", async () => {
      if (!title.input.value.trim() || !date.input.value) return title.input.focus();
      if (!eventCertified.checked) {
        featureText.textContent = "Confirm that you created this event announcement before publishing.";
        eventCertified.focus();
        return;
      }
      const submittedTitle = title.input.value.trim();
      const submittedDate = date.input.value;
      button.disabled = true;
      featureText.textContent = "Publishing event…";
      try {
        const formattedDate = new Date(submittedDate + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        const response = await postActionFetch("/secure-posts", {
          method: "POST", credentials: "include", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `📅 Event: ${submittedTitle}\n${formattedDate}`, audience: audience.value, originalContentCertified: true })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Event could not be published");
        if (isCurrentWorkspace()) featureText.textContent = "Event published to DanzStak.";
        if (title.input.value.trim() === submittedTitle && date.input.value === submittedDate) {
          title.input.value = "";
          date.input.value = "";
        }
        eventCertified.checked = false;
        if (typeof window.loadPosts === "function") await window.loadPosts();
        if (isCurrentWorkspace()) renderPublishedEvents(publishedEvents);
      } catch (error) { if (isCurrentWorkspace()) featureText.textContent = error.message; }
      finally { button.disabled = false; }
    });
    workspace.append(title.wrap, date.wrap, audience, eventCertification, button, publishedHeading, publishedEvents);
    return;
  }

  if (name === "Settings") {
    featureText.textContent = "Manage account privacy, device preferences, and notifications.";
    workspace.classList.add("settings-workspace");
    async function settingsFetch(options = {}, retryColdStart = false) {
      const attempts = retryColdStart ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try { return await fetch("https://api.danzstak.com/settings/presence", { ...options, signal: controller.signal }); }
        catch (error) {
          if (error.name !== "AbortError") throw error;
          if (attempt + 1 >= attempts) throw new Error("Account settings took too long to respond.");
        } finally { clearTimeout(timeout); }
      }
      throw new Error("Account settings could not be loaded.");
    }
    const heading = document.createElement("h3");
    heading.className = "settings-heading";
    heading.textContent = "⚙ Settings and privacy";
    const settingRow = (icon, title, control) => {
      const row = document.createElement("div"); row.className = "settings-row";
      const symbol = document.createElement("span"); symbol.className = "settings-icon"; symbol.textContent = icon;
      const label = document.createElement("strong"); label.textContent = title;
      row.append(symbol, label, control); return row;
    };
    const notifications = document.createElement("label");
    notifications.style.display = "flex";
    notifications.style.gap = "10px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = saved.Settings?.notifications !== false;
    notifications.append(checkbox, document.createTextNode("Show activity notification badges on this device"));
    const presence = document.createElement("label");
    presence.style.display = "flex";
    presence.style.gap = "10px";
    presence.style.marginTop = "12px";
    const presenceCheckbox = document.createElement("input");
    presenceCheckbox.type = "checkbox";
    presenceCheckbox.checked = true;
    presence.append(presenceCheckbox, document.createTextNode("Show me online to other users"));
    const tagsCheckbox = document.createElement("input"); tagsCheckbox.type = "checkbox"; tagsCheckbox.checked = true; tagsCheckbox.id = "allowTags"; tagsCheckbox.setAttribute("aria-label", "Allow friends to tag me in photos and videos");
    const darkCheckbox = document.createElement("input");
    darkCheckbox.type = "checkbox";
    darkCheckbox.checked = document.documentElement.classList.contains("dark-mode");
    darkCheckbox.setAttribute("aria-label", "Use dark mode");
    darkCheckbox.addEventListener("change", () => {
      document.documentElement.classList.toggle("dark-mode", darkCheckbox.checked);
      cacheDevicePreference("danzstak_dark_mode", darkCheckbox.checked ? "1" : "0");
    });
    const motionCheckbox = document.createElement("input");
    motionCheckbox.type = "checkbox";
    motionCheckbox.checked = document.documentElement.classList.contains("reduce-motion");
    motionCheckbox.setAttribute("aria-label", "Reduce interface motion");
    motionCheckbox.addEventListener("change", () => {
      document.documentElement.classList.toggle("reduce-motion", motionCheckbox.checked);
      cacheDevicePreference("danzstak_reduce_motion", motionCheckbox.checked ? "1" : "0");
    });
    const dataSaverCheckbox = document.createElement("input");
    dataSaverCheckbox.type = "checkbox";
    dataSaverCheckbox.checked = readDevicePreference("danzstak_data_saver") === "1";
    dataSaverCheckbox.setAttribute("aria-label", "Use less mobile data");
    dataSaverCheckbox.addEventListener("change", () => applyDataSaver(dataSaverCheckbox.checked));
    const language = document.createElement("select");
    language.setAttribute("aria-label", "DanzStak language");
    for (const [value, label] of (window.danzstakLanguages || [["en", "English"]])) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; option.setAttribute("data-no-translate", ""); language.appendChild(option);
    }
    language.value = readDevicePreference("danzstak_language") || "en";
    language.addEventListener("change", () => { cacheDevicePreference("danzstak_language", language.value); if (window.danzstakSetLanguage) window.danzstakSetLanguage(language.value); else document.documentElement.lang = language.value; });
    const appSettings = document.createElement("button");
    appSettings.type = "button";
    appSettings.className = "secondary";
    appSettings.textContent = "Manage";
    appSettings.addEventListener("click", () => {
      window.danzstakOpenDeviceSettings(appSettings);
    });
    const activityButton = document.createElement("button");
    activityButton.type = "button";
    activityButton.className = "secondary";
    activityButton.textContent = "View";
    activityButton.addEventListener("click", () => openAccountActivity(activityButton));
    const profilePermissions = document.createElement("a");
    profilePermissions.className = "secondary";
    profilePermissions.href = "profile.html?edit=privacy";
    profilePermissions.textContent = "Manage";
    profilePermissions.setAttribute("aria-label", "Manage profile posting and tagging permissions");
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "secondary";
    exportButton.textContent = "Download";
    exportButton.addEventListener("click", async () => {
      exportButton.disabled = true;
      const original = exportButton.textContent;
      exportButton.textContent = "Preparing…";
      try {
        await window.danzstakDownloadAccountData(message => { if (isCurrentWorkspace()) featureText.textContent = message; });
      } catch { /* The exporter reports an actionable status message. */ }
      finally { exportButton.disabled = false; exportButton.textContent = original; }
    });
    const alertSettings = document.createElement("button");
    alertSettings.type = "button";
    alertSettings.className = "secondary";
    const updateAlertLabel = async () => {
      alertSettings.disabled = true;
      try {
        const state = await window.danzstakPushState?.();
        alertSettings.textContent = state === "enabled" ? "Enabled" : state === "blocked" ? "Blocked" : state === "unsupported" ? "Unavailable" : state === "incomplete" ? "Finish setup" : "Enable";
      } catch { alertSettings.textContent = "Try again"; }
      finally { alertSettings.disabled = alertSettings.textContent === "Enabled" || alertSettings.textContent === "Unavailable"; }
    };
    updateAlertLabel();
    alertSettings.addEventListener("click", async () => {
      alertSettings.disabled = true;
      alertSettings.textContent = "Enabling…";
      try {
        await window.danzstakEnablePush();
        if (isCurrentWorkspace()) featureText.textContent = "Background call alerts are enabled on this device, including while the installed app is closed.";
      } catch (error) {
        if (isCurrentWorkspace()) featureText.textContent = error.message;
      }
      await updateAlertLabel();
    });
    const legalLinks = document.createElement("span");
    legalLinks.className = "settings-links";
    const privacyLink = document.createElement("a"); privacyLink.href = "privacy.html"; privacyLink.textContent = "Privacy";
    const termsLink = document.createElement("a"); termsLink.href = "terms.html"; termsLink.textContent = "Terms";
    legalLinks.append(privacyLink, termsLink);
    const sessionInfo = document.createElement("span");
    sessionInfo.className = "settings-detail";
    sessionInfo.textContent = "Stay signed in until you sign out";
    const logout = document.createElement("button");
    logout.type = "button"; logout.className = "secondary"; logout.dataset.logout = ""; logout.textContent = "Logout";
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.disabled = true;
    button.textContent = "Loading Settings…";
    const preferenceControls = [presenceCheckbox, tagsCheckbox, darkCheckbox, motionCheckbox, dataSaverCheckbox, language];
    preferenceControls.forEach(control => { control.disabled = true; });
    settingsFetch({ credentials: "include", cache: "no-store" }, true)
      .then(response => {
        if (!response.ok) throw new Error("Account settings could not be loaded.");
        return response.json();
      })
      .then(data => {
        if (!isCurrentWorkspace()) return;
        preferenceControls.forEach(control => { control.disabled = false; });
        presenceCheckbox.checked = data.onlineVisible !== false;
        tagsCheckbox.checked = data.allowTags !== false;
        if (typeof data.darkMode === "boolean") {
          darkCheckbox.checked = data.darkMode;
          document.documentElement.classList.toggle("dark-mode", data.darkMode);
          cacheDevicePreference("danzstak_dark_mode", data.darkMode ? "1" : "0");
        }
        if (typeof data.reduceMotion === "boolean") {
          motionCheckbox.checked = data.reduceMotion;
          document.documentElement.classList.toggle("reduce-motion", data.reduceMotion);
          cacheDevicePreference("danzstak_reduce_motion", data.reduceMotion ? "1" : "0");
        }
        if (typeof data.dataSaver === "boolean") {
          dataSaverCheckbox.checked = data.dataSaver;
          applyDataSaver(data.dataSaver);
        }
        if ((window.danzstakLanguages || [["en", "English"]]).some(([code]) => code === data.language)) {
          language.value = data.language;
          document.documentElement.lang = data.language;
          cacheDevicePreference("danzstak_language", data.language);
        }
        button.disabled = false;
        button.textContent = "Save Settings";
      })
      .catch(error => {
        if (isCurrentWorkspace()) featureText.textContent = error.message + " Retry before changing privacy preferences.";
        button.disabled = false;
        button.dataset.mode = "retry";
        button.textContent = "Retry Settings";
      });
    button.addEventListener("click", async () => {
      if (button.dataset.mode === "retry") { renderWorkspace("Settings"); return; }
      button.disabled = true;
      saved.Settings = { ...(saved.Settings || {}), notifications: checkbox.checked, reduceMotion: motionCheckbox.checked, dataSaver: dataSaverCheckbox.checked };
      writeSections(saved);
      try {
        const response = await settingsFetch({
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ onlineVisible: presenceCheckbox.checked, allowTags: tagsCheckbox.checked, darkMode: darkCheckbox.checked, reduceMotion: motionCheckbox.checked, dataSaver: dataSaverCheckbox.checked, language: language.value })
        });
        if (!response.ok) throw new Error("Account settings could not be saved.");
        if (isCurrentWorkspace()) featureText.textContent = "Settings saved to your DanzStak account.";
        refreshNotificationCount();
        if (typeof loadOnlineUsers === "function") loadOnlineUsers();
      } catch (error) { if (isCurrentWorkspace()) featureText.textContent = error.message; }
      finally { button.disabled = false; }
    });
    workspace.append(
      heading,
      settingRow("👤", "Account settings", notifications),
      settingRow("🔒", "Privacy center", presence),
      settingRow("✎", "Profile posting and tagging", profilePermissions),
      settingRow("@", "Allow friends to tag me", tagsCheckbox),
      settingRow("🌙", "Dark mode", darkCheckbox),
      settingRow("✨", "Reduce motion", motionCheckbox),
      settingRow("📶", "Data saver", dataSaverCheckbox),
      settingRow("🌐", "Language", language),
      settingRow("🔔", "Call and message alerts", alertSettings),
      settingRow("📱", "App and device settings", appSettings),
      settingRow("🗂", "Your DanzStak activity", activityButton),
      settingRow("↓", "Download my data", exportButton),
      settingRow("🕒", "Session", sessionInfo),
      settingRow("📄", "Legal and privacy", legalLinks),
      settingRow("🚪", "Account", logout),
      button
    );
  }
}

const friendsLink = document.querySelector('.menu [data-feature="Friends"]');
if (friendsLink && !document.querySelector('[data-feature="Groups"]')) {
  const groupsLink = document.createElement("a");
  groupsLink.href = "#groups";
  groupsLink.dataset.feature = "Groups";
  groupsLink.textContent = "\uD83D\uDC65 Tribes";
  groupsLink.setAttribute("aria-label", "Tribes");
  friendsLink.insertAdjacentElement("afterend", groupsLink);
}

const workspaceRoutes = new Map(["Friends", "Groups", "Photos", "Videos", "Events", "Saved", "Settings", "Notifications"].map(name => [name.toLowerCase(), name]));
const mobileMenuControl = document.querySelector(".mobile-menu-control");
const mobileNavMenu = document.getElementById("mobileNavMenu");
function setMobileMenu(open) {
  const shouldOpen = Boolean(open && matchMedia("(max-width: 700px)").matches);
  const wasOpen = document.body.classList.contains("mobile-menu-open");
  document.body.classList.toggle("mobile-menu-open", shouldOpen);
  mobileMenuControl?.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) mobileNavMenu?.querySelector("a")?.focus({ preventScroll: true });
  else if (wasOpen) mobileMenuControl?.focus({ preventScroll: true });
}
mobileMenuControl?.addEventListener("click", () => setMobileMenu(!document.body.classList.contains("mobile-menu-open")));
mobileNavMenu?.addEventListener("click", event => {
  if (document.body.classList.contains("mobile-menu-open") && event.target.closest("a")) setMobileMenu(false);
});
document.addEventListener("click", event => {
  if (document.body.classList.contains("mobile-menu-open") && !mobileNavMenu?.contains(event.target) && !mobileMenuControl?.contains(event.target)) setMobileMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("mobile-menu-open")) setMobileMenu(false);
});
const desktopMenuQuery = matchMedia("(min-width: 701px)");
const closeMobileMenuOnDesktop = event => { if (event.matches) setMobileMenu(false); };
if (desktopMenuQuery.addEventListener) desktopMenuQuery.addEventListener("change", closeMobileMenuOnDesktop);
else desktopMenuQuery.addListener(closeMobileMenuOnDesktop);
let notificationDrawerPreviousFocus = null;
let notificationDrawer = null;
let notificationUnderlyingWorkspace = "";
let notificationWorkspacePlaceholder = null;
const notificationFeedView = document.getElementById("newsFeedView");

function closeNotificationDrawer(restoreFocus = true) {
  if (!notificationDrawer || notificationDrawer.hidden) return false;
  notificationDrawer.hidden = true;
  notificationFeedView.before(featurePanel);
  notificationWorkspacePlaceholder?.remove();
  notificationWorkspacePlaceholder = null;
  const workspaceToRestore = notificationUnderlyingWorkspace;
  notificationUnderlyingWorkspace = "";
  if (workspaceToRestore) openWorkspaceRoute(workspaceToRestore, false);
  else {
    featurePanel.hidden = true;
    notificationFeedView.hidden = false;
  }
  notificationControls.forEach(control => {
    control.setAttribute("aria-expanded", "false");
    control.setAttribute("aria-pressed", "false");
  });
  if (location.hash.toLowerCase() === "#notifications") history.replaceState(null, "", location.pathname + location.search);
  if (restoreFocus) (notificationDrawerPreviousFocus || notificationControls[0])?.focus({ preventScroll: true });
  notificationDrawerPreviousFocus = null;
  return true;
}

function openNotificationDrawer(opener) {
  document.getElementById("messageDrawer")?.querySelector(".message-drawer-close")?.click();
  setMobileMenu(false);
  document.body.classList.remove("content-only");
  notificationUnderlyingWorkspace = !featurePanel.hidden && featurePanel.dataset.workspaceName !== "Notifications"
    ? featurePanel.dataset.workspaceName || ""
    : "";
  if (notificationUnderlyingWorkspace) {
    notificationWorkspacePlaceholder = featurePanel.cloneNode(true);
    notificationWorkspacePlaceholder.id = "notificationWorkspacePlaceholder";
    notificationWorkspacePlaceholder.setAttribute("aria-hidden", "true");
    notificationWorkspacePlaceholder.setAttribute("inert", "");
    notificationWorkspacePlaceholder.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
    featurePanel.before(notificationWorkspacePlaceholder);
    notificationFeedView.hidden = true;
  } else notificationFeedView.hidden = false;
  if (!notificationDrawer) {
    notificationDrawer = document.createElement("section");
    notificationDrawer.id = "notificationDrawer";
    notificationDrawer.className = "notification-drawer";
    notificationDrawer.setAttribute("role", "dialog");
    notificationDrawer.setAttribute("aria-label", "Notifications");
    notificationDrawer.innerHTML = '<div class="notification-drawer-bar"><strong>Notifications</strong><button type="button" class="notification-drawer-close" aria-label="Close notifications">×</button></div><div class="notification-drawer-content"></div>';
    notificationDrawer.querySelector(".notification-drawer-close").addEventListener("click", () => closeNotificationDrawer());
    notificationDrawer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeNotificationDrawer(); }
    });
    document.body.appendChild(notificationDrawer);
  }
  notificationDrawerPreviousFocus = opener || document.activeElement;
  featureHeading.textContent = "Notifications";
  featurePanel.dataset.workspaceName = "Notifications";
  featurePanel.hidden = false;
  notificationDrawer.querySelector(".notification-drawer-content").appendChild(featurePanel);
  notificationDrawer.hidden = false;
  notificationControls.forEach(control => {
    control.setAttribute("aria-expanded", "true");
    control.setAttribute("aria-pressed", "true");
  });
  renderWorkspace("Notifications");
  requestAnimationFrame(() => notificationDrawer.querySelector(".notification-drawer-close")?.focus({ preventScroll: true }));
}

function openWorkspaceRoute(name, pushHistory = true) {
  if (!workspaceRoutes.has(String(name).toLowerCase())) return false;
  const canonicalName = workspaceRoutes.get(String(name).toLowerCase());
  if (canonicalName === "Notifications") {
    openNotificationDrawer(notificationControls[0]);
    return true;
  }
  if (typeof closeNotificationDrawer === "function") closeNotificationDrawer(false);
  document.body.classList.add("content-only");
  const homeControl = document.querySelector('[data-route="home"]');
  homeControl?.removeAttribute("aria-current");
  homeControl?.setAttribute("aria-pressed", "false");
  document.getElementById("newsFeedView").hidden = true;
  featurePanel.hidden = false;
  featureHeading.textContent = canonicalName === "Groups" ? "Tribes" : canonicalName;
  featurePanel.dataset.workspaceName = canonicalName;
  document.querySelectorAll(".menu a").forEach(link => link.classList.toggle("active", link.dataset.feature === canonicalName));
  document.querySelectorAll("[data-feature]").forEach(control => {
    const active = control.dataset.feature === canonicalName;
    if (control.matches("button")) control.setAttribute("aria-pressed", String(active));
    else if (active) control.setAttribute("aria-current", "page");
    else control.removeAttribute("aria-current");
  });
  renderWorkspace(canonicalName);
  const nextHash = "#" + canonicalName.toLowerCase();
  if (pushHistory && location.hash !== nextHash) history.pushState({ workspace: canonicalName }, "", nextHash);
  featurePanel.scrollIntoView({ behavior: pushHistory ? "smooth" : "auto", block: "start" });
  featureHeading.tabIndex = -1;
  requestAnimationFrame(() => featureHeading.focus({ preventScroll: true }));
  return true;
}

document.querySelectorAll("[data-feature]").forEach(control => {
  const name = control.dataset.feature;
  if (control.matches("a") && workspaceRoutes.has(name.toLowerCase())) control.href = "#" + name.toLowerCase();
  control.addEventListener("click", event => {
    if (!workspaceRoutes.has(name.toLowerCase())) return;
    event.preventDefault();
    if (name === "Notifications" && notificationDrawer && !notificationDrawer.hidden) {
      closeNotificationDrawer();
      return;
    }
    openWorkspaceRoute(name);
  });
});

document.querySelector('[data-route="home"]')?.addEventListener("click", () => closeNotificationDrawer(false), { capture: true });
document.getElementById("messagesNav")?.addEventListener("click", () => closeNotificationDrawer(false), { capture: true });

function restoreWorkspaceRoute() {
  const requestedView = new URLSearchParams(location.search).get("view")?.trim().toLowerCase() || "";
  const name = workspaceRoutes.get(location.hash.slice(1).toLowerCase()) || workspaceRoutes.get(requestedView);
  if (name) openWorkspaceRoute(name, false);
  else if (!location.hash || location.hash === "#feed" || location.hash.startsWith("#post-")) {
    document.body.classList.toggle("content-only", requestedView === "feed" || location.hash === "#feed" || location.hash.startsWith("#post-"));
    const home = document.querySelector('[data-route="home"]');
    home?.setAttribute("aria-pressed", "true");
    if (document.body.classList.contains("content-only")) home?.removeAttribute("aria-current");
    else home?.setAttribute("aria-current", "page");
    featurePanel.hidden = true;
    document.getElementById("newsFeedView").hidden = false;
    document.querySelectorAll(".menu a").forEach(link => link.classList.toggle("active", link.getAttribute("href") === "feed.html?view=feed"));
    document.querySelectorAll("[data-feature]").forEach(control => {
      control.removeAttribute("aria-current");
      if (control.matches("button")) control.setAttribute("aria-pressed", "false");
    });
  }
}
addEventListener("popstate", restoreWorkspaceRoute);
restoreWorkspaceRoute();

refreshNotificationCount();
setInterval(refreshNotificationCount, 30000);
window.addEventListener("focus", refreshNotificationCount);

const search = document.querySelector(".search");
search.setAttribute("aria-label", "Search posts and users");
search.placeholder = "Search posts and users";
search.setAttribute("aria-controls", "feed");
search.setAttribute("enterkeyhint", "search");
const searchFeedback = document.createElement("p");
searchFeedback.className = "muted feed-search-feedback";
searchFeedback.setAttribute("role", "status");
searchFeedback.hidden = true;
document.getElementById("feed").insertAdjacentElement("beforebegin", searchFeedback);
function filterFeedPosts() {
  const query = search.value.trim().toLowerCase();
  let matchingPosts = 0;
  document.querySelectorAll("#feed .post").forEach(post => {
    const content = post.querySelector(".post-content");
    const author = post.querySelector(".post-header");
    const searchable = content ? `${author?.textContent || ""} ${content.textContent} ${post.querySelector(".shared-post-card")?.textContent || ""}` : post.textContent;
    post.hidden = Boolean(query) && !searchable.toLowerCase().includes(query);
    if (!post.hidden) matchingPosts += 1;
  });
  searchFeedback.hidden = !query;
  searchFeedback.textContent = query
    ? matchingPosts ? `${matchingPosts} matching feed result${matchingPosts === 1 ? "" : "s"}.` : "No matching feed posts. Try another search or clear the search box."
    : "";
}
search.addEventListener("input", filterFeedPosts);
window.addEventListener("danzstak:show-search", () => {
  if (!search.value.trim()) return;
  const url = new URL(location.href); url.hash = ""; url.searchParams.set("view", "feed");
  history.replaceState({}, "", url.pathname + url.search); restoreWorkspaceRoute();
});
filterFeedPosts();

document.querySelector('[data-feature="Music"]')?.remove();
document.querySelectorAll(".story span").forEach(label => {
  if (label.textContent.trim() === "Music Spotlight") label.textContent = "Creator Spotlight";
});
const uploadNotice = document.querySelector(".composer-actions .muted");
if (uploadNotice) uploadNotice.textContent = "Original content only — videos may contain your original music; standalone audio uploads are blocked";

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
  certification.append(checkbox, document.createTextNode("I certify this is entirely my original content, including any music inside a video, and authorize sharing through DanzStak."));
  const certificationError = document.createElement("p");
  certificationError.className = "certification-error";
  certificationError.textContent = "Required: confirm that you own this content before posting.";
  certificationError.hidden = true;
  composerActions.parentElement.insertBefore(certification, composerActions);
  composerActions.parentElement.insertBefore(certificationError, composerActions);
  checkbox.addEventListener("change", () => {
    certificationError.hidden = checkbox.checked;
    certification.classList.toggle("certification-required", !checkbox.checked);
  });
  publishButton.addEventListener("click", event => {
    if (checkbox.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    certificationError.hidden = false;
    certification.classList.add("certification-required");
    certification.scrollIntoView({ behavior: "smooth", block: "center" });
    checkbox.focus();
  }, true);

  const mediaTools = document.createElement("div");
  mediaTools.style.display = "flex";
  mediaTools.style.gap = "10px";
  mediaTools.style.flexWrap = "wrap";
  mediaTools.style.marginTop = "12px";
  const preview = document.createElement("div");
  preview.style.marginTop = "12px";
  let selectedMedia = null;

  function mediaPicker(label, accept, kind, maxBytes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = label;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      if (!file.type.startsWith(kind + "/") || (maxBytes && file.size > maxBytes)) {
        input.value = "";
        alert(maxBytes
          ? `${label} must be a supported ${kind} file smaller than ${Math.round(maxBytes / 1048576)} MB.`
          : `${label} must be a supported ${kind} file.`);
        return;
      }
      if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
      selectedMedia = { file, kind, url: URL.createObjectURL(file) };
      window.danzstakSelectedMedia = selectedMedia;
      const storyToggle = document.getElementById("shareToStory");
      if (storyToggle) {
        storyToggle.disabled = false;
        storyToggle.checked = true;
        storyToggle.dataset.hasMedia = "true";
        storyToggle.closest("label")?.removeAttribute("title");
      }
      const reelsToggle = document.getElementById("shareToReels");
      if (reelsToggle) {
        reelsToggle.disabled = kind !== "video";
        reelsToggle.checked = kind === "video";
        if (kind === "video") reelsToggle.closest("label")?.removeAttribute("title");
      }
      const media = document.createElement(kind === "image" ? "img" : "video");
      media.src = selectedMedia.url;
      media.style.maxWidth = "100%";
      media.style.maxHeight = "420px";
      media.style.borderRadius = "10px";
      if (kind === "video") media.controls = true;
      preview.replaceChildren(media);
      if (kind === "video") {
        const scanStatus = document.createElement("p");
        scanStatus.className = "copyright-scan-status";
        scanStatus.textContent = isLocalHost() ? "Rights certification: local preview only" : "Rights certification required; automated content matching is not currently available.";
        preview.appendChild(scanStatus);
      }
    });
    mediaTools.append(button, input);
  }

  mediaPicker("Photo", "image/jpeg,image/png,image/webp,image/gif", "image", null);
  mediaPicker("Video", "video/mp4,video/webm,video/quicktime", "video", 100 * 1024 * 1024);
  composerActions.parentElement.insertBefore(mediaTools, certification);
  composerActions.parentElement.insertBefore(preview, certification);

  window.addEventListener("danzstak:post-published", event => {
    if (isLocalHost() || !selectedMedia || selectedMedia.url !== event.detail?.mediaUrl) return;
    preview.replaceChildren();
    selectedMedia = null;
    window.danzstakSelectedMedia = null;
    const storyToggle = document.getElementById("shareToStory");
    if (storyToggle) {
      storyToggle.checked = false;
      storyToggle.disabled = true;
      storyToggle.dataset.hasMedia = "false";
    }
    const reelsToggle = document.getElementById("shareToReels");
    if (reelsToggle) { reelsToggle.checked = false; reelsToggle.disabled = true; }
  });

  if (isLocalHost()) {
    publishButton.addEventListener("click", event => {
      if (!checkbox.checked) return;
      const composer = document.getElementById("postText");
      const text = composer.value.trim();
      if (!text && !selectedMedia) {
        event.preventDefault();
        event.stopImmediatePropagation();
        composer.focus();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const post = document.createElement("article");
      post.className = "post";
      post.dataset.audience = "public";
      post.dataset.postId = crypto.randomUUID();
      post.dataset.isOwner = "true";
      const header = document.createElement("div");
      header.className = "post-header";
      header.textContent = "You";
      const time = document.createElement("div");
      time.className = "post-time";
      time.textContent = "Just now";
      header.appendChild(time);
      const body = document.createElement("p");
      body.className = "post-content";
      body.textContent = text;
      const mediaForPost = selectedMedia;
      let mediaElement = null;
      let mediaBadge = null;
      if (mediaForPost) {
        mediaElement = document.createElement(mediaForPost.kind === "image" ? "img" : "video");
        mediaElement.src = mediaForPost.url;
        mediaElement.style.width = "100%";
        mediaElement.style.maxHeight = "560px";
        mediaElement.style.objectFit = "contain";
        mediaElement.style.borderRadius = "10px";
        if (mediaForPost.kind === "video") {
          mediaElement.controls = true;
          mediaBadge = document.createElement("p");
          mediaBadge.className = "copyright-scan-status";
          mediaBadge.textContent = "Rights certification: local preview only";
        }
      }
      const actions = document.createElement("div");
      actions.className = "post-actions";
      const like = document.createElement("button");
      like.type = "button";
      like.className = "likeBtn";
      like.textContent = "♡";
      like.setAttribute("aria-label", "Like post");
      like.setAttribute("aria-pressed", "false");
      like.title = "Like post";
      const comment = document.createElement("button");
      comment.type = "button";
      comment.className = "commentBtn";
      comment.textContent = "💬";
      comment.setAttribute("aria-label", "Comment on post");
      comment.title = "Comment on post";
      actions.append(like, comment);
      const comments = document.createElement("div");
      comments.className = "comments";
      comments.hidden = true;
      const commentInput = document.createElement("input");
      commentInput.setAttribute("aria-label", "Write a comment");
      commentInput.setAttribute("enterkeyhint", "send");
      commentInput.placeholder = "Write a comment and press Enter";
      const commentList = document.createElement("div");
      commentList.className = "commentList";
      comments.append(commentInput, commentList);
      post.append(header, body);
      if (mediaElement) post.appendChild(mediaElement);
      if (mediaBadge) post.appendChild(mediaBadge);
      post.append(actions, comments);
      document.getElementById("feed").prepend(post);
      preview.replaceChildren();
      selectedMedia = null;
      window.danzstakSelectedMedia = null;
      const storyToggle = document.getElementById("shareToStory");
      if (storyToggle) {
        storyToggle.checked = false;
        storyToggle.disabled = true;
        storyToggle.dataset.hasMedia = "false";
      }
      composer.value = "";
      checkbox.checked = false;
      document.getElementById("feedStatus").textContent = "Saved in local development mode.";
    }, true);
  }
}

function addShareButton(post) {
  const actions = post.querySelector(".post-actions");
  if (!actions || actions.querySelector(".shareBtn")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shareBtn";
  button.textContent = "➜";
  button.setAttribute("aria-label", "Share post");
  button.title = "Share post";
  button.addEventListener("click", async () => {
    if ((post.dataset.audience || "public") !== "public") {
      alert("Only Public posts can be shared outside DanzStak.");
      return;
    }
    if (window.danzstakSharePost) { window.danzstakSharePost(post); return; }
    const content = post.querySelector(".post-content")?.textContent.trim() || "DanzStak post";
    const shareUrl = postPermalink(post);
    const shareData = { title: "DanzStak", text: content.slice(0, 200), url: shareUrl };
    button.disabled = true;
    let status = post.querySelector(".post-share-status");
    if (!status) { status = document.createElement("p"); status.className = "post-share-status"; status.setAttribute("role", "status"); actions.after(status); }
    const showLink = () => {
      status.textContent = "Copy this link to share: ";
      const link = document.createElement("a"); link.href = shareUrl; link.textContent = shareUrl; status.appendChild(link);
    };
    showLink();
    try {
      if (navigator.share) {
        try { await navigator.share(shareData); return; }
        catch (error) { if (error.name === "AbortError") return; }
      }
      let copyTimer;
      try {
        await Promise.race([navigator.clipboard.writeText(shareUrl), new Promise((_, reject) => { copyTimer = setTimeout(() => reject(new Error("Clipboard timed out")), 3000); })]);
        status.textContent = "Link copied. Paste it wherever you want to share.";
      } catch { showLink(); }
      finally { clearTimeout(copyTimer); }
    } finally { button.disabled = false; }
  });
  actions.appendChild(button);
}

function paintPostSaveButton(post) {
  const button = post.querySelector(".saveBtn");
  if (!button) return;
  const saved = post.dataset.saved === "true";
  button.textContent = saved ? "✓ Saved" : "🔖 Save";
  button.setAttribute("aria-label", saved ? "Remove post from Saved" : "Save post");
  button.setAttribute("aria-pressed", String(saved));
  button.title = saved ? "Remove from Saved" : "Save post";
}

function addSaveButton(post) {
  const actions = post.querySelector(".post-actions");
  if (!actions || actions.querySelector(".saveBtn")) return;
  const preferences = readPostPreferences()[String(post.dataset.postId || "")] || {};
  post.dataset.saved = String(preferences.saved === true);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "saveBtn";
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const next = post.dataset.saved !== "true";
    button.disabled = true;
    try {
      await updatePostPreference(post, { saved: next });
      post.dataset.saved = String(next);
      paintPostSaveButton(post);
      const savedList = featurePanel.querySelector(".saved-posts");
      if (!featurePanel.hidden && savedList) renderSavedPosts(savedList);
      let status = post.querySelector(".post-save-status");
      if (!status) { status = document.createElement("p"); status.className = "post-save-status"; status.setAttribute("role", "status"); actions.after(status); }
      status.textContent = next ? "Post saved. Find it under Saved." : "Post removed from Saved.";
    } catch (error) {
      let status = post.querySelector(".post-save-status");
      if (!status) { status = document.createElement("p"); status.className = "post-save-status"; status.setAttribute("role", "status"); actions.after(status); }
      status.textContent = error.message || "This post could not be saved. Try again.";
    } finally { button.disabled = false; }
  });
  actions.appendChild(button);
  paintPostSaveButton(post);
}

function postPermalink(post) {
  const url = new URL("feed.html", location.href);
  url.search = "";
  url.hash = post.dataset.postId ? "post-" + post.dataset.postId : "";
  return url.href;
}

async function postActionFetch(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("DanzStak is taking too long to respond. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}

const changedPostPreferenceFields = new Map();
let volatilePostPreferences = {};

function mergeRemotePostPreferences(postId, current, remote) {
  const merged = { ...(current || {}) };
  const changed = changedPostPreferenceFields.get(postId);
  for (const [name, values] of Object.entries(remote)) {
    if (!changed?.has(name)) merged[name] = values.has(postId);
  }
  return merged;
}

function readPostPreferences() {
  try { return { ...JSON.parse(localStorage.getItem(postPreferencesKey) || "{}"), ...volatilePostPreferences }; }
  catch { return { ...volatilePostPreferences }; }
}

async function updatePostPreference(post, changes) {
  const postId = String(post.dataset.postId || "");
  if (!postId) return;
  if (!isLocalHost()) {
    const remoteNames = { pinned: "pinned", saved: "saved", notificationsOff: "muted" };
    for (const [name, enabled] of Object.entries(changes)) {
      if (!remoteNames[name] || typeof enabled !== "boolean") continue;
      const response = await postActionFetch("/settings/posts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, preference: remoteNames[name], enabled })
      });
      if (!response.ok) throw new Error("This post preference could not be saved. Please try again.");
    }
  }
  const preferences = readPostPreferences();
  const changed = changedPostPreferenceFields.get(postId) || new Set();
  Object.keys(changes).forEach(name => changed.add(name));
  changedPostPreferenceFields.set(postId, changed);
  preferences[postId] = { ...(preferences[postId] || {}), ...changes };
  try { localStorage.setItem(postPreferencesKey, JSON.stringify(preferences)); volatilePostPreferences = {}; }
  catch { volatilePostPreferences = preferences; }
}

const hiddenPostKey = "danzstak-hidden-posts";
const recentlyHiddenPostIds = new Set();
let hiddenPostIds;
try { hiddenPostIds = new Set(JSON.parse(localStorage.getItem(hiddenPostKey) || "[]").map(String)); }
catch { hiddenPostIds = new Set(); }

function applyHiddenPosts(root = document) {
  root.querySelectorAll?.(".post[data-post-id]").forEach(post => {
    if (hiddenPostIds.has(String(post.dataset.postId))) post.remove();
  });
}

async function hidePostForAccount(post) {
  const postId = String(post.dataset.postId || "");
  if (!postId) { post.remove(); return; }
  if (!isLocalHost()) {
    const response = await postActionFetch("/settings/posts", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, preference: "hidden", enabled: true })
    });
    if (!response.ok) throw new Error("This post could not be hidden from your account. Please try again.");
  }
  hiddenPostIds.add(postId);
  recentlyHiddenPostIds.add(postId);
  try { localStorage.setItem(hiddenPostKey, JSON.stringify([...hiddenPostIds])); } catch {}
  post.remove();
  window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: window.danzstakLoadedPosts || [] } }));
}

if (!isLocalHost()) postActionFetch("/settings/posts", { credentials: "include", cache: "no-store" })
  .then(response => response.ok ? response.json() : null)
  .then(data => {
    if (!data) return;
    hiddenPostIds = new Set([...(data.hidden || data.postIds || []).map(String), ...recentlyHiddenPostIds]);
    try { localStorage.setItem(hiddenPostKey, JSON.stringify([...hiddenPostIds])); } catch { /* Account settings still apply when browser storage is unavailable. */ }
    const preferences = readPostPreferences();
    const remote = { pinned: new Set((data.pinned || []).map(String)), saved: new Set((data.saved || []).map(String)), notificationsOff: new Set((data.muted || []).map(String)) };
    const preferenceIds = new Set([
      ...Object.keys(preferences),
      ...Object.values(remote).flatMap(ids => [...ids]),
      ...[...document.querySelectorAll(".post[data-post-id]")].map(post => String(post.dataset.postId))
    ]);
    for (const postId of preferenceIds) preferences[postId] = mergeRemotePostPreferences(postId, preferences[postId], remote);
    try { localStorage.setItem(postPreferencesKey, JSON.stringify(preferences)); volatilePostPreferences = {}; }
    catch { volatilePostPreferences = preferences; }
    applyHiddenPosts();
    window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: window.danzstakLoadedPosts || [] } }));
    document.querySelectorAll(".post[data-post-id]").forEach(post => {
      post.querySelector(".post-menu-toggle")?.remove();
      post.querySelector(".post-options-menu")?.remove();
      addPostDeleteButton(post);
    });
    const savedList = featurePanel.querySelector(".saved-posts");
    if (!featurePanel.hidden && savedList) renderSavedPosts(savedList);
  })
  .catch(() => {});

function openPostReportDialog(post) {
  document.querySelector(".post-report-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.className = "post-report-dialog";
  dialog.innerHTML = `
    <form method="dialog">
      <h2>Report post</h2>
      <p>Tell DanzStak about a copyright or safety concern. Reports are saved for moderation review.</p>
      <label>Reason
        <select name="reason" required>
          <option value="copyright">Copyright infringement</option>
          <option value="hate_speech">Hate speech</option>
          <option value="harassment">Harassment</option>
          <option value="violence">Violence or threats</option>
          <option value="spam">Spam or deception</option>
          <option value="other">Other concern</option>
        </select>
      </label>
      <label>Details <small>(optional)</small>
        <textarea name="details" maxlength="500" rows="4" placeholder="Describe the concern without including private information."></textarea>
      </label>
      <p class="post-report-status" role="status" aria-live="polite"></p>
      <div class="post-report-actions"><button value="cancel">Cancel</button><button type="button" class="primary post-report-submit">Submit report</button></div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.querySelector(".post-report-submit").addEventListener("click", async event => {
    const button = event.currentTarget, status = dialog.querySelector(".post-report-status");
    button.disabled = true;
    status.textContent = "Submitting report…";
    try {
      const response = await postActionFetch("/reports", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.dataset.postId, reason: dialog.querySelector('[name="reason"]').value, details: dialog.querySelector('[name="details"]').value.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The report could not be submitted.");
      dialog.querySelector("form").innerHTML = `<h2>Report submitted</h2><p>Thank you. DanzStak saved your report for moderation review.</p><div class="post-report-actions"><button value="done" class="primary">Done</button></div>`;
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
  dialog.showModal();
}

function updateLoadedPost(postId, changes) {
  if (!postId || !Array.isArray(window.danzstakLoadedPosts)) return;
  window.danzstakLoadedPosts = window.danzstakLoadedPosts.map(post => post.postId === postId ? { ...post, ...changes } : post);
  window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: window.danzstakLoadedPosts } }));
}

function addPostDeleteButton(post) {
  const actions = post.querySelector(".post-actions");
  if (!actions || post.querySelector(".post-menu-toggle")) return;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "post-menu-toggle";
  toggle.textContent = "•••";
  toggle.setAttribute("aria-label", "Post options");
  toggle.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "post-options-menu";
  menu.id = "post-options-" + (post.dataset.postId || crypto.randomUUID());
  menu.setAttribute("role", "menu");
  toggle.setAttribute("aria-controls", menu.id);
  toggle.setAttribute("aria-haspopup", "menu");
  menu.hidden = true;
  const handle = document.createElement("div");
  handle.className = "post-options-handle";
  handle.setAttribute("aria-hidden", "true");
  menu.appendChild(handle);
    let history = (() => { try { const value = JSON.parse(post.dataset.editHistory || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } })();
    const preferences = readPostPreferences()[String(post.dataset.postId || "")] || {};
    const owner = post.dataset.isOwner === "true";
    const audienceBadge = post.querySelector(".post-audience");
    const audienceText = audienceBadge?.textContent || "Public";
    post.dataset.privacySetting = String(/Friends/i.test(audienceText) ? 1 : /Only me/i.test(audienceText) ? 2 : 0);
  post.dataset.pinned = String(preferences.pinned === true);
  post.dataset.saved = String(preferences.saved === true);
  paintPostSaveButton(post);
  post.dataset.notificationsOff = String(preferences.notificationsOff === true);
  const serverCommentSetting = Number(post.dataset.commentSetting);
  post.dataset.commentSetting = String(Number.isInteger(serverCommentSetting) ? serverCommentSetting : Number(preferences.commentSetting) || 0);
  if (Number(post.dataset.commentSetting) === 2) post.querySelector(".commentBtn")?.setAttribute("disabled", "");
  if (preferences.pinned === true && post.parentElement) post.parentElement.prepend(post);

  function removePostFromThisFeed() {
    return hidePostForAccount(post);
  }

  const optionIcons = {
    "Pin post": "⌖", "Save post": "♡", "View edit history": "↶", "Edit post": "✎",
    "Who can comment?": "◯", "Edit privacy": "◉", "Move to archive": "▰",
    "Move to trash": "♜", "Turn off notifications": "♧", "Copy link": "⧉"
  };

  function option(title, description, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "post-option-row";
    button.setAttribute("role", "menuitem");
    if (title === "Delete post") button.classList.add("post-option-danger");
    const icon = document.createElement("span");
    icon.className = "post-option-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = optionIcons[title] || "•";
    const copy = document.createElement("span");
    copy.className = "post-option-copy";
    const strong = document.createElement("strong");
    strong.textContent = title;
    copy.appendChild(strong);
    if (description) {
      const small = document.createElement("small");
      small.textContent = description;
      copy.appendChild(small);
    }
    button.append(icon, copy);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await handler(button);
        menu.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
      } catch (error) { alert(error.message || "This action could not be saved. Please try again."); }
      finally { button.disabled = false; }
    });
    menu.appendChild(button);
    return button;
  }

  const pinOption = option("Pin post", "Keep this post at the top of your feed.", async button => {
    const pinned = post.dataset.pinned === "true";
    await updatePostPreference(post, { pinned: !pinned });
    post.dataset.pinned = String(!pinned);
    button.querySelector("strong").textContent = pinned ? "Pin post" : "Unpin post";
    if (!pinned) post.parentElement.prepend(post);
  });
  const saveOption = option("Save post", "Add this to your saved items.", async button => {
    const saved = post.dataset.saved === "true";
    await updatePostPreference(post, { saved: !saved });
    post.dataset.saved = String(!saved);
    button.querySelector("strong").textContent = saved ? "Save post" : "Unsave post";
    paintPostSaveButton(post);
  });
  if (preferences.pinned === true) pinOption.querySelector("strong").textContent = "Unpin post";
  if (preferences.saved === true) saveOption.querySelector("strong").textContent = "Unsave post";
  option("View edit history", "See changes made to this post.", () => {
    alert(history.length ? history.map((item, index) => `${index + 1}. ${new Date(item.editedAt).toLocaleString()}\n${item.content}`).join("\n\n") : "This post has not been edited.");
  });
  option("Edit post", "Change your post text.", () => {
    const body = post.querySelector(".post-content");
    if (!body) return;
    let editor = post.querySelector(".post-inline-editor");
    if (!editor) {
      editor = document.createElement("div");
      editor.className = "post-inline-editor";
      const textarea = document.createElement("textarea");
      textarea.setAttribute("aria-label", "Edit post text");
      const placeInput = document.createElement("input"); placeInput.type = "text"; placeInput.maxLength = 120; placeInput.className = "edit-post-location"; placeInput.setAttribute("aria-label", "Location (optional)"); placeInput.placeholder = "Location (optional)";
      const controls = document.createElement("div");
      controls.className = "post-inline-editor-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "primary";
      save.textContent = "Save changes";
      cancel.addEventListener("click", () => { editor.hidden = true; });
      save.addEventListener("click", async () => {
        const updated = textarea.value.trim();
        if (!updated) {
          textarea.setCustomValidity("Post text cannot be empty.");
          textarea.reportValidity();
          return;
        }
        textarea.setCustomValidity("");
        const updatedLocation = placeInput.value.trim();
        if (updated === body.textContent.trim() && updatedLocation === (post.dataset.location || "")) { editor.hidden = true; return; }
        save.disabled = true;
        const postId = post.dataset.postId;
        if (postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
          try {
            const response = await postActionFetch("/secure-posts/" + encodeURIComponent(postId), {
              method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: updated, location: updatedLocation })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error();
            history = Array.isArray(data.editHistory) ? data.editHistory : history;
            post.dataset.editHistory = JSON.stringify(history);
          } catch {
            alert("The edited post could not be saved. Please try again.");
            save.disabled = false;
            return;
          }
        }
        body.textContent = updated;
        updateLoadedPost(postId, { content: updated, location: updatedLocation, editHistory: history });
        post.dataset.location = updatedLocation;
        let place = post.querySelector(".post-location");
        if (updatedLocation) { if (!place) { place = document.createElement("span"); place.className = "post-location"; post.querySelector(".post-header")?.appendChild(place); } place.textContent = "Location: " + updatedLocation; }
        else place?.remove();
        post.dataset.edited = "true";
        editor.hidden = true;
        save.disabled = false;
      });
      controls.append(cancel, save);
      editor.append(textarea, placeInput, controls);
      body.insertAdjacentElement("afterend", editor);
    }
    const textarea = editor.querySelector("textarea");
    textarea.value = body.textContent.trim();
    editor.querySelector(".edit-post-location").value = post.dataset.location || "";
    editor.hidden = false;
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length); });
  });
  const commentOption = option("Who can comment?", "Everyone", async button => {
    const values = ["Everyone", "Friends", "Comments off"];
    const policies = ["everyone", "friends", "off"];
    const current = Number(post.dataset.commentSetting || 0);
    const next = (current + 1) % values.length;
    const postId = post.dataset.postId;
    button.disabled = true;
    if (postId && !isLocalHost()) {
      try {
        const response = await postActionFetch("/secure-posts/" + encodeURIComponent(postId), {
          method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentPolicy: policies[next] })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Comment setting could not be saved");
      } catch (error) { alert(error.message); button.disabled = false; return; }
    }
    post.dataset.commentSetting = String(next);
    await updatePostPreference(post, { commentSetting: next });
    button.querySelector("small").textContent = values[next];
    post.querySelector(".commentBtn").disabled = next === 2;
    button.disabled = false;
  });
  commentOption.querySelector("small").textContent = ["Everyone", "Friends", "Comments off"][Number(post.dataset.commentSetting) || 0];
    const privacyOption = option("Edit privacy", ["Public", "Friends", "Only me"][Number(post.dataset.privacySetting) || 0], async button => {
      const values = ["Public", "Friends", "Only me"];
      const audiences = ["public", "friends", "private"];
      const current = Number(post.dataset.privacySetting || 0);
      const next = (current + 1) % values.length;
      const postId = post.dataset.postId;
      button.disabled = true;
      if (postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
        try {
          const response = await postActionFetch("/secure-posts/" + encodeURIComponent(postId), {
            method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: post.querySelector(".post-content")?.textContent.trim() || "Shared media", audience: audiences[next] })
          });
          if (!response.ok) throw new Error("Privacy could not be saved");
        } catch (error) { alert(error.message); button.disabled = false; return; }
      }
      post.dataset.privacySetting = String(next);
      post.dataset.audience = audiences[next];
      updateLoadedPost(postId, { audience: audiences[next] });
      button.querySelector("small").textContent = values[next];
      if (audienceBadge) {
        audienceBadge.textContent = ["🌎 Public", "👥 Friends", "🔒 Only me"][next];
        audienceBadge.setAttribute("aria-label", "Post audience: " + values[next]);
      }
      button.disabled = false;
    });
    option("Move to archive", "Hide this post from your account.", () => hidePostForAccount(post));
  option("Delete post", "Delete your post or remove another user's post from your feed.", async () => {
    const postId = post.dataset.postId;
    if (post.dataset.isOwner !== "true") {
      if (confirm("You did not post this. Do you want to delete it from your feed?")) await removePostFromThisFeed();
      return;
    }
    if (!postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
      alert("This post is missing its server ID. Refresh the page and try again.");
      return;
    }
    if (post.dataset.isOwner === "true" && !confirm("Permanently delete this post and its uploaded media?")) return;
    if (postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
      try {
        const response = await postActionFetch("/secure-posts/" + encodeURIComponent(postId), { method: "DELETE", credentials: "include" });
        if (response.status === 403) {
          post.dataset.isOwner = "false";
          if (confirm("You did not post this. Do you want to delete it from your feed?")) await removePostFromThisFeed();
          return;
        }
        if (!response.ok) throw new Error();
      } catch { alert("The post could not be deleted from the server."); return; }
    }
    post.remove();
    if (postId && Array.isArray(window.danzstakLoadedPosts)) {
      window.danzstakLoadedPosts = window.danzstakLoadedPosts.filter(item => String(item.postId) !== String(postId));
      window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: window.danzstakLoadedPosts } }));
    }
  });
    const notificationsOption = option("Turn off notifications", "Stop updates for this post.", async button => {
    const off = post.dataset.notificationsOff === "true";
    await updatePostPreference(post, { notificationsOff: !off });
    post.dataset.notificationsOff = String(!off);
    button.querySelector("strong").textContent = off ? "Turn off notifications" : "Turn on notifications";
  });
  if (preferences.notificationsOff === true) notificationsOption.querySelector("strong").textContent = "Turn on notifications";
  if (owner && ["image","video"].includes(post.dataset.mediaType)) option("Tag people or location", "Tag accepted friends or add a place to this photo or video.", () => window.danzstakOpenMediaTags?.(post));
    option("Copy link", "Copy a shareable link to this post.", async () => {
    try { await navigator.clipboard.writeText(postPermalink(post)); }
    catch { alert("Copying is unavailable in this browser."); }
  });

  if (!owner) {
    for (const row of menu.querySelectorAll(".post-option-row")) {
      if (["Edit post", "Who can comment?", "Edit privacy"].includes(row.querySelector("strong")?.textContent || "")) row.remove();
    }
    option("Report post", "Tell DanzStak about copyright or safety concerns.", () => openPostReportDialog(post));
  }

  toggle.addEventListener("click", () => {
    document.querySelectorAll(".post-options-menu").forEach(other => {
      if (other !== menu) {
        other.hidden = true;
        other.closest(".post")?.querySelector(".post-menu-toggle")?.setAttribute("aria-expanded", "false");
      }
    });
    menu.hidden = !menu.hidden;
    toggle.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('[role="menuitem"]')?.focus();
  });
  menu.addEventListener("keydown", event => {
    const items = [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (event.key === "Escape") {
      event.preventDefault();
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });
  post.append(toggle, menu);
}

document.addEventListener("click", event => {
  if (event.target.closest(".post-menu-toggle, .post-options-menu")) return;
  document.querySelectorAll(".post-options-menu:not([hidden])").forEach(menu => {
    menu.hidden = true;
    menu.closest(".post")?.querySelector(".post-menu-toggle")?.setAttribute("aria-expanded", "false");
  });
});

const engagementApi = "https://api.danzstak.com";
const reactionEmoji = { Like:"\uD83D\uDC4D\uFE0E", Dislike:"\uD83D\uDC4E\uFE0E", Love:"\u2764\uFE0F", Laugh:"\uD83D\uDE02", Wow:"\uD83D\uDE2E", Sad:"\uD83D\uDE22", Fire:"\uD83D\uDD25" };

function engagementPostId(post) {
  const value = String(post?.dataset.postId || "");
  return /^[a-f0-9-]{36}$/.test(value) ? value : "";
}

function paintReactionControls(up, down, reaction, counts = {}, noun = "post") {
  const positive = Boolean(reaction) && reaction !== "Dislike";
  const total = Object.entries(counts).filter(([kind]) => kind !== "Dislike").reduce((sum, [, count]) => sum + Number(count || 0), 0);
  up.textContent = (positive ? reactionEmoji[reaction] : reactionEmoji.Like) + (total ? " · " + total : "");
  up.dataset.liked = String(positive); up.dataset.reaction = reaction || "";
  const upLabel = positive ? "Remove " + reaction.toLowerCase() + " reaction" : "Like " + noun;
  up.setAttribute("aria-label", upLabel); up.setAttribute("aria-pressed", String(positive)); up.title = upLabel;
  if (down) { down.textContent = reactionEmoji.Dislike + (counts.Dislike ? " · " + counts.Dislike : ""); down.setAttribute("aria-label", reaction === "Dislike" ? "Remove dislike reaction" : "Dislike " + noun); down.setAttribute("aria-pressed", String(reaction === "Dislike")); down.dataset.selected = String(reaction === "Dislike"); }
}
function setReactionAppearance(post, reaction, counts = {}) {
  const like = post.querySelector(".likeBtn"); if (!like) return;
  paintReactionControls(like, post.querySelector(".dislikeBtn"), reaction, counts);
}
function updateCommentPreview(post) {
  const list = post.querySelector(".commentList"); if (!list) return;
  const composer = post.querySelector(".comments"); if (composer && list.parentElement === composer) composer.before(list);
  const items = [...list.querySelectorAll(".comment")];
  const byId = new Map(items.map(item => [item.dataset.commentId || "",item])), children = new Map();
  for (const item of items) if (item.dataset.parentCommentId && byId.has(item.dataset.parentCommentId)) {
    const group = children.get(item.dataset.parentCommentId) || []; group.push(item); children.set(item.dataset.parentCommentId,group);
  }
  const roots = items.filter(item => !item.dataset.parentCommentId || !byId.has(item.dataset.parentCommentId));
  const sortMode = post.dataset.commentSort || "relevant";
  roots.sort(sortMode === "newest"
    ? (a,b) => String(b.dataset.createdAt || "").localeCompare(String(a.dataset.createdAt || ""))
    : (a,b) => Number(b.dataset.reactionTotal || 0) - Number(a.dataset.reactionTotal || 0) || String(b.dataset.createdAt || "").localeCompare(String(a.dataset.createdAt || "")));
  const ordered = [], rootIndex = new Map(), appendThread = (item,index) => { ordered.push(item); rootIndex.set(item,index); for (const reply of (children.get(item.dataset.commentId || "") || []).sort((a,b) => String(a.dataset.createdAt || "").localeCompare(String(b.dataset.createdAt || "")))) appendThread(reply,index); };
  roots.forEach((item,index) => appendThread(item,index));
  const expanded = post.dataset.commentsExpanded === "true";
  ordered.forEach(item => { list.appendChild(item); item.hidden = !expanded && (rootIndex.get(item) ?? 0) >= 2; });
  let more = post.querySelector(".comments-more");
  if (!more) { more = document.createElement("button"); more.type = "button"; more.className = "comments-more"; more.addEventListener("click", () => { post.dataset.commentsExpanded = String(post.dataset.commentsExpanded !== "true"); updateCommentPreview(post); }); list.after(more); }
  more.hidden = items.length <= 2; more.textContent = expanded ? "Show top 2 comments" : "View all " + items.length + " comments"; more.setAttribute("aria-expanded", String(expanded));
}
function attachReactionPicker(container, up, down, current, choose) {
  const palette = document.createElement("div"); palette.className = "reaction-palette"; palette.hidden = true; palette.setAttribute("role", "toolbar"); palette.setAttribute("aria-label", "Choose a reaction");
  let held = false, moved = false, timer, origin, opener = up;
  const hide = () => { palette.hidden = true; };
  const show = button => { opener = button; const rect = button.getBoundingClientRect(); const width = Math.min(320, document.documentElement.clientWidth - 24); palette.style.width = width + "px"; palette.style.left = Math.max(12,Math.min(rect.left,document.documentElement.clientWidth-width-12)) + "px"; palette.style.top = Math.max(12,rect.top-64) + "px"; palette.hidden = false; };
  for (const [label,emoji] of Object.entries(reactionEmoji)) { const choice = document.createElement("button"); choice.type = "button"; choice.textContent = emoji; choice.setAttribute("aria-label",label); choice.title = label; choice.addEventListener("click", event => { event.stopPropagation(); choose(current() === label ? "" : label); hide(); opener.focus(); }); palette.appendChild(choice); }
  container.appendChild(palette);
  for (const [button,label] of [[up,"Like"],[down,"Dislike"]]) {
    const cancel = () => { clearTimeout(timer); timer = null; };
    button.addEventListener("pointerdown", event => { cancel(); held = false; moved = false; origin = {x:event.clientX,y:event.clientY}; timer = setTimeout(() => { held = true; show(button); },500); });
    button.addEventListener("pointermove", event => { if (origin && Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>10) { cancel(); moved = true; hide(); } });
    for (const name of ["pointerup","pointerleave","pointercancel"]) button.addEventListener(name,cancel);
    button.addEventListener("contextmenu", event => { event.preventDefault(); cancel(); held = true; show(button); });
    button.addEventListener("keydown", event => { if (event.shiftKey && event.key === "F10") { event.preventDefault(); show(button); palette.querySelector("button")?.focus(); } });
    button.addEventListener("click", event => { event.preventDefault(); event.stopImmediatePropagation(); if (held || moved) { held = false; moved = false; return; } const value = current(); choose(label === "Like" && value && value !== "Dislike" ? "" : value === label ? "" : label); },true);
  }
  palette.addEventListener("keydown",event => { if (event.key === "Escape") { event.preventDefault(); hide(); opener.focus(); } });
}
function createCommentReactions(post, item, comment) {
  const controls = document.createElement("div"); controls.className = "comment-reactions";
  const up = document.createElement("button"), down = document.createElement("button"); up.type = down.type = "button"; up.className = "comment-like"; down.className = "comment-dislike"; controls.append(up,down);
  let current = comment.myReaction || ""; paintReactionControls(up,down,current,comment.reactionCounts || {},"comment");
  attachReactionPicker(item,up,down,() => current,value => { current = value; paintReactionControls(up,down,current,comment.reactionCounts || {},"comment"); saveReaction(post,value,comment.commentId).catch(() => { post.dataset.engagementLoaded = ""; loadEngagement(post); }); });
  const reactors = [...(comment.reactors || [])].sort((a,b) => Number(b.isFriend)-Number(a.isFriend));
  if (reactors.length) {
    const names = document.createElement("details"); names.className = "comment-reactors";
    const summary = document.createElement("summary"), onlyLikes = reactors.every(person => person.reaction === "Like");
    const prefix = onlyLikes ? "Liked by " : reactors.length === 1 ? "Reaction from " : "Reactions from ";
    summary.textContent = prefix + reactors.slice(0,2).map(person => person.name + (person.isFriend ? " (Friend)" : "")).join(", ") + (reactors.length > 2 ? " and " + (reactors.length-2) + " others" : "");
    names.appendChild(summary);
    for (const person of reactors) { const memberId = String(person.memberId || ""), linked = /^[a-f0-9-]{36}$/.test(memberId), name = document.createElement(linked ? "a" : "div"); if (linked) name.href = `profile.html?member=${encodeURIComponent(memberId)}`; name.textContent = (reactionEmoji[person.reaction] || "") + " " + person.name + (person.isFriend ? " (Friend)" : ""); name.setAttribute("data-no-translate", ""); names.appendChild(name); }
    controls.appendChild(names);
  }
  item.appendChild(controls);
}

function clearCommentReply(input) {
  if (!input) return;
  delete input.dataset.replyToCommentId;
  delete input.dataset.replyToName;
  input.placeholder = "Write a comment…";
  const composer = input.closest(".comment-composer");
  composer?.querySelector(".comment-replying")?.remove();
}

function beginCommentReply(post, comment, item) {
  const input = post.querySelector(".comments input");
  if (!input) return;
  const name = comment.authorName || "DanzStak member";
  input.dataset.replyToCommentId = comment.commentId;
  input.dataset.replyToName = name;
  input.placeholder = "Reply to " + name + "…";
  const composer = input.closest(".comment-composer");
  composer?.querySelector(".comment-replying")?.remove();
  if (composer) {
    const replying = document.createElement("div");
    replying.className = "comment-replying";
    const targetAvatar = item?.querySelector(".comment-avatar")?.cloneNode(true);
    if (targetAvatar) {
      targetAvatar.classList.add("comment-replying-avatar");
      replying.appendChild(targetAvatar);
    }
    const label = document.createElement("span");
    label.textContent = "Replying to " + name;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.setAttribute("aria-label", "Cancel reply to " + name);
    cancel.addEventListener("click", () => { clearCommentReply(input); input.focus(); });
    replying.append(label, cancel);
    composer.prepend(replying);
  }
  post.querySelector(".comments").hidden = false;
  item?.scrollIntoView?.({ block: "nearest" });
  input.focus();
}

let commentViewerProfilePromise = null;
function loadCommentViewerProfile() {
  if (!commentViewerProfilePromise) commentViewerProfilePromise = engagementFetch("/profiles", { credentials: "include", cache: "no-store" })
    .then(async response => response.ok ? (await response.json()).profile || {} : {})
    .catch(() => ({}));
  return commentViewerProfilePromise;
}

function hydratePostComposerAvatar() {
  if (typeof document.querySelector !== "function") return;
  const avatar = document.querySelector(".composer-avatar");
  if (!avatar) return;
  loadCommentViewerProfile().then(profile => {
    if (!avatar.isConnected) return;
    avatar.textContent = String(profile.name || "D").trim().charAt(0).toUpperCase() || "D";
    avatar.style.backgroundImage = "";
    if (!profile.picture) return;
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      if (!avatar.isConnected) return;
      avatar.style.backgroundImage = `url("${profile.picture}")`;
      avatar.textContent = "";
    };
    image.src = profile.picture;
  });
}

hydratePostComposerAvatar();

function ensureCommentComposer(post) {
  const comments = post.querySelector(".comments"), input = comments?.querySelector(":scope > input, .comment-composer input");
  if (!comments || !input || input.closest(".comment-composer")) return;
  input.placeholder = "Write a comment…";
  const composer = document.createElement("div");
  composer.className = "comment-composer";
  const avatar = document.createElement("span");
  avatar.className = "comment-composer-avatar";
  avatar.textContent = "D";
  avatar.setAttribute("aria-hidden", "true");
  loadCommentViewerProfile().then(profile => {
    if (!avatar.isConnected) return;
    if (profile.picture) {
      const image = document.createElement("img"); image.className = "comment-composer-avatar"; image.src = profile.picture; image.alt = ""; image.referrerPolicy = "no-referrer"; avatar.replaceWith(image);
    } else avatar.textContent = String(profile.name || "D").charAt(0).toUpperCase();
  });
  const field = document.createElement("div");
  field.className = "comment-composer-field";
  const tools = document.createElement("div");
  tools.className = "comment-composer-tools";
  const emoji = document.createElement("button");
  emoji.type = "button";
  emoji.className = "comment-emoji-toggle";
  emoji.textContent = "☺";
  emoji.setAttribute("aria-label", "Add emoji to comment");
  emoji.setAttribute("aria-expanded", "false");
  const emojiMenu = document.createElement("div");
  emojiMenu.className = "comment-emoji-menu";
  emojiMenu.hidden = true;
  for (const symbol of ["👍", "❤️", "😂", "😮", "😢", "🔥"]) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.textContent = symbol;
    choice.setAttribute("aria-label", "Add " + symbol);
    choice.addEventListener("click", () => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.value = input.value.slice(0, start) + symbol + input.value.slice(end);
      input.setSelectionRange(start + symbol.length, start + symbol.length);
      emojiMenu.hidden = true;
      emoji.setAttribute("aria-expanded", "false");
      input.focus();
    });
    emojiMenu.appendChild(choice);
  }
  emoji.addEventListener("click", () => {
    emojiMenu.hidden = !emojiMenu.hidden;
    emoji.setAttribute("aria-expanded", String(!emojiMenu.hidden));
  });
  tools.append(emoji, emojiMenu);
  const send = document.createElement("button");
  send.type = "button";
  send.className = "comment-send";
  send.textContent = "➤";
  send.setAttribute("aria-label", "Post comment");
  send.addEventListener("click", () => saveComment(post, input));
  input.replaceWith(composer);
  field.append(input, tools, send);
  composer.append(avatar, field);

  if (!post.querySelector(".comment-sort")) {
    const sort = document.createElement("button");
    sort.type = "button";
    sort.className = "comment-sort";
    sort.textContent = "Most relevant ▾";
    sort.setAttribute("aria-label", "Comment order: most relevant. Activate for newest first.");
    sort.addEventListener("click", () => {
      const newest = post.dataset.commentSort !== "newest";
      post.dataset.commentSort = newest ? "newest" : "relevant";
      sort.textContent = newest ? "Newest ▾" : "Most relevant ▾";
      sort.setAttribute("aria-label", newest ? "Comment order: newest first. Activate for most relevant." : "Comment order: most relevant. Activate for newest first.");
      updateCommentPreview(post);
    });
    post.querySelector(".commentList")?.before(sort);
  }
}

function renderPersistentComment(post, comment) {
  const list = post.querySelector(".commentList");
  if (!list || list.querySelector(`[data-comment-id="${CSS.escape(comment.commentId)}"]`)) return;
  const item = document.createElement("div");
  item.className = "comment";
  item.dataset.commentId = comment.commentId;
  item.dataset.canDelete = String(comment.canDelete === true);
  if (comment.parentCommentId) { item.dataset.parentCommentId = comment.parentCommentId; item.classList.add("comment-reply"); }
  const memberId = String(comment.authorMemberId || "").trim();
  const profileUrl = memberId ? `profile.html?member=${encodeURIComponent(memberId)}` : "";
  const avatar = document.createElement(memberId ? "a" : "span");
  avatar.className = "comment-avatar";
  if (memberId) { avatar.href = profileUrl; avatar.setAttribute("aria-label", "Open " + (comment.authorName || "member") + " profile"); }
  if (comment.authorPicture) { const image = document.createElement("img"); image.src = comment.authorPicture; image.alt = ""; image.referrerPolicy = "no-referrer"; avatar.appendChild(image); }
  else { avatar.textContent = String(comment.authorName || "D").charAt(0).toUpperCase(); if (!memberId) avatar.setAttribute("aria-hidden", "true"); }
  const bubble = document.createElement("div"); bubble.className = "comment-bubble";
  const author = document.createElement(memberId ? "a" : "strong");
  author.className = "comment-author";
  if (memberId) author.href = profileUrl;
  author.textContent = comment.authorName || "DanzStak member";
  const time = document.createElement("time"); time.className = "comment-time"; time.dateTime = comment.createdAt || "";
  const parsed = comment.createdAt ? new Date(comment.createdAt) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
    time.textContent = minutes < 1 ? "now" : minutes < 60 ? minutes + "m" : minutes < 1440 ? Math.floor(minutes / 60) + "h" : minutes < 10080 ? Math.floor(minutes / 1440) + "d" : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
  } else time.textContent = "now";
  const body = document.createElement("div"); body.className = "comment-content"; body.textContent = comment.content;
  item.dataset.reactionTotal = String(comment.reactionTotal || 0); item.dataset.createdAt = comment.createdAt || "";
  if (comment.replyToName) { const context = document.createElement("span"); context.className = "comment-reply-context"; context.textContent = "Replying to " + comment.replyToName; bubble.appendChild(context); }
  bubble.append(author, time, body);
  item.append(avatar, bubble);
  createCommentReactions(post,item,comment);
  const reply = document.createElement("button");
  reply.type = "button";
  reply.className = "comment-reply-button";
  reply.textContent = "Reply";
  reply.setAttribute("aria-label", "Reply to " + (comment.authorName || "this comment"));
  reply.addEventListener("click", () => beginCommentReply(post, comment, item));
  item.querySelector(".comment-reactions")?.appendChild(reply);
  list.appendChild(item);
  addCommentDelete(item);
  updateCommentPreview(post);
}

async function engagementFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${engagementApi}${path}`, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("DanzStak is taking too long to update this post. Try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadEngagement(post) {
  const postId = engagementPostId(post);
  if (!postId || post.dataset.engagementLoaded === "true") return;
  const version = post.dataset.engagementVersion || "0";
  post.dataset.engagementLoaded = "true";
  try {
    const response = await engagementFetch(`/engagement?postId=${encodeURIComponent(postId)}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { if (version === (post.dataset.engagementVersion || "0")) post.dataset.engagementLoaded = ""; return; }
    const data = await response.json();
    if (version !== (post.dataset.engagementVersion || "0")) return;
    post.dataset.reactionCounts = JSON.stringify(data.reactionCounts || {});
    setReactionAppearance(post, data.myReaction || "", data.reactionCounts || {});
    const list = post.querySelector(".commentList");
    if (list) list.replaceChildren();
    for (const comment of data.comments || []) renderPersistentComment(post, comment);
    updateCommentPreview(post);
  } catch { if (version === (post.dataset.engagementVersion || "0")) post.dataset.engagementLoaded = ""; }
}

const pendingReactionSaves = new WeakMap();
async function saveReaction(post, reaction, commentId = "") {
  const postId = engagementPostId(post);
  if (!postId) return;
  const previous = pendingReactionSaves.get(post) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const response = await engagementFetch("/reactions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, reaction, ...(commentId ? {commentId} : {}) }) });
    if (!response.ok) throw new Error("Reaction could not be saved");
    post.dataset.engagementVersion = String(Number(post.dataset.engagementVersion || 0) + 1);
    post.dataset.engagementLoaded = "";
    await loadEngagement(post);
  });
  pendingReactionSaves.set(post, pending);
  try { await pending; }
  finally { if (pendingReactionSaves.get(post) === pending) pendingReactionSaves.delete(post); }
}

async function saveComment(post, input) {
  const postId = engagementPostId(post), content = input.value.trim();
  if (!postId || !content) return;
  input.disabled = true;
  const submit = input.closest?.(".comment-composer")?.querySelector(".comment-send");
  if (submit) submit.disabled = true;
  try {
    const parentCommentId = String(input.dataset?.replyToCommentId || "");
    const response = await engagementFetch("/comments", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, content, ...(parentCommentId ? { parentCommentId } : {}) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Comment could not be saved");
    if (parentCommentId && data.comment?.parentCommentId !== parentCommentId) throw new Error("The reply service needs the latest server update. Your reply is still here—please try again after deployment.");
    post.dataset.engagementVersion = String(Number(post.dataset.engagementVersion || 0) + 1);
    input.value = "";
    if (typeof clearCommentReply === "function") clearCommentReply(input);
    renderPersistentComment(post, data.comment);
    post.dataset.engagementLoaded = "";
    await loadEngagement(post);
  } catch (error) { alert(error.message); }
  finally { input.disabled = false; if (submit) submit.disabled = false; input.focus(); }
}

function addCommentDelete(comment) {
  if (comment.querySelector(".deleteCommentBtn")) return;
  if (comment.dataset.canDelete === "false") return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "deleteCommentBtn";
  button.textContent = "Delete";
  button.style.marginLeft = "10px";
  button.addEventListener("click", async () => {
    if (!confirm("Delete this comment?")) return;
    const post = comment.closest(".post"), postId = engagementPostId(post), commentId = comment.dataset.commentId;
    if (postId && commentId) {
      button.disabled = true;
      const response = await engagementFetch(`/comments/${encodeURIComponent(commentId)}?postId=${encodeURIComponent(postId)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
      if (!response?.ok) { button.disabled = false; alert("Comment could not be deleted."); return; }
      post.dataset.engagementVersion = String(Number(post.dataset.engagementVersion || 0) + 1);
      post.dataset.engagementLoaded = "";
    }
    comment.remove();
    if (post) updateCommentPreview(post);
  });
  comment.appendChild(button);
}

function addReactionButton(post) {
  const like = post.querySelector(".likeBtn"); if (!like || like.dataset.reactionsReady === "true") return;
  like.dataset.reactionsReady = "true";
  const down = document.createElement("button"); down.type = "button"; down.className = "dislikeBtn"; like.after(down);
  setReactionAppearance(post, "");
  ensureCommentComposer(post);
  attachReactionPicker(post,like,down,() => like.dataset.reaction || "",reaction => { setReactionAppearance(post,reaction); saveReaction(post,reaction).catch(() => { post.dataset.engagementLoaded = ""; loadEngagement(post); }); });
  updateCommentPreview(post); loadEngagement(post);
}
document.addEventListener("pointerdown", event => { if (!event.target.closest(".reaction-palette,.likeBtn,.dislikeBtn,.comment-like,.comment-dislike")) document.querySelectorAll(".reaction-palette").forEach(palette => { palette.hidden = true; }); });

const reelsStorageKey = "danzstak_external_reels";
let cloudReels = null;
let internalReels = [];
const reelsRail = document.createElement("section");
reelsRail.className = "reels-rail post";
reelsRail.setAttribute("aria-label", "External video reels");
const reelsHeading = document.createElement("div");
reelsHeading.className = "reels-heading";
const reelsTitle = document.createElement("h3");
reelsTitle.textContent = "The Roll";
const reelsSourceNote = document.createElement("span");
reelsSourceNote.textContent = "Externally hosted videos";
const rollOpen = document.createElement("button");
rollOpen.type = "button";
rollOpen.className = "roll-open";
rollOpen.textContent = "Open fullscreen";
rollOpen.setAttribute("aria-label", "Open The Roll fullscreen");
const rollClose = document.createElement("button");
rollClose.type = "button";
rollClose.className = "roll-close";
rollClose.textContent = "Close";
rollClose.setAttribute("aria-label", "Close The Roll fullscreen");
function setRollFullscreen(open) {
  reelsRail.classList.toggle("roll-fullscreen", open);
  document.body.classList.toggle("roll-view-open", open);
  rollOpen.setAttribute("aria-expanded", String(open));
  if (open) {
    reelsList.scrollTop = 0;
    rollClose.focus({ preventScroll: true });
    const first = reelsList.querySelector("video.reel-player");
    if (first && !dataSaverEnabled()) first.play().catch(() => {});
  } else rollOpen.focus({ preventScroll: true });
}
rollOpen.addEventListener("click", () => setRollFullscreen(true));
rollClose.addEventListener("click", () => setRollFullscreen(false));
document.addEventListener("keydown", event => { if (event.key === "Escape" && reelsRail.classList.contains("roll-fullscreen")) { event.preventDefault(); setRollFullscreen(false); } });
reelsHeading.append(reelsTitle, reelsSourceNote, rollOpen, rollClose);
const reelsList = document.createElement("div");
reelsList.className = "reels-list";
const reelPlaybackObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const video = entry.target;
    video.dataset.inView = String(entry.isIntersecting && entry.intersectionRatio >= 0.6);
    if (video.dataset.inView === "true" && !document.hidden && !dataSaverEnabled()) video.play().catch(() => {});
    else video.pause();
  }
}, { threshold: [0, 0.6, 1] });
const reelForm = document.createElement("div");
reelForm.className = "reel-import-form";
const reelUrl = document.createElement("input");
reelUrl.type = "url";
reelUrl.placeholder = "Paste a supported autoplay video link";
reelUrl.setAttribute("aria-label", "External video URL");
const reelPermission = document.createElement("label");
const reelPermissionCheck = document.createElement("input");
reelPermissionCheck.type = "checkbox";
reelPermission.append(reelPermissionCheck, document.createTextNode("I own this video or have permission to share its external link."));
const addReel = document.createElement("button");
addReel.type = "button";
addReel.className = "primary";
addReel.textContent = "Add to The Roll";
const reelStatus = document.createElement("p");
reelStatus.className = "muted reel-status";
reelForm.append(reelUrl, reelPermission, addReel, reelStatus);
reelsRail.append(reelsHeading, reelsList, reelForm);

function getLocalReels() {
  try { return JSON.parse(localStorage.getItem(reelsStorageKey) || "[]"); }
  catch { return []; }
}

function getReels() {
  const external = Array.isArray(cloudReels) ? cloudReels : getLocalReels();
  return [...internalReels, ...external];
}

async function reelFetch(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch("https://api.danzstak.com" + path, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("DanzStak is taking too long to respond. Try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}

let internalReelsVersion = 0;
async function loadInternalReels(posts = []) {
  const version = ++internalReelsVersion;
  const videos = posts.filter(post => !hiddenPostIds.has(String(post.postId)) && post.reel === true && post.mediaType === "video" && post.mediaKey);
  const resolved = await Promise.all(videos.map(async post => {
    let mediaUrl = post.mediaUrl || "";
    if (!mediaUrl) {
      const response = await reelFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", mediaKey: post.mediaKey, mediaType: "video" }) }).catch(() => null);
      if (response?.ok) mediaUrl = (await response.json().catch(() => ({}))).mediaUrl || "";
    }
    return mediaUrl ? { id: post.postId, postId: post.postId, mediaUrl, platform: "DanzStak", memberId: post.userId || "", authorName: post.authorName || "DanzStak member", content: post.content || "Shared video", internal: true, isOwner: post.isOwner === true } : null;
  }));
  if (version !== internalReelsVersion) return;
  internalReels = resolved.filter(Boolean);
  renderPlayableReels();
  placeReelsRail();
}

function reelPlatform(hostname) {
  const host = hostname.replace(/^www\./, "");
  if (host.includes("tiktok.com")) return "TikTok";
  if (host.includes("facebook.com") || host === "fb.watch") return "Facebook";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
  if (host.includes("vimeo.com")) return "Vimeo";
  return "External Video";
}

function isApprovedVideoUrl(url) {
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const videoHosts = ["tiktok.com", "facebook.com", "fb.watch", "instagram.com", "youtube.com", "youtu.be", "vimeo.com", "twitch.tv", "dailymotion.com", "dai.ly", "rumble.com", "streamable.com", "kick.com", "snapchat.com", "x.com", "twitter.com"];
  const trustedHost = videoHosts.some(allowed => host === allowed || host.endsWith("." + allowed));
  const directVideo = /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(url.pathname + url.search + url.hash);
  return trustedHost || directVideo;
}

function reelPlayer(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;
  if (/\.(?:mp4|webm|mov|m4v)$/i.test(path)) return { kind: "video", src: url.href };
  let match;
  if (host === "youtu.be") match = path.match(/^\/([^/?#]+)/);
  else if (host.endsWith("youtube.com")) match = [null, url.searchParams.get("v") || path.match(/^\/(?:shorts|embed)\/([^/?#]+)/)?.[1]];
  if (match?.[1]) return { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(match[1]) + "?autoplay=1&mute=1&playsinline=1" };
  if (host.endsWith("vimeo.com") && (match = path.match(/\/(\d+)/))) return { kind: "iframe", src: "https://player.vimeo.com/video/" + match[1] + "?autoplay=1&muted=1&playsinline=1" };
  if (host.endsWith("tiktok.com") && (match = path.match(/\/video\/(\d+)/))) return { kind: "iframe", src: "https://www.tiktok.com/player/v1/" + match[1] + "?autoplay=1&loop=1&muted=1" };
  if (host.endsWith("facebook.com") || host === "fb.watch") return { kind: "iframe", src: "https://www.facebook.com/plugins/video.php?show_text=false&autoplay=true&href=" + encodeURIComponent(url.href) };
  if ((host.endsWith("dailymotion.com") && (match = path.match(/\/video\/([^/?#]+)/))) || (host === "dai.ly" && (match = path.match(/^\/([^/?#]+)/)))) return { kind: "iframe", src: "https://www.dailymotion.com/embed/video/" + encodeURIComponent(match[1]) + "?autoplay=1&mute=1" };
  if (host.endsWith("streamable.com") && (match = path.match(/^\/([^/?#]+)/))) return { kind: "iframe", src: "https://streamable.com/e/" + encodeURIComponent(match[1]) + "?autoplay=1" };
  if (host === "clips.twitch.tv" && (match = path.match(/^\/([^/?#]+)/))) return { kind: "iframe", src: "https://clips.twitch.tv/embed?autoplay=true&muted=true&clip=" + encodeURIComponent(match[1]) + "&parent=" + encodeURIComponent(location.hostname) };
  if (host.endsWith("twitch.tv") && (match = path.match(/^\/videos\/(\d+)/))) return { kind: "iframe", src: "https://player.twitch.tv/?autoplay=true&muted=true&video=" + match[1] + "&parent=" + encodeURIComponent(location.hostname) };
  return null;
}

function renderPlayableReels() {
  reelPlaybackObserver.disconnect();
  reelsList.replaceChildren();
  const reels = getReels();
  if (!reels.length) {
    const empty = document.createElement("p");
    empty.className = "muted reels-empty";
    empty.textContent = "Videos shared to The Roll will appear here.";
    reelsList.appendChild(empty);
    return;
  }
  for (const reel of reels) {
    const reelUrlValue = reel.url ? new URL(reel.url) : null;
    const card = document.createElement("article");
    card.className = "reel-card";
    const playerInfo = reel.internal ? { kind: "video", src: reel.mediaUrl } : reelPlayer(reelUrlValue);
    if (playerInfo?.kind === "video") {
      const video = document.createElement("video");
      video.className = "reel-player";
      video.src = playerInfo.src;
      video.controls = true;
      video.playsInline = true;
      video.autoplay = !dataSaverEnabled();
      video.muted = true;
      video.loop = true;
      video.preload = "none";
      reelPlaybackObserver.observe(video);
      card.appendChild(video);
    } else if (playerInfo?.kind === "iframe") {
      const createFrame = () => {
        const frame = document.createElement("iframe");
        frame.className = "reel-player";
        frame.src = playerInfo.src;
        frame.title = reel.platform + " reel player";
        frame.loading = "lazy";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
        frame.setAttribute("allowfullscreen", "");
        return frame;
      };
      if (dataSaverEnabled()) {
        const load = document.createElement("button");
        load.type = "button";
        load.className = "reel-player reel-load-button";
        load.textContent = "Load " + reel.platform + " video";
        load.addEventListener("click", () => load.replaceWith(createFrame()));
        card.appendChild(load);
      } else card.appendChild(createFrame());
    } else {
      const unavailable = document.createElement("div");
      unavailable.className = "reel-player-fallback";
      unavailable.textContent = "This source does not provide an embeddable player.";
      card.appendChild(unavailable);
    }
    const details = document.createElement("div");
    details.className = "reel-details";
    const platform = document.createElement("strong");
    platform.textContent = reel.internal ? reel.authorName : reel.platform;
    const source = document.createElement("small");
    source.textContent = reel.internal ? reel.content : reelUrlValue.hostname;
    details.append(platform, source);
    const reelMemberId = String(reel.memberId || "");
    const reelAuthorName = String(reel.authorName || reel.displayName || "").trim();
    if (reelAuthorName && (reel.isOwner === true || /^[a-f0-9-]{36}$/.test(reelMemberId))) {
      const author = document.createElement("a");
      author.className = "reel-author-link";
      author.href = reel.isOwner === true ? "profile.html" : "profile.html?member=" + encodeURIComponent(reelMemberId);
      author.textContent = reel.internal ? "Open " + reelAuthorName + " profile" : "Shared by " + reelAuthorName;
      author.setAttribute("aria-label", "Open " + reelAuthorName + " profile");
      details.insertBefore(author, source);
      if (reel.internal) platform.hidden = true;
    }
    if (reel.internal) {
      const open = document.createElement("a"); open.href = "#post-" + encodeURIComponent(reel.postId); open.textContent = "View post";
      open.addEventListener("click", event => {
        const post = document.getElementById("post-" + reel.postId);
        if (!post) return;
        event.preventDefault();
        openPostInFeed(post);
      });
      details.appendChild(open);
    } else {
      const open = document.createElement("a"); open.href = reel.url; open.target = "_blank"; open.rel = "noopener noreferrer nofollow"; open.textContent = playerInfo ? "Open on source" : "Play on source"; details.appendChild(open);
    }
    if (!reel.internal && (!Array.isArray(cloudReels) || reel.isOwner === true)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "reel-delete";
      remove.textContent = "Delete from The Roll";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        if (Array.isArray(cloudReels)) {
          const response = await reelFetch("/stories/" + encodeURIComponent(reel.id), { method: "DELETE", credentials: "include" }).catch(() => null);
          if (!response?.ok) { remove.disabled = false; reelStatus.textContent = "Video could not be removed from The Roll."; return; }
          cloudReels = cloudReels.filter(item => item.id !== reel.id);
        } else localStorage.setItem(reelsStorageKey, JSON.stringify(getLocalReels().filter(item => item.id !== reel.id)));
        renderPlayableReels();
      });
      details.appendChild(remove);
    }
    card.appendChild(details);
    reelsList.appendChild(card);
  }
}

window.addEventListener("danzstak:posts-loaded", event => loadInternalReels(event.detail?.posts || []));
if (Array.isArray(window.danzstakLoadedPosts)) loadInternalReels(window.danzstakLoadedPosts);

function placeReelsRail() {
  const feedElement = document.getElementById("feed");
  const posts = [...feedElement.children].filter(child => child.classList.contains("post") && child !== reelsRail);
  if (posts.length >= 4) posts[3].insertAdjacentElement("afterend", reelsRail);
  else feedElement.appendChild(reelsRail);
}

addReel.addEventListener("click", async () => {
  let parsed;
  try { parsed = new URL(reelUrl.value.trim()); }
  catch { reelStatus.textContent = "Enter a valid video link."; reelUrl.focus(); return; }
  if (!isApprovedVideoUrl(parsed)) { reelStatus.textContent = "Use a recognized video platform or a direct HTTPS video-file link."; reelUrl.focus(); return; }
  if (!reelPlayer(parsed)) { reelStatus.textContent = "This link cannot autoplay inside DanzStak. Use a supported public video or direct HTTPS video-file link."; reelUrl.focus(); return; }
  if (!reelPermissionCheck.checked) { reelStatus.textContent = "Confirm ownership or permission before sharing."; reelPermissionCheck.focus(); return; }
  addReel.disabled = true;
  try {
    const response = await reelFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reel", url: parsed.href, rightsCertified: true }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.reel) throw new Error(result.error || "Video could not be saved to The Roll.");
    const reel = result.reel;
    cloudReels = Array.isArray(cloudReels) ? cloudReels : [];
    cloudReels.unshift({ ...reel, platform: reelPlatform(new URL(reel.url).hostname) });
    reelUrl.value = "";
    reelPermissionCheck.checked = false;
    reelStatus.textContent = "Video saved to The Roll.";
    renderPlayableReels();
  } catch (error) {
    reelStatus.textContent = error.message || "Video could not be saved to The Roll.";
  } finally {
    addReel.disabled = false;
  }
});

async function loadCloudReels() {
  try {
    const response = await reelFetch("/stories", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.reels)) return;
    cloudReels = data.reels.map(reel => ({ ...reel, platform: reelPlatform(new URL(reel.url).hostname) }));
    const pending = getLocalReels();
    const remaining = [];
    const existingUrls = new Set(cloudReels.map(reel => reel.url));
    for (const local of pending) {
      if (existingUrls.has(local.url)) continue;
      const saved = await reelFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reel", url: local.url, rightsCertified: true }) }).catch(() => null);
      if (!saved?.ok) { remaining.push(local); continue; }
      const result = await saved.json();
      if (result.reel) { cloudReels.push({ ...result.reel, platform: reelPlatform(new URL(result.reel.url).hostname) }); existingUrls.add(result.reel.url); }
    }
    localStorage.setItem(reelsStorageKey, JSON.stringify(remaining));
    cloudReels.sort((a, b) => String(b.sharedAt).localeCompare(String(a.sharedAt)));
    renderPlayableReels();
  } catch { /* Local reels remain available while cloud sync retries next load. */ }
}

renderPlayableReels();
loadCloudReels();
placeReelsRail();
document.addEventListener("visibilitychange", () => {
  reelsList.querySelectorAll("video.reel-player").forEach(video => {
    if (document.hidden || video.dataset.inView !== "true") video.pause();
    else if (!dataSaverEnabled()) video.play().catch(() => {});
  });
});
document.getElementById("feed").addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || !event.target.matches(".comments input")) return;
  const post = event.target.closest(".post");
  if (!engagementPostId(post)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  saveComment(post, event.target);
}, true);
document.querySelectorAll("#feed .post").forEach(post => { if (post !== reelsRail && !hiddenPostIds.has(String(post.dataset.postId || ""))) { addReactionButton(post); addShareButton(post); addSaveButton(post); addPostDeleteButton(post); } else if (post !== reelsRail) post.remove(); });

window.addEventListener("message", event => {
  if (event.origin !== location.origin || event.source === window || event.data?.type !== "danzstak-presence-update" || !Array.isArray(event.data.users)) return;
  const states = new Map(event.data.users
    .filter(member => /^[a-f0-9-]{36}$/.test(String(member?.memberId || "")))
    .map(member => [String(member.memberId), member.online === true]));
  document.querySelectorAll(".friend-workspace-row[data-member-id]").forEach(row => {
    if (!states.has(row.dataset.memberId)) return;
    const online = states.get(row.dataset.memberId);
    const status = row.querySelector(".friend-details small");
    const dot = row.querySelector(".friend-presence");
    if (status) status.textContent = online ? "Online" : "Offline";
    if (dot) {
      dot.classList.toggle("online", online);
      dot.title = online ? "Online" : "Offline";
    }
  });
});
function linkifyUserText(element) {
  if (element?.nodeType !== 1) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue?.match(/(?:https?:\/\/|www\.)/i)) continue;
    if (node.parentElement?.closest("a, button, input, textarea, script, style")) continue;
    textNodes.push(node);
  }
  for (const node of textNodes) {
    const text = node.nodeValue;
    const pattern = /(?:https?:\/\/|www\.)[^\s<>]+/gi;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      let visible = match[0];
      let trailing = "";
      while (/[),.!?;:]$/.test(visible)) {
        trailing = visible.slice(-1) + trailing;
        visible = visible.slice(0, -1);
      }
      try {
        const href = new URL(visible.startsWith("www.") ? "https://" + visible : visible);
        if (href.protocol !== "https:" && href.protocol !== "http:") throw new Error("Unsupported link");
        const link = document.createElement("a");
        link.className = "user-content-link";
        link.href = href.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer nofollow ugc";
        link.textContent = visible;
        fragment.append(link);
      } catch {
        fragment.append(document.createTextNode(visible));
      }
      if (trailing) fragment.append(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }
    if (!cursor) continue;
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}

function linkifyFeedContent(root = document) {
  if (root?.nodeType === 1 && root.matches(".post-content, .comment-content, .comment")) linkifyUserText(root);
  root.querySelectorAll?.(".post-content, .comment-content, .comment").forEach(linkifyUserText);
}

linkifyFeedContent();
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) linkifyFeedContent(node);
    }
  }
}).observe(document.getElementById("feed") || document.body, { childList: true, subtree: true });

function refreshFeedMediaWorkspace(records) {
  const workspaceName = featurePanel.dataset?.workspaceName || featureHeading.textContent;
  if (featurePanel.hidden || !["Photos", "Videos", "Events", "Saved"].includes(workspaceName)) return;
  const feed = document.getElementById("feed");
  if (records.some(record => record.target === feed && (record.addedNodes.length || record.removedNodes.length))) {
    if (workspaceName === "Saved") {
      const savedList = featurePanel.querySelector(".saved-posts");
      if (savedList) renderSavedPosts(savedList);
    } else if (workspaceName === "Events") {
      const publishedEvents = featurePanel.querySelector(".published-events");
      if (publishedEvents) renderPublishedEvents(publishedEvents);
    } else renderWorkspace(workspaceName);
  }
}
new MutationObserver(records => {
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".post") && node !== reelsRail) { if (hiddenPostIds.has(String(node.dataset.postId || ""))) { node.remove(); return; } addReactionButton(node); addShareButton(node); addSaveButton(node); addPostDeleteButton(node); placeReelsRail(); }
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".comment")) addCommentDelete(node);
      if (node.nodeType === Node.ELEMENT_NODE) node.querySelectorAll?.(".comment").forEach(addCommentDelete);
    });
  }
  filterFeedPosts();
  refreshFeedMediaWorkspace(records);
}).observe(document.getElementById("feed"), { childList: true, subtree: true });
