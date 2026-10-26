"use strict";

(function () {
  const api = "https://api.danzstak.com";

  async function request(path, signal, options = {}) {
    const response = await fetch(api + path, { credentials: "include", cache: "no-store", signal, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Export request failed for ${path}`);
    return data;
  }

  async function mapLimit(items, limit, worker) {
    let next = 0;
    const output = new Array(items.length);
    const run = async () => {
      while (next < items.length) {
        const index = next++;
        output[index] = await worker(items[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return output;
  }

  async function messageHistory(contactEmail, signal) {
    const messages = [];
    let before = "";
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ contact: contactEmail });
      if (before) query.set("before", before);
      const data = await request("/messages?" + query, signal);
      messages.push(...(data.messages || []));
      if (!data.nextCursor || data.nextCursor === before) break;
      before = data.nextCursor;
    }
    return messages;
  }

  async function downloadAccountData(onStatus) {
    const status = typeof onStatus === "function" ? onStatus : () => {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    status("Collecting your DanzStak data…");
    try {
      const endpoints = {
        account: "/auth/me",
        profile: "/profiles",
        settings: "/settings/presence",
        posts: "/secure-posts",
        friends: "/friends",
        groups: "/groups/membership",
        stories: "/stories",
        conversations: "/conversations",
        notifications: "/notifications",
        engagementNotifications: "/engagement-notifications",
        tours: "/tours"
      };
      const names = Object.keys(endpoints);
      const results = await Promise.allSettled(names.map(name => request(endpoints[name], controller.signal, name === "groups" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) } : {})));
      const sources = { incompleteSources: [] };
      results.forEach((result, index) => {
        const name = names[index];
        if (result.status === "fulfilled") sources[name] = result.value;
        else sources.incompleteSources.push(name);
      });
      if (!sources.account && !sources.profile) throw new Error("Your account could not be verified for export.");

      status("Collecting your posts, comments, reactions, and messages…");
      const posts = Array.isArray(sources.posts?.posts) ? sources.posts.posts.slice(0, 200) : [];
      const engagementByPost = {};
      await mapLimit(posts, 3, async post => {
        try { engagementByPost[post.postId] = await request("/engagement?postId=" + encodeURIComponent(post.postId), controller.signal); }
        catch { sources.incompleteSources.push("engagement:" + post.postId); }
      });
      const conversations = Array.isArray(sources.conversations?.conversations) ? sources.conversations.conversations : [];
      const messagesByContact = {};
      await mapLimit(conversations, 2, async conversation => {
        const contact = String(conversation.contactEmail || "").toLowerCase();
        if (!contact) return;
        try { messagesByContact[contact] = await messageHistory(contact, controller.signal); }
        catch { sources.incompleteSources.push("messages:" + contact); }
      });

      const archive = window.danzstakAccountExportCore.buildAccountArchive(sources, engagementByPost, messagesByContact);
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `danzstak-account-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const incomplete = archive.incompleteSources.length;
      status(incomplete ? `Your JSON download is ready. ${incomplete} data source${incomplete === 1 ? " was" : "s were"} unavailable and listed inside the file.` : "Your DanzStak JSON download is ready.");
      return archive;
    } catch (error) {
      const message = error.name === "AbortError" ? "The export took too long. Please try again." : error.message;
      status(message);
      throw new Error(message);
    } finally { clearTimeout(timeout); }
  }

  window.danzstakDownloadAccountData = downloadAccountData;
})();
