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

  if (name === "Groups") {
    featureText.textContent = "Find communities by category, create a group, and connect with people who share your interests.";
    const categories = ["Artists", "DJs & Producers", "Fans", "Venues & Promoters", "Events", "Local Scenes", "Creators", "Industry Networking"];
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
    createButton.textContent = "Create Group";
    createBox.append(groupName.wrap, categoryLabel, createButton);
    const grid = document.createElement("div");
    grid.className = "groups-grid";

    function renderGroups() {
      grid.replaceChildren();
      const defaults = categories.map((category, index) => ({ id: `default-${index}`, name: category, category, description: `Connect in ${category.toLowerCase()}.`, custom: false }));
      const groups = [...(saved.CustomGroups || []), ...defaults];
      for (const group of groups) {
        const card = document.createElement("article");
        card.className = "group-card";
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
        join.addEventListener("click", () => {
          saved.GroupsJoined = saved.GroupsJoined || {};
          saved.GroupsJoined[group.id] = !saved.GroupsJoined[group.id];
          writeSections(saved);
          join.textContent = saved.GroupsJoined[group.id] ? "Joined" : "Join Group";
        });
        card.append(category, title, description, join);
        if (group.custom) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "group-delete";
          remove.textContent = "Delete Group";
          remove.addEventListener("click", () => {
            if (!confirm("Delete this group?")) return;
            saved.CustomGroups = saved.CustomGroups.filter(item => item.id !== group.id);
            writeSections(saved);
            renderGroups();
          });
          card.appendChild(remove);
        }
        grid.appendChild(card);
      }
    }

    createButton.addEventListener("click", () => {
      const value = groupName.input.value.trim();
      if (!value) return groupName.input.focus();
      saved.CustomGroups = [...(saved.CustomGroups || []), { id: crypto.randomUUID(), name: value, category: categorySelect.value, description: "A new DANZSTAK community group.", custom: true }];
      writeSections(saved);
      groupName.input.value = "";
      renderGroups();
    });
    workspace.append(createBox, grid);
    renderGroups();
    return;
  }

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

const friendsLink = document.querySelector('.menu [data-feature="Friends"]');
if (friendsLink && !document.querySelector('[data-feature="Groups"]')) {
  const groupsLink = document.createElement("a");
  groupsLink.href = "#groups";
  groupsLink.dataset.feature = "Groups";
  groupsLink.textContent = "Groups";
  friendsLink.insertAdjacentElement("afterend", groupsLink);
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
  certification.append(checkbox, document.createTextNode("I certify this is entirely my original content, including any music inside a video, and authorize sharing through DANZSTAK."));
  composerActions.parentElement.insertBefore(certification, composerActions);
  publishButton.addEventListener("click", event => {
    if (checkbox.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert("You must certify that the post is entirely your original content.");
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
        scanStatus.textContent = isLocalHost() ? "Copyright check: not scanned — local preview only" : "Copyright check: required before publishing";
        preview.appendChild(scanStatus);
      }
    });
    mediaTools.append(button, input);
  }

  mediaPicker("Add Photo", "image/jpeg,image/png,image/webp,image/gif", "image", null);
  mediaPicker("Add Video", "video/mp4,video/webm,video/quicktime", "video", 100 * 1024 * 1024);
  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.className = "secondary";
  emojiButton.textContent = "Add Emoji";
  const emojiPicker = document.createElement("div");
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
        badge.textContent = "Copyright check: not scanned — local preview only";
      }
      post.querySelector(".post-content").insertAdjacentElement("afterend", element);
      if (badge) element.insertAdjacentElement("afterend", badge);
      preview.replaceChildren();
      selectedMedia = null;
      observer.disconnect();
    });
    observer.observe(document.getElementById("feed"), { childList: true });
    setTimeout(() => observer.disconnect(), 10000);
  }, true);

  function isLocalHost() {
    return location.hostname === "127.0.0.1" || location.hostname === "localhost";
  }

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
          mediaBadge.textContent = "Copyright check: not scanned — local preview only";
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
    const content = post.querySelector(".post-content")?.textContent.trim() || "DANZSTAK post";
    const shareData = { title: "DANZSTAK", text: content.slice(0, 200), url: location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { if (error.name !== "AbortError") alert("Unable to share this post."); }
      return;
    }
    const facebook = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(location.href);
    window.open(facebook, "_blank", "noopener,noreferrer,width=720,height=620");
  });
  actions.appendChild(button);
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
  menu.hidden = true;
  const history = [];

  function option(title, description, handler) {
    const button = document.createElement("button");
    button.type = "button";
    const strong = document.createElement("strong");
    strong.textContent = title;
    button.appendChild(strong);
    if (description) {
      const small = document.createElement("small");
      small.textContent = description;
      button.appendChild(small);
    }
    button.addEventListener("click", async () => { await handler(button); menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); });
    menu.appendChild(button);
  }

  option("Pin post", "Keep this post at the top of your feed.", button => {
    const pinned = post.dataset.pinned === "true";
    post.dataset.pinned = String(!pinned);
    button.querySelector("strong").textContent = pinned ? "Pin post" : "Unpin post";
    if (!pinned) post.parentElement.prepend(post);
  });
  option("Save post", "Add this to your saved items.", button => {
    const saved = post.dataset.saved === "true";
    post.dataset.saved = String(!saved);
    button.querySelector("strong").textContent = saved ? "Save post" : "Unsave post";
  });
  option("View edit history", "See changes made to this post.", () => {
    alert(history.length ? history.map((item, index) => `${index + 1}. ${item}`).join("\n") : "This post has not been edited.");
  });
  option("Edit post", "Change your post text.", () => {
    const body = post.querySelector(".post-content");
    const updated = prompt("Edit post", body.textContent);
    if (updated === null || !updated.trim() || updated.trim() === body.textContent) return;
    history.push(body.textContent);
    body.textContent = updated.trim();
  });
  option("Who can comment?", "Everyone", button => {
    const values = ["Everyone", "Friends", "Comments off"];
    const current = Number(post.dataset.commentSetting || 0);
    const next = (current + 1) % values.length;
    post.dataset.commentSetting = String(next);
    button.querySelector("small").textContent = values[next];
    post.querySelector(".commentBtn").disabled = next === 2;
  });
  option("Edit privacy", "Public", button => {
    const values = ["Public", "Friends", "Only me"];
    const current = Number(post.dataset.privacySetting || 0);
    const next = (current + 1) % values.length;
    post.dataset.privacySetting = String(next);
    button.querySelector("small").textContent = values[next];
  });
  option("Move to archive", "Hide this post without deleting it.", () => { post.hidden = true; });
  option("Move to trash", "Items in trash are scheduled for deletion after 30 days.", async () => {
    if (!confirm("Move this post to trash?")) return;
    const postId = post.dataset.postId;
    if (postId && !location.hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
      try {
        const response = await fetch("https://api.danzstak.com/secure-posts/" + encodeURIComponent(postId), { method: "DELETE", credentials: "include" });
        if (!response.ok) throw new Error();
      } catch { alert("The post could not be moved to trash on the server."); return; }
    }
    post.remove();
  });
  option("Turn off notifications", "Stop updates for this post.", button => {
    const off = post.dataset.notificationsOff === "true";
    post.dataset.notificationsOff = String(!off);
    button.querySelector("strong").textContent = off ? "Turn off notifications" : "Turn on notifications";
  });
  option("Copy link", "Copy a shareable link to this post.", async () => {
    try { await navigator.clipboard.writeText(location.href + (post.dataset.postId ? `#post-${post.dataset.postId}` : "")); }
    catch { alert("Copying is unavailable in this browser."); }
  });

  toggle.addEventListener("click", () => {
    document.querySelectorAll(".post-options-menu").forEach(other => { if (other !== menu) other.hidden = true; });
    menu.hidden = !menu.hidden;
    toggle.setAttribute("aria-expanded", String(!menu.hidden));
  });
  post.append(toggle, menu);
}

function addCommentDelete(comment) {
  if (comment.querySelector(".deleteCommentBtn")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "deleteCommentBtn";
  button.textContent = "Delete";
  button.style.marginLeft = "10px";
  button.addEventListener("click", () => {
    if (confirm("Delete this comment?")) comment.remove();
  });
  comment.appendChild(button);
}

function addReactionButton(post) {
  const like = post.querySelector(".likeBtn");
  if (!like || like.dataset.reactionsReady === "true") return;
  like.dataset.reactionsReady = "true";
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
      like.textContent = `${emoji} ${label}`;
      palette.hidden = true;
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
    if (!held) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    held = false;
  }, true);
}

document.querySelectorAll("#feed .post").forEach(post => { addReactionButton(post); addShareButton(post); addPostDeleteButton(post); });
new MutationObserver(records => {
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".post")) { addReactionButton(node); addShareButton(node); addPostDeleteButton(node); }
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".comment")) addCommentDelete(node);
      if (node.nodeType === Node.ELEMENT_NODE) node.querySelectorAll?.(".comment").forEach(addCommentDelete);
    });
  }
}).observe(document.getElementById("feed"), { childList: true, subtree: true });
