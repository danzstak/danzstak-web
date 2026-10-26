"use strict";
(() => {
  function select(posts, mode, email, ownProfile, now = new Date()) {
    const own = posts.filter(post => String(post.userEmail || post.authorEmail || "").toLowerCase() === String(email).toLowerCase());
    if (mode === "memories") return ownProfile ? own.filter(post => {
      const date = new Date(post.createdAt);
      return Number.isFinite(date.valueOf()) && date.getFullYear() < now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && post.isOwner === true;
    }) : [];
    if (mode === "featured") return own.filter(post => post.featured === true);
    return own;
  }
  if (typeof module !== "undefined") module.exports = {select};
  else window.danzstakProfileCollections = {select};
})();
