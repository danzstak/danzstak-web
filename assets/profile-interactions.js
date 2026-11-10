"use strict";

(() => {
  const API = "https://api.danzstak.com";
  let viewerProfilePromise;

  async function request(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(API + path, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("DanzStak is taking too long to update this post. Try again.");
      throw new Error("DanzStak cannot update this post right now. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
  }

  function viewerProfile() {
    if (!viewerProfilePromise) {
      viewerProfilePromise = request("/profiles", { credentials: "include", cache: "no-store" })
        .then(async response => response.ok ? (await response.json()).profile || {} : {})
        .catch(() => ({}));
    }
    return viewerProfilePromise;
  }

  function relativeTime(value) {
    const time = new Date(value || "");
    if (Number.isNaN(time.valueOf())) return "Now";
    const seconds = Math.max(0, Math.floor((Date.now() - time.valueOf()) / 1000));
    if (seconds < 60) return "Now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return time.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function avatar(person = {}, size = "standard") {
    const memberId = String(person.authorMemberId || person.memberId || "");
    const name = String(person.authorName || person.name || "DanzStak member");
    const picture = String(person.authorPicture || person.picture || "");
    const node = document.createElement(memberId ? "a" : "span");
    node.className = `profile-comment-avatar profile-comment-avatar-${size}`;
    if (memberId) {
      node.href = `profile.html?member=${encodeURIComponent(memberId)}`;
      node.setAttribute("aria-label", `Open ${name} profile`);
    } else node.setAttribute("aria-hidden", "true");
    if (picture) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = picture;
      image.referrerPolicy = "no-referrer";
      window.danzstakIdentityMedia?.install(image, { memberId, name, picture });
      node.appendChild(image);
    } else node.textContent = name.trim().charAt(0).toUpperCase() || "D";
    return node;
  }

  function reactionTotal(counts = {}) {
    return Object.values(counts).reduce((total, value) => total + (Number(value) || 0), 0);
  }

  function feedback(message, urgent = false) {
    if (typeof window.danzstakShowFeedback === "function") window.danzstakShowFeedback(message, { urgent });
    else window.alert(message);
  }

  function commentRow(article, comment, comments) {
    const reply = Boolean(comment.parentCommentId);
    const row = document.createElement("article");
    row.className = reply ? "profile-comment profile-comment-reply" : "profile-comment";
    row.dataset.commentId = comment.commentId || "";
    row.appendChild(avatar(comment, reply ? "reply" : "standard"));

    const content = document.createElement("div");
    content.className = "profile-comment-content-wrap";
    const bubble = document.createElement("div");
    bubble.className = "profile-comment-bubble";
    const author = document.createElement(comment.authorMemberId ? "a" : "strong");
    author.className = "profile-comment-author";
    if (comment.authorMemberId) author.href = `profile.html?member=${encodeURIComponent(comment.authorMemberId)}`;
    author.textContent = comment.authorName || "DanzStak member";
    const body = document.createElement("p");
    body.textContent = comment.content || "";
    bubble.append(author, body);

    const actions = document.createElement("div");
    actions.className = "profile-comment-actions";
    const time = document.createElement("time");
    time.dateTime = comment.createdAt || "";
    time.textContent = relativeTime(comment.createdAt);
    const like = document.createElement("button");
    like.type = "button";
    like.textContent = comment.myReaction === "Like" ? "Liked" : "Like";
    like.classList.toggle("is-active", comment.myReaction === "Like");
    like.addEventListener("click", async () => {
      like.disabled = true;
      try {
        const response = await request("/reactions", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: article.dataset.postId, commentId: comment.commentId, reaction: comment.myReaction === "Like" ? "" : "Like" })
        });
        if (!response.ok) throw new Error("Comment reaction could not be saved.");
        await load(article, { force: true, revealComments: true });
      } catch (error) { feedback(error.message, true); }
      finally { like.disabled = false; }
    });
    const respond = document.createElement("button");
    respond.type = "button";
    respond.textContent = "Reply";
    respond.addEventListener("click", () => {
      const input = article.querySelector(".profile-comment-input");
      const context = article.querySelector(".profile-comment-replying");
      input.dataset.parentCommentId = comment.commentId;
      context.textContent = `Replying to ${comment.authorName || "this member"}`;
      context.hidden = false;
      input.focus();
    });
    actions.append(time, like, respond);

    const count = reactionTotal(comment.reactionCounts);
    if (count) {
      const reactions = document.createElement("span");
      reactions.className = "profile-comment-reaction-count";
      reactions.textContent = `👍 ${count}`;
      actions.appendChild(reactions);
    }
    if (comment.canDelete === true) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "profile-comment-delete";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", "Delete comment");
      remove.addEventListener("click", async () => {
        const confirmed = typeof window.danzstakConfirm === "function"
          ? await window.danzstakConfirm("This comment will be permanently removed.", { title: "Delete this comment?", confirmLabel: "Delete comment", danger: true })
          : window.confirm("Delete this comment?");
        if (!confirmed) return;
        remove.disabled = true;
        try {
          const response = await request(`/comments/${encodeURIComponent(comment.commentId)}?postId=${encodeURIComponent(article.dataset.postId)}`, { method: "DELETE", credentials: "include" });
          if (!response.ok) throw new Error("Comment could not be deleted.");
          await load(article, { force: true, revealComments: true });
        } catch (error) { feedback(error.message, true); remove.disabled = false; }
      });
      actions.appendChild(remove);
    }
    content.append(bubble, actions);
    row.appendChild(content);
    comments.appendChild(row);
  }

  async function postComment(article) {
    const input = article.querySelector(".profile-comment-input");
    const send = article.querySelector(".profile-comment-send");
    const content = input.value.trim();
    if (!content) return input.focus();
    input.disabled = true;
    send.disabled = true;
    try {
      const parentCommentId = String(input.dataset.parentCommentId || "");
      const response = await request("/comments", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: article.dataset.postId, content, ...(parentCommentId ? { parentCommentId } : {}) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Comment could not be posted.");
      input.value = "";
      input.dataset.parentCommentId = "";
      article.querySelector(".profile-comment-replying").hidden = true;
      await load(article, { force: true, revealComments: true });
    } catch (error) { feedback(error.message, true); }
    finally { input.disabled = false; send.disabled = false; input.focus(); }
  }

  function installComposer(article, section) {
    const replying = document.createElement("p");
    replying.className = "profile-comment-replying";
    replying.hidden = true;
    const composer = document.createElement("div");
    composer.className = "profile-comment-composer";
    const placeholder = document.createElement("span");
    placeholder.className = "profile-comment-viewer-avatar";
    placeholder.textContent = "D";
    placeholder.setAttribute("aria-hidden", "true");
    viewerProfile().then(profile => {
      if (!placeholder.isConnected) return;
      const picture = String(profile.picture || "");
      if (!picture) { placeholder.textContent = String(profile.name || "D").charAt(0).toUpperCase(); return; }
      const image = document.createElement("img");
      image.className = placeholder.className;
      image.alt = "";
      image.src = picture;
      image.referrerPolicy = "no-referrer";
      window.danzstakIdentityMedia?.install(image, profile);
      placeholder.replaceWith(image);
    });
    const input = document.createElement("input");
    input.className = "profile-comment-input";
    input.maxLength = 1000;
    input.placeholder = "Write a comment…";
    input.setAttribute("aria-label", "Write a comment");
    const send = document.createElement("button");
    send.type = "button";
    send.className = "profile-comment-send";
    send.textContent = "Send";
    send.addEventListener("click", () => void postComment(article));
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void postComment(article); }
      if (event.key === "Escape" && input.dataset.parentCommentId) {
        input.dataset.parentCommentId = "";
        replying.hidden = true;
      }
    });
    composer.append(placeholder, input, send);
    section.append(replying, composer);
  }

  function install(article, post = {}) {
    const postId = String(article.dataset.postId || post.postId || "");
    if (!/^[a-f0-9-]{36}$/i.test(postId) || article.querySelector(".profile-post-engagement")) return;
    article.dataset.postId = postId;
    article.dataset.audience = post.audience || article.dataset.audience || "public";

    const section = document.createElement("section");
    section.className = "profile-post-engagement";
    section.setAttribute("aria-label", "Post interactions");
    const counters = document.createElement("div");
    counters.className = "profile-post-counters";
    const reactionCount = document.createElement("span");
    reactionCount.className = "profile-post-reaction-count";
    reactionCount.textContent = "";
    const commentCount = document.createElement("button");
    commentCount.type = "button";
    commentCount.className = "profile-post-comment-count";
    commentCount.textContent = "0 comments";
    counters.append(reactionCount, commentCount);

    const actions = document.createElement("div");
    actions.className = "profile-post-actions";
    const like = document.createElement("button");
    like.type = "button";
    like.className = "profile-post-like";
    like.textContent = "Like";
    const comment = document.createElement("button");
    comment.type = "button";
    comment.className = "profile-post-comment";
    comment.textContent = "Comment";
    const share = document.createElement("button");
    share.type = "button";
    share.className = "profile-post-share";
    share.dataset.iconLayout = "label";
    share.textContent = "Share";
    share.hidden = article.dataset.audience !== "public";
    actions.append(like, comment, share);

    const comments = document.createElement("div");
    comments.className = "profile-comments";
    comments.hidden = true;
    const list = document.createElement("div");
    list.className = "profile-comment-list";
    comments.appendChild(list);
    installComposer(article, comments);
    section.append(counters, actions, comments);
    const tools = article.querySelector(".profile-post-tools");
    if (tools) tools.before(section); else article.appendChild(section);

    const reveal = () => { comments.hidden = false; void load(article, { revealComments: true }); };
    comment.addEventListener("click", () => { reveal(); requestAnimationFrame(() => comments.querySelector("input")?.focus()); });
    commentCount.addEventListener("click", reveal);
    share.addEventListener("click", () => window.danzstakSharePost?.(article));
    like.addEventListener("click", async () => {
      like.disabled = true;
      const current = article.dataset.myReaction || "";
      try {
        const response = await request("/reactions", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, reaction: current === "Like" ? "" : "Like" })
        });
        if (!response.ok) throw new Error("Reaction could not be saved.");
        await load(article, { force: true, revealComments: !comments.hidden });
      } catch (error) { feedback(error.message, true); }
      finally { like.disabled = false; }
    });
    void load(article);
  }

  async function load(article, { force = false, revealComments = false } = {}) {
    if (!force && article.dataset.profileEngagementLoaded === "true") return;
    if (article.dataset.profileEngagementLoading === "true") return;
    article.dataset.profileEngagementLoading = "true";
    try {
      const response = await request(`/engagement?postId=${encodeURIComponent(article.dataset.postId)}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Post interactions could not be loaded.");
      const data = await response.json();
      const total = reactionTotal(data.reactionCounts);
      const reactionCount = article.querySelector(".profile-post-reaction-count");
      reactionCount.textContent = total ? `👍 ${total}` : "";
      reactionCount.hidden = !total;
      const count = Array.isArray(data.comments) ? data.comments.length : 0;
      article.querySelector(".profile-post-comment-count").textContent = `${count} comment${count === 1 ? "" : "s"}`;
      article.dataset.myReaction = data.myReaction || "";
      const like = article.querySelector(".profile-post-like");
      like.textContent = data.myReaction === "Like" ? "Liked" : "Like";
      like.classList.toggle("is-active", data.myReaction === "Like");
      const list = article.querySelector(".profile-comment-list");
      list.replaceChildren();
      for (const item of data.comments || []) commentRow(article, item, list);
      const comments = article.querySelector(".profile-comments");
      if (revealComments || count) comments.hidden = false;
      article.dataset.profileEngagementLoaded = "true";
    } catch (error) {
      if (revealComments) feedback(error.message, true);
    } finally {
      article.dataset.profileEngagementLoading = "";
    }
  }

  window.danzstakEnhanceProfilePost = install;
})();
