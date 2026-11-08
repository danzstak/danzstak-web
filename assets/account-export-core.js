(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.danzstakAccountExportCore = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function ownedActivity(posts, engagementByPost) {
    const comments = [], reactions = [];
    for (const post of Array.isArray(posts) ? posts : []) {
      const engagement = engagementByPost?.[post.postId] || {};
      if (engagement.myReaction) reactions.push({ postId: post.postId, reaction: engagement.myReaction });
      for (const comment of Array.isArray(engagement.comments) ? engagement.comments : []) {
        if (comment.isOwner === true) comments.push({ postId: post.postId, ...comment });
        if (comment.myReaction) reactions.push({ postId: post.postId, commentId: comment.commentId, reaction: comment.myReaction });
      }
    }
    return { comments, reactions };
  }

  async function collectAccountEngagement(posts, requestEngagement, options = {}) {
    const items = Array.isArray(posts) ? posts : [];
    const request = typeof requestEngagement === "function" ? requestEngagement : async () => ({});
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 3));
    const engagementByPost = {};
    const incompleteSources = [];
    let next = 0, completed = 0;

    async function worker() {
      while (next < items.length) {
        const post = items[next++];
        const postId = String(post?.postId || "").trim();
        if (postId) {
          try { engagementByPost[postId] = await request(postId); }
          catch { incompleteSources.push(`engagement:${postId}`); }
        }
        completed += 1;
        onProgress(completed, items.length);
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return { engagementByPost, incompleteSources };
  }

  function mediaManifest(source) {
    const files = Array.isArray(source?.files) ? source.files.map(file => ({
      archivePath: String(file.archivePath || ""),
      size: Math.max(0, Number(file.size || 0)),
      modifiedAt: String(file.modifiedAt || "")
    })).filter(file => /^media\/[a-z-]+\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]+$/i.test(file.archivePath)) : [];
    return { complete: source?.complete === true, totalBytes: files.reduce((total, file) => total + file.size, 0), files };
  }

  function buildAccountArchive(sources, engagementByPost, messagesByContact, generatedAt = new Date().toISOString()) {
    const posts = Array.isArray(sources.posts?.posts) ? sources.posts.posts : [];
    const activity = ownedActivity(posts, engagementByPost);
    const stories = Array.isArray(sources.stories?.stories) ? sources.stories.stories.filter(item => item.isOwner === true) : [];
    const reels = Array.isArray(sources.stories?.reels) ? sources.stories.reels.filter(item => item.isOwner === true) : [];
    return {
      format: "DanzStak account export",
      formatVersion: 2,
      generatedAt,
      notice: "When this JSON is inside a DanzStak ZIP archive, media files are stored under the media folder. Keep the ZIP in your own backup.",
      notIncluded: ["Support ticket correspondence"],
      account: sources.account || {},
      profile: sources.profile?.profile || {},
      settings: sources.settings || {},
      posts: posts.filter(post => post.isOwner === true),
      comments: activity.comments,
      reactions: activity.reactions,
      friends: sources.friends?.friends || [],
      groupMemberships: sources.groups?.groupIds || [],
      stories,
      reels,
      conversations: sources.conversations?.conversations || [],
      messagesByContact: messagesByContact || {},
      notifications: {
        social: sources.notifications?.notifications || [],
        engagement: sources.engagementNotifications?.notifications || []
      },
      tours: sources.tours?.tours || [],
      bookingWorkspace: sources.bookingWorkspace || { venues: [], artist: {} },
      media: mediaManifest(sources.mediaManifest),
      incompleteSources: Array.isArray(sources.incompleteSources) ? sources.incompleteSources : []
    };
  }

  return { buildAccountArchive, collectAccountEngagement, mediaManifest, ownedActivity };
});
