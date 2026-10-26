(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.danzstakActivityCore = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function safeDate(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  function buildActivity(posts, engagementByPost, limit = 100) {
    const activity = [];
    for (const post of Array.isArray(posts) ? posts : []) {
      if (!post?.postId) continue;
      if (post.isOwner === true) {
        activity.push({
          type: "post",
          id: String(post.postId),
          postId: String(post.postId),
          text: String(post.content || "Post without text"),
          audience: String(post.audience || "public"),
          createdAt: String(post.createdAt || "")
        });
      }
      const engagement = engagementByPost?.[post.postId];
      for (const comment of Array.isArray(engagement?.comments) ? engagement.comments : []) {
        if (comment?.isOwner !== true || !comment.commentId) continue;
        activity.push({
          type: "comment",
          id: String(comment.commentId),
          postId: String(post.postId),
          text: String(comment.content || "Comment without text"),
          createdAt: String(comment.createdAt || "")
        });
      }
    }
    return activity
      .filter(item => safeDate(item.createdAt))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Math.max(1, Number(limit) || 100));
  }

  return { buildActivity };
});
