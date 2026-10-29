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

  function buildAccountArchive(sources, engagementByPost, messagesByContact, generatedAt = new Date().toISOString()) {
    const posts = Array.isArray(sources.posts?.posts) ? sources.posts.posts : [];
    const activity = ownedActivity(posts, engagementByPost);
    const stories = Array.isArray(sources.stories?.stories) ? sources.stories.stories.filter(item => item.isOwner === true) : [];
    const reels = Array.isArray(sources.stories?.reels) ? sources.stories.reels.filter(item => item.isOwner === true) : [];
    return {
      format: "DanzStak account export",
      formatVersion: 1,
      generatedAt,
      notice: "Media URLs in this JSON may expire. Keep original media files in your own backup.",
      notIncluded: ["Uploaded media binary files", "Support ticket correspondence"],
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
      incompleteSources: Array.isArray(sources.incompleteSources) ? sources.incompleteSources : []
    };
  }

  return { buildAccountArchive, ownedActivity };
});
