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
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
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
        tours: "/tours",
        bookingWorkspace: "/booking-pipeline",
        mediaManifest: "/account-export/media"
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
      const posts = Array.isArray(sources.posts?.posts) ? sources.posts.posts : [];
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
      const media = Array.isArray(sources.mediaManifest?.files) ? sources.mediaManifest.files : [];
      const maximumArchiveBytes = 300 * 1024 * 1024;
      const canPackageMedia = Boolean(window.fflate?.zipSync) && sources.mediaManifest?.complete === true && archive.media.totalBytes <= maximumArchiveBytes;
      const zipFiles = {};
      const mediaFailures = [];
      if (canPackageMedia && media.length) {
        status(`Downloading ${media.length} media file${media.length === 1 ? "" : "s"}…`);
        const downloaded = await mapLimit(media, 3, async (file, index) => {
          const archivePath = String(file.archivePath || "");
          if (!/^media\/[a-z-]+\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]+$/i.test(archivePath) || !/^https:\/\//.test(String(file.downloadUrl || ""))) return { error: archivePath || `media-${index + 1}` };
          try {
            const response = await fetch(file.downloadUrl, { signal: controller.signal, cache: "no-store", credentials: "omit" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (Number(file.size) >= 0 && bytes.byteLength !== Number(file.size)) throw new Error("size mismatch");
            return { archivePath, bytes };
          } catch { return { error: archivePath }; }
        });
        for (const item of downloaded) {
          if (item.error) mediaFailures.push(item.error);
          else zipFiles[item.archivePath] = [item.bytes, { level: 0 }];
        }
      }
      archive.mediaArchive = {
        packaged: canPackageMedia,
        downloadedFiles: Object.keys(zipFiles).length,
        failedFiles: mediaFailures,
        reason: canPackageMedia ? (mediaFailures.length ? "Some media downloads failed and are listed here." : "") : !window.fflate?.zipSync ? "ZIP support was unavailable in this browser." : sources.mediaManifest?.complete !== true ? "The server media manifest was incomplete." : "Media exceeds the 300 MB in-browser packaging limit."
      };
      if (!canPackageMedia || mediaFailures.length) archive.notIncluded.push("Uploaded media binary files listed by mediaArchive");
      const json = JSON.stringify(archive, null, 2);
      let blob, extension;
      if (canPackageMedia) {
        zipFiles["account-data.json"] = [new TextEncoder().encode(json), { level: 6 }];
        blob = new Blob([window.fflate.zipSync(zipFiles)], { type: "application/zip" });
        extension = "zip";
      } else {
        blob = new Blob([json], { type: "application/json" });
        extension = "json";
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `danzstak-account-${date}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const incomplete = archive.incompleteSources.length;
      const mediaNotice = archive.mediaArchive.reason ? ` ${archive.mediaArchive.reason}` : "";
      status(incomplete ? `Your ${extension.toUpperCase()} download is ready. ${incomplete} data source${incomplete === 1 ? " was" : "s were"} unavailable and listed inside the file.${mediaNotice}` : `Your DanzStak ${extension.toUpperCase()} download is ready.${mediaNotice}`);
      return archive;
    } catch (error) {
      const message = error.name === "AbortError" ? "The export took too long. Please try again." : error.message;
      status(message);
      throw new Error(message);
    } finally { clearTimeout(timeout); }
  }

  window.danzstakDownloadAccountData = downloadAccountData;
})();
