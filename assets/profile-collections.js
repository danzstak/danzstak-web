"use strict";
(() => {
  function select(posts, mode, email, ownProfile, now = new Date(), memberId = "") {
    const normalizedEmail = String(email).toLowerCase();
    const authored = posts.filter(post => String(post.userEmail || post.authorEmail || "").toLowerCase() === normalizedEmail && !post.profileOwnerMemberId);
    const own = posts.filter(post => {
      const authorMatches = String(post.userEmail || post.authorEmail || "").toLowerCase() === normalizedEmail;
      const wallMatches = memberId && String(post.profileOwnerMemberId || "") === String(memberId);
      return wallMatches || (authorMatches && !post.profileOwnerMemberId);
    });
    if (mode === "memories") return ownProfile ? authored.filter(post => {
      const date = new Date(post.createdAt);
      return Number.isFinite(date.valueOf()) && date.getFullYear() < now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && post.isOwner === true;
    }) : [];
    if (mode === "featured") return authored.filter(post => post.featured === true);
    return own;
  }
  if (typeof module !== "undefined") module.exports = {select};
  else window.danzstakProfileCollections = {select};
})();
