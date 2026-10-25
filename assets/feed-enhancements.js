"use strict";

try {
  document.documentElement.classList.toggle("dark-mode", localStorage.getItem("danzstak_dark_mode") === "1");
  document.documentElement.classList.toggle("reduce-motion", localStorage.getItem("danzstak_reduce_motion") === "1");
  document.documentElement.lang = localStorage.getItem("danzstak_language") || "en";
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

function isLocalHost() {
  return location.hostname === "127.0.0.1" || location.hostname === "localhost";
}

function updateNotificationCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  for (const control of notificationControls) {
    if (!control.dataset.baseLabel) control.dataset.baseLabel = control.textContent.trim();
    control.textContent = safeCount ? `${control.dataset.baseLabel} (${safeCount})` : control.dataset.baseLabel;
    control.setAttribute("aria-label", safeCount ? `${control.dataset.baseLabel}, ${safeCount} new` : control.dataset.baseLabel);
  }
  if (lastNotificationCount !== null && safeCount !== lastNotificationCount) notificationAnnouncer.textContent = safeCount ? `${safeCount} new notification${safeCount === 1 ? "" : "s"}.` : "No new notifications.";
  lastNotificationCount = safeCount;
}

async function refreshNotificationCount() {
  if (readSections().Settings?.notifications === false) {
    updateNotificationCount(0);
    return;
  }
  try {
    const responses = await Promise.allSettled([
      fetch("https://api.danzstak.com/notifications", { credentials: "include", cache: "no-store" }),
      fetch("https://api.danzstak.com/engagement-notifications", { credentials: "include", cache: "no-store" })
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
}

function readSections() {
  try { return JSON.parse(localStorage.getItem(localKey) || "{}"); }
  catch { return {}; }
}

function writeSections(value) {
  localStorage.setItem(localKey, JSON.stringify(value));
}

function dataSaverEnabled() {
  try { return localStorage.getItem("danzstak_data_saver") === "1"; }
  catch { return false; }
}

function applyDataSaver(enabled) {
  try { localStorage.setItem("danzstak_data_saver", enabled ? "1" : "0"); } catch {}
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
    const view = document.createElement("button"); view.type = "button"; view.className = "secondary"; view.textContent = "View in Feed";
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
    empty.textContent = "No saved posts available. Save a post from its options menu to find it here.";
    list.appendChild(empty);
  }
  for (const post of posts) {
    const card = document.createElement("article"); card.className = "published-event-card";
    const content = document.createElement("p"); content.textContent = post.querySelector(".post-content")?.textContent || "Saved media";
    const author = document.createElement("small"); author.textContent = post.querySelector(".post-header a")?.textContent || "DanzStak post";
    const view = document.createElement("button"); view.type = "button"; view.className = "secondary"; view.textContent = "View post";
    view.addEventListener("click", () => openPostInFeed(post));
    card.append(content, author, view); list.appendChild(card);
  }
}

function renderWorkspace(name) {
  let workspace = featurePanel.querySelector(".feature-workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.className = "feature-workspace";
    featurePanel.appendChild(workspace);
  }
  workspace.replaceChildren();
  workspace.classList.remove("settings-workspace");
  const saved = readSections();

  if (name === "Saved") {
    featureText.textContent = "Saved posts you can currently view. Manage saved items from each post’s options menu.";
    const list = document.createElement("div"); list.className = "published-events saved-posts";
    workspace.appendChild(list);
    renderSavedPosts(list);
    return;
  }

  if (name === "Groups") {
    featureText.textContent = "Find communities by category, create a group, and connect with people who share your interests.";
    const categories = ["Artists", "DJs & Producers", "Fans", "Venues & Promoters", "Events", "Local Scenes", "Creators", "Industry Networking", "Politics", "Religion"];
    const createBox = document.createElement("div");
    createBox.className = "group-create-box";
    const groupName = field("Group name", "text", "Name your group");
    const categoryLabel = document.createElement("label");
    categoryLabel.textContent = "Category";
    const categorySelect = document.createElement("select");
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
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
    let customGroups = [...(saved.CustomGroups || [])];

    function renderGroups() {
      grid.replaceChildren();
      const defaults = categories.map((category, index) => ({ id: `default-${index}`, name: category, category, description: `Connect in ${category.toLowerCase()}.`, custom: false }));
      const groups = [...customGroups, ...defaults];
      for (const group of groups) {
        const isSensitiveDiscussion = ["Politics", "Religion"].includes(group.category);
        const card = document.createElement("article");
        card.className = "group-card" + (isSensitiveDiscussion ? " group-card--moderated" : "");
        const title = document.createElement("h4");
        title.textContent = group.name;
        const category = document.createElement("span");
        category.className = "group-category";
        category.textContent = group.category;
        const description = document.createElement("p");
        description.textContent = group.description;
        const join = document.createElement("button");
        join.type = "button";
        join.className = "primary";
        const joined = Boolean(saved.GroupsJoined?.[group.id]);
        join.textContent = joined ? "Joined" : "Join Group";
        join.classList.toggle("is-selected", joined);
        join.addEventListener("click", async () => {
          const nextJoined = !saved.GroupsJoined?.[group.id];
          join.disabled = true;
          try {
            const response = await fetch("https://api.danzstak.com/groups/membership", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ groupId: group.id, joined: nextJoined })
            });
            if (!response.ok) throw new Error("Membership could not be saved");
            saved.GroupsJoined = saved.GroupsJoined || {};
            saved.GroupsJoined[group.id] = nextJoined;
            writeSections(saved);
            join.textContent = nextJoined ? "Joined" : "Join Group";
            join.classList.toggle("is-selected", nextJoined);
          } catch (error) {
            alert(error.message);
          } finally {
            join.disabled = false;
          }
        });
        card.append(category, title, description);
        const moderation = document.createElement("div");
        moderation.className = "group-moderation-notice";
        const moderationTitle = document.createElement("strong");
        moderationTitle.textContent = isSensitiveDiscussion ? "Moderated discussion" : "Community Standards apply";
        const moderationText = document.createElement("span");
        moderationText.textContent = (isSensitiveDiscussion ? "Debate ideas freely. " : "") + "Hate speech, harassment, threats, and targeted abuse are not allowed.";
        const report = document.createElement("button");
        report.type = "button";
        report.className = "group-report";
        report.textContent = "Report a problem";
        report.addEventListener("click", async () => {
          const details = prompt("What should the moderators review?");
          if (!details?.trim()) return;
          if (details.trim().length > 500) { alert("Report details cannot exceed 500 characters."); return; }
          report.disabled = true;
          try {
            const response = await fetch("https://api.danzstak.com/reports", {
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
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "group-delete";
          remove.textContent = "Delete Group";
          remove.addEventListener("click", async () => {
            if (!confirm("Delete this group?")) return;
            remove.disabled = true;
            if (group.cloud) {
              const response = await fetch("https://api.danzstak.com/groups/" + encodeURIComponent(group.id), { method: "DELETE", credentials: "include" }).catch(() => null);
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
      const value = groupName.input.value.trim();
      if (!value) return groupName.input.focus();
      if (!standardsCheckbox.checked) {
        standardsError.hidden = false;
        standardsCheckbox.focus();
        return;
      }
      createButton.disabled = true;
      try {
        const response = await fetch("https://api.danzstak.com/groups", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: value, category: categorySelect.value, description: "A new DanzStak community group.", communityStandards: true }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.group) throw new Error(result.error || "Group could not be created");
        customGroups.unshift({ ...result.group, custom: true, cloud: true });
        saved.GroupsJoined = saved.GroupsJoined || {};
        saved.GroupsJoined[result.group.id] = true;
        saved.CustomGroups = customGroups.filter(item => !item.cloud);
        writeSections(saved);
      } catch (error) { alert(error.message); createButton.disabled = false; return; }
      groupName.input.value = "";
      standardsCheckbox.checked = false;
      renderGroups();
      createButton.disabled = false;
    });
    workspace.append(createBox, grid);
    renderGroups();
    fetch("https://api.danzstak.com/groups", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(async data => {
        if (!Array.isArray(data?.groups)) {
          createButton.textContent = "Create Group (updating)";
          createButton.title = "Group creation will be available after the current backend update.";
          return;
        }
        createButton.textContent = "Create Group";
        createButton.title = "";
        createButton.disabled = false;
        const cloud = data.groups.map(group => ({ ...group, custom: true, cloud: true }));
        const known = new Set(cloud.map(group => `${group.name.toLowerCase()}|${group.category}`));
        for (const local of customGroups.filter(group => !group.cloud && !known.has(`${group.name.toLowerCase()}|${group.category}`))) {
          const response = await fetch("https://api.danzstak.com/groups", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: local.name, category: local.category, description: local.description, communityStandards: true }) }).catch(() => null);
          if (response?.ok) { const result = await response.json(); if (result.group) { cloud.push({ ...result.group, custom: true, cloud: true }); saved.GroupsJoined = saved.GroupsJoined || {}; saved.GroupsJoined[result.group.id] = true; } }
        }
        customGroups = cloud;
        saved.CustomGroups = [];
        writeSections(saved);
        renderGroups();
      })
      .catch(() => { createButton.textContent = "Create Group (offline)"; });
    fetch("https://api.danzstak.com/groups/membership", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "list" }) })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!Array.isArray(data?.groupIds)) return;
        saved.GroupsJoined = Object.fromEntries(data.groupIds.map(groupId => [groupId, true]));
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
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Loading notifications…";
    list.appendChild(loading);
    workspace.appendChild(list);
    Promise.allSettled([
      fetch("https://api.danzstak.com/notifications", { credentials: "include", cache: "no-store" }),
      fetch("https://api.danzstak.com/calls/directory", { credentials: "include", cache: "no-store" }),
      fetch("https://api.danzstak.com/engagement-notifications", { credentials: "include", cache: "no-store" })
    ]).then(async results => {
        const response = results[0].status === "fulfilled" ? results[0].value : null;
        const directoryResponse = results[1].status === "fulfilled" ? results[1].value : null;
        const engagementResponse = results[2].status === "fulfilled" ? results[2].value : null;
        if (!response?.ok && !engagementResponse?.ok) throw new Error("Notifications could not be loaded");
        const data = response?.ok ? await response.json() : { notifications: [] };
        const engagement = engagementResponse?.ok ? (await engagementResponse.json()).notifications || [] : [];
        notificationSourceCounts.social = response?.ok ? (data.notifications || []).length : notificationSourceCounts.social;
        notificationSourceCounts.engagement = engagementResponse?.ok ? engagement.filter(notice => notice.unread !== false).length : notificationSourceCounts.engagement;
        data.notifications = [...(data.notifications || []), ...engagement].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        const directory = directoryResponse?.ok ? (await directoryResponse.json()).users || [] : [];
        const people = new Map(directory.map(person => [String(person.email || "").toLowerCase(), person]));
        updateNotificationCount(Object.values(notificationSourceCounts).reduce((total, count) => total + (count || 0), 0));
        list.replaceChildren();
        if (!(data.notifications || []).length) {
          const empty = document.createElement("p");
          empty.className = "muted";
          empty.textContent = "No new notifications.";
          list.appendChild(empty);
          return;
        }
        for (const notice of data.notifications) {
          const person = people.get(String(notice.email || "").toLowerCase());
          const displayName = person?.name || String(notice.email || "DanzStak member").split("@")[0];
          const row = document.createElement("article");
          row.className = "notification-row";
          row.classList.toggle("is-read", notice.unread === false);
          const avatar = person?.picture ? document.createElement("img") : document.createElement("span");
          avatar.className = "notification-avatar";
          if (person?.picture) { avatar.src = person.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
          else { avatar.textContent = displayName.charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
          const message = document.createElement("p");
          message.textContent = notice.type === "message"
            ? `${displayName}: ${notice.preview || "New message"}`
            : notice.type === "reaction"
              ? `${displayName} reacted ${notice.preview || "to your post"}.`
              : notice.type === "comment"
                ? `${displayName} commented: ${notice.preview || "New comment"}`
                : `${displayName} sent you a friend request.`;
          const actions = document.createElement("div");
          actions.className = "notification-actions";
          if (["reaction", "comment"].includes(notice.type)) {
            const open = document.createElement("a");
            open.className = "primary";
            open.textContent = "View post";
            open.href = `feed.html#post-${encodeURIComponent(notice.postId)}`;
            actions.appendChild(open);
          } else if (notice.type === "message") {
            const open = document.createElement("button");
            open.type = "button";
            open.className = "primary";
            open.textContent = "Open chat";
            open.addEventListener("click", () => {
              if (typeof window.openMessageDrawer === "function") window.openMessageDrawer(notice.email);
              setTimeout(() => {
                refreshNotificationCount();
                if (featureHeading.textContent === "Notifications") renderWorkspace("Notifications");
              }, 1500);
            });
            actions.appendChild(open);
          } else for (const [label, accept] of [["Accept", true], ["Decline", false]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = accept ? "primary" : "secondary";
            button.addEventListener("click", async () => {
              button.disabled = true;
              const response = await fetch("https://api.danzstak.com/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: notice.email, accept }) });
              if (response.ok) { row.remove(); await refreshNotificationCount(); if (typeof loadOnlineUsers === "function") loadOnlineUsers(); if (typeof loadFriends === "function") loadFriends(); }
              else { button.disabled = false; featureText.textContent = "Friend request could not be updated. Please try again."; }
            });
            actions.appendChild(button);
          }
          row.append(avatar, message, actions);
          list.appendChild(row);
        }
        if (engagement.length) {
          fetch("https://api.danzstak.com/engagement-notifications/read", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" })
            .then(marked => { if (marked.ok) { notificationSourceCounts.engagement = 0; updateNotificationCount((notificationSourceCounts.social || 0)); } })
            .catch(() => {});
        }
      })
      .catch(error => { loading.textContent = error.message; });
    return;
  }

  if (name === "Friends") {
    featureText.textContent = "All accepted friends appear here, including friends who are offline.";
    const list = document.createElement("div");
    list.className = "friends-workspace-list";
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Loading friends…";
    list.appendChild(loading);
    workspace.appendChild(list);
    Promise.allSettled([
      fetch("https://api.danzstak.com/friends", { credentials: "include", cache: "no-store" }),
      fetch("https://api.danzstak.com/calls/directory", { credentials: "include", cache: "no-store" })
    ]).then(async ([friendsResult, directoryResult]) => {
      const friendsResponse = friendsResult.status === "fulfilled" ? friendsResult.value : null;
      const directoryResponse = directoryResult.status === "fulfilled" ? directoryResult.value : null;
      if (!friendsResponse?.ok) throw new Error("Friends could not be loaded");
      const friends = (await friendsResponse.json()).friends || [];
      const online = new Set(directoryResponse?.ok
        ? ((await directoryResponse.json()).users || [])
          .filter(user => user.online === true)
          .map(user => String(user.email || "").toLowerCase())
        : []);
      list.replaceChildren();
      if (!friends.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No accepted friends yet.";
        list.appendChild(empty);
      }
      for (const friend of friends) {
        const link = document.createElement("a");
        link.className = "friend-card friend-card-large";
        link.href = "profile.html?user=" + encodeURIComponent(friend.email);
        const avatar = friend.picture ? document.createElement("img") : document.createElement("span");
        avatar.className = "friend-avatar";
        if (friend.picture) { avatar.src = friend.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
        else { avatar.textContent = (friend.name || friend.email).charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
        const details = document.createElement("span");
        details.className = "friend-details";
        const displayName = document.createElement("strong");
        displayName.textContent = friend.name || friend.email;
        const status = document.createElement("small");
        const friendIsOnline = online.has(String(friend.email || "").toLowerCase());
        status.textContent = friendIsOnline ? "Online" : "Offline";
        details.append(displayName, status);
        const presence = document.createElement("span");
        presence.className = friendIsOnline ? "friend-presence online" : "friend-presence";
        presence.setAttribute("aria-label", status.textContent);
        link.append(avatar, details, presence);
        list.appendChild(link);
      }
    }).catch(error => { loading.textContent = error.message; });
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
      button.disabled = true;
      featureText.textContent = "Publishing event…";
      try {
        const formattedDate = new Date(date.input.value + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        const response = await fetch("https://api.danzstak.com/secure-posts", {
          method: "POST", credentials: "include", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `📅 Event: ${title.input.value.trim()}\n${formattedDate}`, audience: audience.value, originalContentCertified: true })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Event could not be published");
        featureText.textContent = "Event published to DanzStak.";
        title.input.value = "";
        date.input.value = "";
        if (typeof window.loadPosts === "function") await window.loadPosts();
        renderWorkspace("Events");
      } catch (error) { featureText.textContent = error.message; }
      finally { button.disabled = false; }
    });
    workspace.append(title.wrap, date.wrap, audience, eventCertification, button, publishedHeading, publishedEvents);
    return;
  }

  if (name === "Settings") {
    workspace.classList.add("settings-workspace");
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
    const darkCheckbox = document.createElement("input");
    darkCheckbox.type = "checkbox";
    darkCheckbox.checked = document.documentElement.classList.contains("dark-mode");
    darkCheckbox.setAttribute("aria-label", "Use dark mode");
    darkCheckbox.addEventListener("change", () => {
      document.documentElement.classList.toggle("dark-mode", darkCheckbox.checked);
      localStorage.setItem("danzstak_dark_mode", darkCheckbox.checked ? "1" : "0");
    });
    const motionCheckbox = document.createElement("input");
    motionCheckbox.type = "checkbox";
    motionCheckbox.checked = document.documentElement.classList.contains("reduce-motion");
    motionCheckbox.setAttribute("aria-label", "Reduce interface motion");
    motionCheckbox.addEventListener("change", () => {
      document.documentElement.classList.toggle("reduce-motion", motionCheckbox.checked);
      localStorage.setItem("danzstak_reduce_motion", motionCheckbox.checked ? "1" : "0");
    });
    const dataSaverCheckbox = document.createElement("input");
    dataSaverCheckbox.type = "checkbox";
    dataSaverCheckbox.checked = localStorage.getItem("danzstak_data_saver") === "1";
    dataSaverCheckbox.setAttribute("aria-label", "Use less mobile data");
    dataSaverCheckbox.addEventListener("change", () => applyDataSaver(dataSaverCheckbox.checked));
    const language = document.createElement("select");
    language.setAttribute("aria-label", "DanzStak language");
    for (const [value, label] of [["en", "English"]]) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; language.appendChild(option);
    }
    language.value = localStorage.getItem("danzstak_language") || "en";
    language.addEventListener("change", () => { localStorage.setItem("danzstak_language", language.value); document.documentElement.lang = language.value; });
    const appSettings = document.createElement("button");
    appSettings.type = "button";
    appSettings.className = "secondary";
    appSettings.textContent = "Manage";
    appSettings.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("danzstak:show-install"));
      featureText.textContent = "Install DanzStak from the prompt. Notification and camera permissions remain under your browser or device settings.";
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
        featureText.textContent = "Background call alerts are enabled on this device, including while the installed app is closed.";
      } catch (error) {
        featureText.textContent = error.message;
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
    sessionInfo.textContent = "Signs out after 2h without activity";
    const logout = document.createElement("button");
    logout.type = "button"; logout.className = "secondary"; logout.dataset.logout = ""; logout.textContent = "Logout";
    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";
    button.disabled = true;
    button.textContent = "Loading Settings…";
    fetch("https://api.danzstak.com/settings/presence", { credentials: "include", cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("Account settings could not be loaded.");
        return response.json();
      })
      .then(data => {
        presenceCheckbox.checked = data.onlineVisible !== false;
        if (typeof data.darkMode === "boolean") {
          darkCheckbox.checked = data.darkMode;
          document.documentElement.classList.toggle("dark-mode", data.darkMode);
          localStorage.setItem("danzstak_dark_mode", data.darkMode ? "1" : "0");
        }
        if (typeof data.reduceMotion === "boolean") {
          motionCheckbox.checked = data.reduceMotion;
          document.documentElement.classList.toggle("reduce-motion", data.reduceMotion);
          localStorage.setItem("danzstak_reduce_motion", data.reduceMotion ? "1" : "0");
        }
        if (typeof data.dataSaver === "boolean") {
          dataSaverCheckbox.checked = data.dataSaver;
          applyDataSaver(data.dataSaver);
        }
        if (data.language === "en") {
          language.value = data.language;
          document.documentElement.lang = data.language;
          localStorage.setItem("danzstak_language", data.language);
        }
        button.disabled = false;
        button.textContent = "Save Settings";
      })
      .catch(error => {
        featureText.textContent = error.message + " Retry before changing privacy preferences.";
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
        const response = await fetch("https://api.danzstak.com/settings/presence", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ onlineVisible: presenceCheckbox.checked, darkMode: darkCheckbox.checked, reduceMotion: motionCheckbox.checked, dataSaver: dataSaverCheckbox.checked, language: language.value })
        });
        if (!response.ok) throw new Error("Account settings could not be saved.");
        featureText.textContent = "Settings saved to your DanzStak account.";
        refreshNotificationCount();
        if (typeof loadOnlineUsers === "function") loadOnlineUsers();
      } catch (error) { featureText.textContent = error.message; }
      finally { button.disabled = false; }
    });
    workspace.append(
      heading,
      settingRow("👤", "Account settings", notifications),
      settingRow("🔒", "Privacy center", presence),
      settingRow("🌙", "Dark mode", darkCheckbox),
      settingRow("✨", "Reduce motion", motionCheckbox),
      settingRow("📶", "Data saver", dataSaverCheckbox),
      settingRow("🌐", "Language", language),
      settingRow("🔔", "Call and message alerts", alertSettings),
      settingRow("📱", "App and device settings", appSettings),
      settingRow("🕒", "Session timeout", sessionInfo),
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
  groupsLink.textContent = "\uD83D\uDC65 Groups";
  groupsLink.setAttribute("aria-label", "Groups");
  friendsLink.insertAdjacentElement("afterend", groupsLink);
}

const workspaceRoutes = new Map(["Friends", "Groups", "Photos", "Videos", "Events", "Saved", "Settings", "Notifications"].map(name => [name.toLowerCase(), name]));
function openWorkspaceRoute(name, pushHistory = true) {
  if (!workspaceRoutes.has(String(name).toLowerCase())) return false;
  const canonicalName = workspaceRoutes.get(String(name).toLowerCase());
  document.getElementById("newsFeedView").hidden = true;
  featurePanel.hidden = false;
  featureHeading.textContent = canonicalName;
  document.querySelectorAll("[data-feature]").forEach(control => {
    const active = control.dataset.feature === canonicalName;
    if (control.matches(".menu a")) control.classList.toggle("active", active);
    if (active) control.setAttribute("aria-current", "page");
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
    openWorkspaceRoute(name);
  });
});

function restoreWorkspaceRoute() {
  const name = workspaceRoutes.get(location.hash.slice(1).toLowerCase());
  if (name) openWorkspaceRoute(name, false);
  else if (!location.hash || location.hash === "#feed" || location.hash.startsWith("#post-")) {
    featurePanel.hidden = true;
    document.getElementById("newsFeedView").hidden = false;
    document.querySelectorAll(".menu a").forEach(link => link.classList.toggle("active", link.getAttribute("href") === "feed.html"));
    document.querySelectorAll("[data-feature][aria-current]").forEach(control => control.removeAttribute("aria-current"));
  }
}
addEventListener("popstate", restoreWorkspaceRoute);
restoreWorkspaceRoute();

refreshNotificationCount();
setInterval(refreshNotificationCount, 30000);
window.addEventListener("focus", refreshNotificationCount);

const search = document.querySelector(".search");
search.setAttribute("aria-label", "Search feed posts");
search.placeholder = "Search feed posts";
search.setAttribute("aria-controls", "feed");
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
    const searchable = content ? `${author?.textContent || ""} ${content.textContent}` : post.textContent;
    post.hidden = Boolean(query) && !searchable.toLowerCase().includes(query);
    if (!post.hidden) matchingPosts += 1;
  });
  searchFeedback.hidden = !query;
  searchFeedback.textContent = query
    ? matchingPosts ? `${matchingPosts} matching feed result${matchingPosts === 1 ? "" : "s"}.` : "No matching feed posts. Try another search or clear the search box."
    : "";
}
search.addEventListener("input", filterFeedPosts);
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
  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.className = "secondary";
  emojiButton.textContent = "Emoji";
  const emojiPicker = document.createElement("div");
  emojiPicker.className = "emoji-picker";
  emojiPicker.hidden = true;
  emojiPicker.style.width = "100%";
  emojiPicker.style.padding = "10px";
  emojiPicker.style.background = "#f0f2f5";
  emojiPicker.style.borderRadius = "10px";
  for (const emoji of ["😀", "😂", "😍", "🔥", "🎉", "👏", "❤️", "🤘", "🎤", "🎧", "💯", "🙏"]) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.textContent = emoji;
    choice.setAttribute("aria-label", "Insert " + emoji);
    choice.style.fontSize = "24px";
    choice.style.border = "0";
    choice.style.background = "transparent";
    choice.style.padding = "7px";
    choice.addEventListener("click", () => {
      const composer = document.getElementById("postText");
      const start = composer.selectionStart;
      composer.setRangeText(emoji, start, composer.selectionEnd, "end");
      composer.focus();
    });
    emojiPicker.appendChild(choice);
  }
  emojiButton.addEventListener("click", () => { emojiPicker.hidden = !emojiPicker.hidden; });
  mediaTools.append(emojiButton, emojiPicker);
  composerActions.parentElement.insertBefore(mediaTools, certification);
  composerActions.parentElement.insertBefore(preview, certification);

  publishButton.addEventListener("click", () => {
    if (isLocalHost()) return;
    if (!selectedMedia) return;
    const media = selectedMedia;
    const observer = new MutationObserver(records => {
      const post = records.flatMap(record => [...record.addedNodes]).find(node => node.nodeType === Node.ELEMENT_NODE && node.matches?.(".post"));
      if (!post) return;
      if (post.querySelector(".post-media")) {
        preview.replaceChildren();
        selectedMedia = null;
        window.danzstakSelectedMedia = null;
        observer.disconnect();
        return;
      }
      const element = document.createElement(media.kind === "image" ? "img" : "video");
      element.src = media.url;
      element.style.width = "100%";
      element.style.maxHeight = "560px";
      element.style.objectFit = "contain";
      element.style.borderRadius = "10px";
      let badge = null;
      if (media.kind === "video") {
        element.controls = true;
        badge = document.createElement("p");
        badge.className = "copyright-scan-status";
        badge.textContent = "Rights certification: local preview only";
      }
      post.querySelector(".post-content").insertAdjacentElement("afterend", element);
      if (badge) element.insertAdjacentElement("afterend", badge);
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
      observer.disconnect();
    });
    observer.observe(document.getElementById("feed"), { childList: true });
    setTimeout(() => observer.disconnect(), 10000);
  }, true);

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
      like.textContent = "Like";
      const comment = document.createElement("button");
      comment.type = "button";
      comment.className = "commentBtn";
      comment.textContent = "Comment";
      actions.append(like, comment);
      const comments = document.createElement("div");
      comments.className = "comments";
      comments.hidden = true;
      const commentInput = document.createElement("input");
      commentInput.setAttribute("aria-label", "Write a comment");
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
  button.textContent = "Share";
  button.addEventListener("click", async () => {
    if ((post.dataset.audience || "public") !== "public") {
      alert("Only Public posts can be shared outside DanzStak.");
      return;
    }
    const content = post.querySelector(".post-content")?.textContent.trim() || "DanzStak post";
    const shareUrl = postPermalink(post);
    const shareData = { title: "DanzStak", text: content.slice(0, 200), url: shareUrl };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { if (error.name !== "AbortError") alert("Unable to share this post."); }
      return;
    }
    const facebook = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(shareUrl);
    window.open(facebook, "_blank", "noopener,noreferrer,width=720,height=620");
  });
  actions.appendChild(button);
}

function postPermalink(post) {
  const url = new URL("feed.html", location.href);
  url.search = "";
  url.hash = post.dataset.postId ? "post-" + post.dataset.postId : "";
  return url.href;
}

const changedPostPreferenceFields = new Map();

function mergeRemotePostPreferences(postId, current, remote) {
  const merged = { ...(current || {}) };
  const changed = changedPostPreferenceFields.get(postId);
  for (const [name, values] of Object.entries(remote)) {
    if (!changed?.has(name)) merged[name] = values.has(postId);
  }
  return merged;
}

function readPostPreferences() {
  try { return JSON.parse(localStorage.getItem(postPreferencesKey) || "{}"); }
  catch { return {}; }
}

async function updatePostPreference(post, changes) {
  const postId = String(post.dataset.postId || "");
  if (!postId) return;
  if (!isLocalHost()) {
    const remoteNames = { pinned: "pinned", saved: "saved", notificationsOff: "muted" };
    for (const [name, enabled] of Object.entries(changes)) {
      if (!remoteNames[name] || typeof enabled !== "boolean") continue;
      const response = await fetch("https://api.danzstak.com/settings/posts", {
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
  try { localStorage.setItem(postPreferencesKey, JSON.stringify(preferences)); }
  catch { /* Confirmed account preferences remain usable without local storage. */ }
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
    const response = await fetch("https://api.danzstak.com/settings/posts", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, preference: "hidden", enabled: true })
    });
    if (!response.ok) throw new Error("This post could not be hidden from your account. Please try again.");
  }
  hiddenPostIds.add(postId);
  recentlyHiddenPostIds.add(postId);
  try { localStorage.setItem(hiddenPostKey, JSON.stringify([...hiddenPostIds])); } catch {}
  post.remove();
}

if (!isLocalHost()) fetch("https://api.danzstak.com/settings/posts", { credentials: "include", cache: "no-store" })
  .then(response => response.ok ? response.json() : null)
  .then(data => {
    if (!data) return;
    hiddenPostIds = new Set([...(data.hidden || data.postIds || []).map(String), ...recentlyHiddenPostIds]);
    localStorage.setItem(hiddenPostKey, JSON.stringify([...hiddenPostIds]));
    const preferences = readPostPreferences();
    const remote = { pinned: new Set((data.pinned || []).map(String)), saved: new Set((data.saved || []).map(String)), notificationsOff: new Set((data.muted || []).map(String)) };
    const visibleIds = [...document.querySelectorAll(".post[data-post-id]")].map(post => String(post.dataset.postId));
    for (const postId of visibleIds) preferences[postId] = mergeRemotePostPreferences(postId, preferences[postId], remote);
    localStorage.setItem(postPreferencesKey, JSON.stringify(preferences));
    applyHiddenPosts();
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
      const response = await fetch("https://api.danzstak.com/reports", {
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
    const owner = post.dataset.isOwner !== "false";
    const audienceBadge = post.querySelector(".post-audience");
    const audienceText = audienceBadge?.textContent || "Public";
    post.dataset.privacySetting = String(/Friends/i.test(audienceText) ? 1 : /Only me/i.test(audienceText) ? 2 : 0);
  post.dataset.pinned = String(preferences.pinned === true);
  post.dataset.saved = String(preferences.saved === true);
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
        if (updated === body.textContent.trim()) { editor.hidden = true; return; }
        save.disabled = true;
        const postId = post.dataset.postId;
        if (postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
          try {
            const response = await fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId), {
              method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: updated })
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
        post.dataset.edited = "true";
        editor.hidden = true;
        save.disabled = false;
      });
      controls.append(cancel, save);
      editor.append(textarea, controls);
      body.insertAdjacentElement("afterend", editor);
    }
    const textarea = editor.querySelector("textarea");
    textarea.value = body.textContent.trim();
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
        const response = await fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId), {
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
          const response = await fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId), {
            method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: post.querySelector(".post-content")?.textContent.trim() || "Shared media", audience: audiences[next] })
          });
          if (!response.ok) throw new Error("Privacy could not be saved");
        } catch (error) { alert(error.message); button.disabled = false; return; }
      }
      post.dataset.privacySetting = String(next);
      post.dataset.audience = audiences[next];
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
    if (post.dataset.isOwner === "false") {
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
        const response = await fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId), { method: "DELETE", credentials: "include" });
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
const reactionEmoji = { Like: "👍", Love: "❤️", Laugh: "😂", Wow: "😮", Sad: "😢", Fire: "🔥" };

function engagementPostId(post) {
  const value = String(post?.dataset.postId || "");
  return /^[a-f0-9-]{36}$/.test(value) ? value : "";
}

function setReactionAppearance(post, reaction, counts = {}) {
  const like = post.querySelector(".likeBtn");
  if (!like) return;
  like.dataset.liked = String(Boolean(reaction));
  like.dataset.reaction = reaction || "";
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  const emoji = reactionEmoji[reaction] || "♡";
  like.replaceChildren(document.createTextNode(`${emoji} ${reaction || "Like"}${total ? ` · ${total}` : ""}`));
}

function renderPersistentComment(post, comment) {
  const list = post.querySelector(".commentList");
  if (!list || list.querySelector(`[data-comment-id="${CSS.escape(comment.commentId)}"]`)) return;
  const item = document.createElement("div");
  item.className = "comment";
  item.dataset.commentId = comment.commentId;
  item.dataset.canDelete = String(comment.canDelete === true);
  const author = document.createElement("strong");
  author.textContent = (comment.userEmail || "DanzStak member").split("@")[0] + ": ";
  item.append(author, document.createTextNode(comment.content));
  list.appendChild(item);
  addCommentDelete(item);
}

async function loadEngagement(post) {
  const postId = engagementPostId(post);
  if (!postId || post.dataset.engagementLoaded === "true") return;
  const version = post.dataset.engagementVersion || "0";
  post.dataset.engagementLoaded = "true";
  try {
    const response = await fetch(`${engagementApi}/engagement?postId=${encodeURIComponent(postId)}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) { if (version === (post.dataset.engagementVersion || "0")) post.dataset.engagementLoaded = ""; return; }
    const data = await response.json();
    if (version !== (post.dataset.engagementVersion || "0")) return;
    post.dataset.reactionCounts = JSON.stringify(data.reactionCounts || {});
    setReactionAppearance(post, data.myReaction || "", data.reactionCounts || {});
    const list = post.querySelector(".commentList");
    if (list) list.replaceChildren();
    for (const comment of data.comments || []) renderPersistentComment(post, comment);
  } catch { if (version === (post.dataset.engagementVersion || "0")) post.dataset.engagementLoaded = ""; }
}

const pendingReactionSaves = new WeakMap();
async function saveReaction(post, reaction) {
  const postId = engagementPostId(post);
  if (!postId) return;
  const previous = pendingReactionSaves.get(post) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const response = await fetch(`${engagementApi}/reactions`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, reaction }) });
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
  try {
    const response = await fetch(`${engagementApi}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, content }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Comment could not be saved");
    post.dataset.engagementVersion = String(Number(post.dataset.engagementVersion || 0) + 1);
    input.value = "";
    renderPersistentComment(post, data.comment);
    post.dataset.engagementLoaded = "";
    await loadEngagement(post);
  } catch (error) { alert(error.message); }
  finally { input.disabled = false; input.focus(); }
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
      const response = await fetch(`${engagementApi}/comments/${encodeURIComponent(commentId)}?postId=${encodeURIComponent(postId)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
      if (!response?.ok) { button.disabled = false; alert("Comment could not be deleted."); return; }
      post.dataset.engagementVersion = String(Number(post.dataset.engagementVersion || 0) + 1);
      post.dataset.engagementLoaded = "";
    }
    comment.remove();
  });
  comment.appendChild(button);
}

function addReactionButton(post) {
  const like = post.querySelector(".likeBtn");
  if (!like || like.dataset.reactionsReady === "true") return;
  like.dataset.reactionsReady = "true";
  const initialHeart = document.createElement("span");
  initialHeart.className = "like-heart";
  initialHeart.textContent = "\u2661";
  like.replaceChildren(initialHeart, document.createTextNode(" Like"));
  const palette = document.createElement("div");
  palette.className = "reaction-palette";
  palette.hidden = true;
  const reactions = [["👍", "Like"], ["❤️", "Love"], ["😂", "Laugh"], ["😮", "Wow"], ["😢", "Sad"], ["🔥", "Fire"]];
  for (const [emoji, label] of reactions) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.textContent = emoji;
    choice.title = label;
    choice.setAttribute("aria-label", label);
    choice.addEventListener("click", event => {
      event.stopPropagation();
      like.dataset.liked = "true";
      like.dataset.reaction = label;
      if (label === "Love") {
        const heart = document.createElement("span");
        heart.className = "like-heart";
        heart.textContent = "\u2665";
        like.replaceChildren(heart, document.createTextNode(" Love"));
      } else {
        like.textContent = `${emoji} ${label}`;
      }
      palette.hidden = true;
      saveReaction(post, label).catch(() => { post.dataset.engagementLoaded = ""; loadEngagement(post); });
    });
    palette.appendChild(choice);
  }
  post.appendChild(palette);
  let holdTimer = null;
  let held = false;
  like.addEventListener("pointerdown", () => {
    held = false;
    holdTimer = setTimeout(() => { held = true; palette.hidden = false; }, 500);
  });
  const cancelHold = () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; };
  like.addEventListener("pointerup", cancelHold);
  like.addEventListener("pointerleave", cancelHold);
  like.addEventListener("pointercancel", cancelHold);
  like.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!held) {
      const liked = like.dataset.liked === "true";
      like.dataset.liked = String(!liked);
      like.dataset.reaction = liked ? "" : "Like";
      const heart = document.createElement("span");
      heart.className = "like-heart";
      heart.textContent = liked ? "\u2661" : "\u2665";
      like.replaceChildren(heart, document.createTextNode(liked ? " Like" : " Liked"));
      saveReaction(post, liked ? "" : "Like").catch(() => { post.dataset.engagementLoaded = ""; loadEngagement(post); });
      return;
    }
    held = false;
  }, true);
  loadEngagement(post);
}

const reelsStorageKey = "danzstak_external_reels";
let cloudReels = null;
let internalReels = [];
const reelsRail = document.createElement("section");
reelsRail.className = "reels-rail post";
reelsRail.setAttribute("aria-label", "External video reels");
const reelsHeading = document.createElement("div");
reelsHeading.className = "reels-heading";
const reelsTitle = document.createElement("h3");
reelsTitle.textContent = "Reels";
const reelsSourceNote = document.createElement("span");
reelsSourceNote.textContent = "Externally hosted videos";
reelsHeading.append(reelsTitle, reelsSourceNote);
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
addReel.textContent = "Add Reel";
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

async function loadInternalReels(posts = []) {
  const videos = posts.filter(post => post.reel === true && post.mediaType === "video" && post.mediaKey);
  const resolved = await Promise.all(videos.map(async post => {
    let mediaUrl = post.mediaUrl || "";
    if (!mediaUrl) {
      const response = await fetch("https://api.danzstak.com/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", mediaKey: post.mediaKey, mediaType: "video" }) }).catch(() => null);
      if (response?.ok) mediaUrl = (await response.json()).mediaUrl || "";
    }
    return mediaUrl ? { id: post.postId, postId: post.postId, mediaUrl, platform: "DanzStak", content: post.content || "Shared video", internal: true, isOwner: post.isOwner === true } : null;
  }));
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
    empty.textContent = "Videos shared to Reels will appear here.";
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
      video.preload = dataSaverEnabled() ? "none" : "metadata";
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
    platform.textContent = reel.platform;
    const source = document.createElement("small");
    source.textContent = reel.internal ? reel.content : reelUrlValue.hostname;
    details.append(platform, source);
    if (reel.internal) {
      const open = document.createElement("a"); open.href = "#post-" + encodeURIComponent(reel.postId); open.textContent = "View post"; details.appendChild(open);
    } else {
      const open = document.createElement("a"); open.href = reel.url; open.target = "_blank"; open.rel = "noopener noreferrer nofollow"; open.textContent = playerInfo ? "Open on source" : "Play on source"; details.appendChild(open);
    }
    if (!reel.internal && (!Array.isArray(cloudReels) || reel.isOwner === true)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "reel-delete";
      remove.textContent = "Delete Reel";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        if (Array.isArray(cloudReels)) {
          const response = await fetch("https://api.danzstak.com/stories/" + encodeURIComponent(reel.id), { method: "DELETE", credentials: "include" }).catch(() => null);
          if (!response?.ok) { remove.disabled = false; reelStatus.textContent = "Reel could not be deleted."; return; }
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
  if (posts.length >= 3) posts[2].insertAdjacentElement("afterend", reelsRail);
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
    const response = await fetch("https://api.danzstak.com/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reel", url: parsed.href, rightsCertified: true }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.reel) throw new Error(result.error || "Reel could not be saved to DanzStak.");
    const reel = result.reel;
    cloudReels = Array.isArray(cloudReels) ? cloudReels : [];
    cloudReels.unshift({ ...reel, platform: reelPlatform(new URL(reel.url).hostname) });
    reelUrl.value = "";
    reelPermissionCheck.checked = false;
    reelStatus.textContent = "Reel saved to DanzStak.";
    renderPlayableReels();
  } catch (error) {
    reelStatus.textContent = error.message || "Reel could not be saved to DanzStak.";
  } finally {
    addReel.disabled = false;
  }
});

async function loadCloudReels() {
  try {
    const response = await fetch("https://api.danzstak.com/stories", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.reels)) return;
    cloudReels = data.reels.map(reel => ({ ...reel, platform: reelPlatform(new URL(reel.url).hostname) }));
    const pending = getLocalReels();
    const remaining = [];
    const existingUrls = new Set(cloudReels.map(reel => reel.url));
    for (const local of pending) {
      if (existingUrls.has(local.url)) continue;
      const saved = await fetch("https://api.danzstak.com/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reel", url: local.url, rightsCertified: true }) }).catch(() => null);
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
    else video.play().catch(() => {});
  });
});
document.getElementById("feed").addEventListener("keydown", event => {
  if (event.key !== "Enter" || !event.target.matches(".comments input")) return;
  const post = event.target.closest(".post");
  if (!engagementPostId(post)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  saveComment(post, event.target);
}, true);
document.querySelectorAll("#feed .post").forEach(post => { if (post !== reelsRail && !hiddenPostIds.has(String(post.dataset.postId || ""))) { addReactionButton(post); addShareButton(post); addPostDeleteButton(post); } else if (post !== reelsRail) post.remove(); });
function refreshFeedMediaWorkspace(records) {
  if (featurePanel.hidden || !["Photos", "Videos", "Events", "Saved"].includes(featureHeading.textContent)) return;
  const feed = document.getElementById("feed");
  if (records.some(record => record.target === feed && (record.addedNodes.length || record.removedNodes.length))) {
    if (featureHeading.textContent === "Saved") {
      const savedList = featurePanel.querySelector(".saved-posts");
      if (savedList) renderSavedPosts(savedList);
    } else if (featureHeading.textContent === "Events") {
      const publishedEvents = featurePanel.querySelector(".published-events");
      if (publishedEvents) renderPublishedEvents(publishedEvents);
    } else renderWorkspace(featureHeading.textContent);
  }
}
new MutationObserver(records => {
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".post") && node !== reelsRail) { if (hiddenPostIds.has(String(node.dataset.postId || ""))) { node.remove(); return; } addReactionButton(node); addShareButton(node); addPostDeleteButton(node); placeReelsRail(); }
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".comment")) addCommentDelete(node);
      if (node.nodeType === Node.ELEMENT_NODE) node.querySelectorAll?.(".comment").forEach(addCommentDelete);
    });
  }
  filterFeedPosts();
  refreshFeedMediaWorkspace(records);
}).observe(document.getElementById("feed"), { childList: true, subtree: true });
