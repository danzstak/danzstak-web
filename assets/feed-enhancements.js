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
    createButton.textContent = "Create Group";
    const standardsLabel = document.createElement("label");
    standardsLabel.className = "group-standards-agreement";
    const standardsCheckbox = document.createElement("input");
    standardsCheckbox.type = "checkbox";
    standardsLabel.append(standardsCheckbox, document.createTextNode("I agree to enforce DANZSTAK Community Standards: no hate speech, harassment, threats, or targeted abuse."));
    const standardsError = document.createElement("p");
    standardsError.className = "group-standards-error";
    standardsError.textContent = "You must agree to the Community Standards before creating a group.";
    standardsError.hidden = true;
    standardsCheckbox.addEventListener("change", () => { standardsError.hidden = standardsCheckbox.checked; });
    createBox.append(groupName.wrap, categoryLabel, standardsLabel, standardsError, createButton);
    const grid = document.createElement("div");
    grid.className = "groups-grid";

    function renderGroups() {
      grid.replaceChildren();
      const defaults = categories.map((category, index) => ({ id: `default-${index}`, name: category, category, description: `Connect in ${category.toLowerCase()}.`, custom: false }));
      const groups = [...(saved.CustomGroups || []), ...defaults];
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
        join.addEventListener("click", () => {
          saved.GroupsJoined = saved.GroupsJoined || {};
          saved.GroupsJoined[group.id] = !saved.GroupsJoined[group.id];
          writeSections(saved);
          join.textContent = saved.GroupsJoined[group.id] ? "Joined" : "Join Group";
          join.classList.toggle("is-selected", saved.GroupsJoined[group.id]);
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
        report.addEventListener("click", () => {
          const details = prompt("What should the moderators review?");
          if (!details?.trim()) return;
          saved.GroupReports = [...(saved.GroupReports || []), { groupId: group.id, details: details.trim(), reportedAt: new Date().toISOString() }];
          writeSections(saved);
          report.textContent = "Report sent";
          report.disabled = true;
        });
        moderation.append(moderationTitle, moderationText, report);
        card.appendChild(moderation);
        card.appendChild(join);
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
      if (!standardsCheckbox.checked) {
        standardsError.hidden = false;
        standardsCheckbox.focus();
        return;
      }
      saved.CustomGroups = [...(saved.CustomGroups || []), { id: crypto.randomUUID(), name: value, category: categorySelect.value, description: "A new DANZSTAK community group.", custom: true }];
      writeSections(saved);
      groupName.input.value = "";
      standardsCheckbox.checked = false;
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
  groupsLink.textContent = "\uD83D\uDC65 Groups";
  groupsLink.setAttribute("aria-label", "Groups");
  groupsLink.addEventListener("click", event => {
    event.preventDefault();
    history.replaceState(null, "", "#groups");
    document.getElementById("newsFeedView").hidden = true;
    featurePanel.hidden = false;
    featureHeading.textContent = "Groups";
    renderWorkspace("Groups");
  });
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
            if (!response.ok) throw new Error();
          } catch {
            alert("The edited post could not be saved. Please try again.");
            save.disabled = false;
            return;
          }
        }
        history.push(body.textContent.trim());
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
      return;
    }
    held = false;
  }, true);
}

const reelsStorageKey = "danzstak_external_reels";
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

function getReels() {
  try { return JSON.parse(localStorage.getItem(reelsStorageKey) || "[]"); }
  catch { return []; }
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

function renderReels() {
  reelsList.replaceChildren();
  const reels = getReels();
  if (!reels.length) {
    const empty = document.createElement("p");
    empty.className = "muted reels-empty";
    empty.textContent = "External reels shared by the community will appear here.";
    reelsList.appendChild(empty);
    return;
  }
  for (const reel of reels) {
    const card = document.createElement("article");
    card.className = "reel-card";
    const platform = document.createElement("strong");
    platform.textContent = reel.platform;
    const open = document.createElement("a");
    open.href = reel.url;
    open.target = "_blank";
    open.rel = "noopener noreferrer nofollow";
    open.textContent = "▶ Open Reel";
    const source = document.createElement("small");
    source.textContent = new URL(reel.url).hostname;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reel-delete";
    remove.textContent = "Delete Reel";
    remove.addEventListener("click", () => {
      const updated = getReels().filter(item => item.id !== reel.id);
      localStorage.setItem(reelsStorageKey, JSON.stringify(updated));
      renderReels();
    });
    card.append(platform, open, source, remove);
    reelsList.appendChild(card);
  }
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
  reelsList.replaceChildren();
  const reels = getReels();
  if (!reels.length) {
    const empty = document.createElement("p");
    empty.className = "muted reels-empty";
    empty.textContent = "External reels shared by the community will appear here.";
    reelsList.appendChild(empty);
    return;
  }
  for (const reel of reels) {
    const reelUrlValue = new URL(reel.url);
    const card = document.createElement("article");
    card.className = "reel-card";
    const playerInfo = reelPlayer(reelUrlValue);
    if (playerInfo?.kind === "video") {
      const video = document.createElement("video");
      video.className = "reel-player";
      video.src = playerInfo.src;
      video.controls = true;
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.preload = "metadata";
      card.appendChild(video);
    } else if (playerInfo?.kind === "iframe") {
      const frame = document.createElement("iframe");
      frame.className = "reel-player";
      frame.src = playerInfo.src;
      frame.title = reel.platform + " reel player";
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      frame.setAttribute("allowfullscreen", "");
      card.appendChild(frame);
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
    const open = document.createElement("a");
    open.href = reel.url;
    open.target = "_blank";
    open.rel = "noopener noreferrer nofollow";
    open.textContent = playerInfo ? "Open on source" : "Play on source";
    const source = document.createElement("small");
    source.textContent = reelUrlValue.hostname;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reel-delete";
    remove.textContent = "Delete Reel";
    remove.addEventListener("click", () => {
      localStorage.setItem(reelsStorageKey, JSON.stringify(getReels().filter(item => item.id !== reel.id)));
      renderPlayableReels();
    });
    details.append(platform, open, source, remove);
    card.appendChild(details);
    reelsList.appendChild(card);
  }
}

function placeReelsRail() {
  const feedElement = document.getElementById("feed");
  const posts = [...feedElement.children].filter(child => child.classList.contains("post") && child !== reelsRail);
  if (posts.length >= 3) posts[2].insertAdjacentElement("afterend", reelsRail);
  else feedElement.appendChild(reelsRail);
}

addReel.addEventListener("click", () => {
  let parsed;
  try { parsed = new URL(reelUrl.value.trim()); }
  catch { reelStatus.textContent = "Enter a valid video link."; reelUrl.focus(); return; }
  if (!isApprovedVideoUrl(parsed)) { reelStatus.textContent = "Use a recognized video platform or a direct HTTPS video-file link."; reelUrl.focus(); return; }
  if (!reelPlayer(parsed)) { reelStatus.textContent = "This link cannot autoplay inside DANZSTAK. Use a supported public video or direct HTTPS video-file link."; reelUrl.focus(); return; }
  if (!reelPermissionCheck.checked) { reelStatus.textContent = "Confirm ownership or permission before sharing."; reelPermissionCheck.focus(); return; }
  const reels = getReels();
  reels.unshift({ id: crypto.randomUUID(), url: parsed.href, platform: reelPlatform(parsed.hostname), sharedAt: new Date().toISOString() });
  localStorage.setItem(reelsStorageKey, JSON.stringify(reels.slice(0, 20)));
  reelUrl.value = "";
  reelPermissionCheck.checked = false;
  reelStatus.textContent = "External reel added.";
  renderPlayableReels();
});

renderPlayableReels();
placeReelsRail();
document.querySelectorAll("#feed .post").forEach(post => { if (post !== reelsRail) { addReactionButton(post); addShareButton(post); addPostDeleteButton(post); } });
new MutationObserver(records => {
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".post") && node !== reelsRail) { addReactionButton(node); addShareButton(node); addPostDeleteButton(node); placeReelsRail(); }
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(".comment")) addCommentDelete(node);
      if (node.nodeType === Node.ELEMENT_NODE) node.querySelectorAll?.(".comment").forEach(addCommentDelete);
    });
  }
}).observe(document.getElementById("feed"), { childList: true, subtree: true });
