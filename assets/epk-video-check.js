"use strict";
// Owner 2026-11-23 (phone screenshots of an EPK's Watch section, YouTube's "Video unavailable" inside the player):
// "Before adding to the epk need to make sure the video is there and playable. Youtube is kinda tricky for videos with
// apps." Every YouTube or Vimeo link in "Live video links" is checked twice before it goes in the EPK:
//   1. DanzStak's server asks YouTube/Vimeo (oEmbed, /link-preview): removed or private, or embedding turned off;
//   2. this browser loads the real player out of sight and listens for its error (blocks oEmbed can't see: region,
//      age, a label's claim that stops it playing on other sites).
// A removed or private video is left out of the EPK. One that won't play inside other sites goes in as a link
// (embed:false), so a venue never sees a broken player. The public EPK listens for the same error and swaps the player
// for the link if YouTube changes its mind later.
(() => {
  const api = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const results = new Map(); // url → { state: "checking" | "ok" | "link" | "gone" | "unknown", title }
  const listeners = new Set();
  let box = null;

  function ids(url) {
    try {
      const u = new URL(url), host = u.hostname.replace(/^www\.|^m\./, "").toLowerCase();
      let youtube = "";
      if (host === "youtube.com" || host === "music.youtube.com") youtube = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/) || [])[1] || "";
      else if (host === "youtu.be") youtube = u.pathname.split("/").filter(Boolean)[0] || "";
      if (/^[\w-]{6,20}$/.test(youtube)) return { youtube };
      if (host === "vimeo.com") { const vimeo = u.pathname.split("/").filter(Boolean).find(part => /^\d+$/.test(part)); if (vimeo) return { vimeo }; }
    } catch { /* not a URL */ }
    return {};
  }
  // play: the visitor tapped the video's picture, so the player starts at once (autoplay only after that tap).
  function embedSource(url, { api: jsApi = false, play = false } = {}) {
    const { youtube, vimeo } = ids(url);
    if (youtube) {
      const query = [jsApi && `enablejsapi=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`, play && "autoplay=1"].filter(Boolean).join("&");
      return `https://www.youtube-nocookie.com/embed/${youtube}${query ? `?${query}` : ""}`;
    }
    if (vimeo) return `https://player.vimeo.com/video/${vimeo}${play ? "?autoplay=1" : ""}`;
    return "";
  }

  // The video's own picture (owner 2026-11-23, a screenshot of Watch cards that only said "Load YouTube player": "Links
  // from YouTube need the videos if video unavailable then dont put it in the epk"). YouTube keeps every video's picture
  // at i.ytimg.com and answers a removed, private or mistyped video with a 120x90 grey stand-in; Vimeo's oEmbed gives the
  // picture, or 404 for a removed or private video. → { state: "ok" | "gone" | "link" | "unknown", src }
  const posters = new Map();
  function poster(url) {
    if (posters.has(url)) return posters.get(url);
    const { youtube, vimeo } = ids(url);
    let job = Promise.resolve({ state: "skip", src: "" });
    if (youtube) job = new Promise(resolve => {
      const image = new Image(), src = `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`;
      const done = value => { clearTimeout(timer); image.onload = image.onerror = null; resolve(value); };
      const timer = setTimeout(() => done({ state: "unknown", src: "" }), 8000);
      image.onload = () => done(image.naturalWidth > 120 ? { state: "ok", src } : { state: "gone", src: "" });
      image.onerror = () => done({ state: "unknown", src: "" });
      image.referrerPolicy = "no-referrer";
      image.src = src;
    });
    else if (vimeo) job = fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeo}`)}&width=640`, { credentials: "omit", referrerPolicy: "no-referrer" })
      .then(async response => {
        if (response.status === 404) return { state: "gone", src: "" };
        if (response.status === 403) return { state: "link", src: "" }; // the owner keeps it off other sites
        if (!response.ok) return { state: "unknown", src: "" };
        const data = await response.json().catch(() => ({}));
        return { state: "ok", src: /^https:\/\/i\.vimeocdn\.com\/[^\s"'()\\]+$/.test(data.thumbnail_url || "") ? data.thumbnail_url : "" };
      })
      .catch(() => ({ state: "unknown", src: "" }));
    posters.set(url, job);
    return job;
  }

  const isYouTube = source => source.startsWith("https://www.youtube-nocookie.com/embed/");

  // The YouTube player reports errors over postMessage once a page says it is listening. Error codes: 2 bad id,
  // 5 HTML5 player error, 100 removed or private, 101/150 owner turned embedding off, 152/153 can't play on this site.
  function watchPlayer(frame, { onError, onReady } = {}) {
    const listen = () => { try { frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "danzstak-epk", channel: "widget" }), "https://www.youtube-nocookie.com"); } catch { /* gone */ } };
    const handler = event => {
      if (event.source !== frame.contentWindow || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;
      let data; try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.event === "onError") onError?.(Number(data.info));
      else if (data?.event === "onReady" || (data?.event === "infoDelivery" && data.info?.videoData?.video_id)) onReady?.();
    };
    window.addEventListener("message", handler);
    frame.addEventListener("load", () => { listen(); setTimeout(listen, 400); setTimeout(listen, 1500); });
    return () => window.removeEventListener("message", handler);
  }

  // A real player, out of sight: does this video play inside a page?
  function testInBrowser(source) {
    return new Promise(resolve => {
      const frame = document.createElement("iframe");
      frame.src = source; frame.title = ""; frame.tabIndex = -1; frame.setAttribute("aria-hidden", "true");
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.className = "epk-video-probe";
      let done = false, stop = () => {};
      const finish = value => { if (done) return; done = true; stop(); clearTimeout(timer); frame.remove(); resolve(value); };
      let ready = false;
      stop = watchPlayer(frame, { onError: code => finish({ error: code }), onReady: () => { ready = true; setTimeout(() => finish({ ok: true }), 1200); } });
      const timer = setTimeout(() => finish(ready ? { ok: true } : { unknown: true }), 9000);
      document.body.append(frame);
    });
  }

  async function check(url) {
    const source = embedSource(url, { api: true });
    if (!source) return { state: "skip" };
    const asked = fetch(`${api}/link-preview?url=${encodeURIComponent(url)}`, { credentials: "include", cache: "no-store" })
      .then(async response => response.ok ? (await response.json()).preview || null : null)
      .catch(() => null); // offline: the picture and the browser test still run
    const [server, picture] = await Promise.all([asked, poster(url)]);
    const title = server?.title || "";
    if (picture.state === "gone") return { state: "gone", title };
    if (picture.state === "link") return { state: "link", title };
    if (server?.playable === false) return { state: server.reason === "embed_off" ? "link" : "gone", title };
    if (!isYouTube(source)) return { state: server?.playable === true || picture.state === "ok" ? "ok" : "unknown", title };
    const probe = await testInBrowser(source);
    if (probe.error) return { state: [100, 2].includes(probe.error) ? "gone" : "link", title };
    if (probe.ok || server?.playable === true) return { state: "ok", title };
    return { state: "unknown", title };
  }

  const LINES = {
    checking: "Checking it plays…",
    ok: "Plays in your EPK",
    link: "Won't play inside other sites, so your EPK shows it as a link to the video.",
    gone: "Not added: this video is removed or private. Check the link.",
    unknown: "Couldn't check it right now. It shows as a player; if it won't play, venues get the link."
  };
  function paint() {
    if (!box) return;
    const items = [...results.entries()].filter(([, r]) => r.state !== "skip");
    box.hidden = !items.length;
    box.replaceChildren(...items.map(([url, r]) => {
      const row = document.createElement("li");
      row.className = "epk-video-check-row"; row.dataset.state = r.state; row.dataset.url = url;
      const name = document.createElement("strong"); name.textContent = r.label || r.title || url;
      const line = document.createElement("span"); line.textContent = t(LINES[r.state] || "");
      row.append(name, line);
      return row;
    }));
    listeners.forEach(fn => fn());
  }

  let timer = 0;
  function scan(links) {
    const wanted = new Set();
    for (const item of links) {
      if (!embedSource(item.url)) continue;
      wanted.add(item.url);
      const known = results.get(item.url);
      if (known) { known.label = item.label; continue; }
      const entry = { state: "checking", label: item.label };
      results.set(item.url, entry);
      check(item.url).then(result => { if (results.get(item.url) === entry) { Object.assign(entry, result); paint(); } });
    }
    for (const url of [...results.keys()]) if (!wanted.has(url)) results.delete(url);
    paint();
  }

  // Builder hooks (epk.js): which links go in the EPK, and how.
  function mark(item) {
    const state = results.get(item.url)?.state;
    if (state === "gone") return null;
    if (state === "link" || item.embed === false) return { ...item, embed: false };
    return item;
  }
  function seed(links = []) { for (const item of links) if (item?.embed === false && item.url && !results.has(item.url)) results.set(item.url, { state: "link", label: item.label }); }

  function start() {
    const area = document.getElementById("videoLinks");
    const query = new URLSearchParams(location.search);
    if (!area || ["id", "share", "outreach"].some(key => query.has(key))) return; // a venue's view: nothing to check
    box = document.createElement("ul");
    box.id = "videoLinkChecks"; box.className = "epk-video-checks"; box.hidden = true;
    box.setAttribute("aria-live", "polite");
    area.closest("label")?.after(box);
    const read = () => String(area.value || "").split(/\r?\n/).map(line => { const [label, ...rest] = line.split("|"); return { label: label.trim(), url: rest.join("|").trim() }; }).filter(item => /^https:\/\//i.test(item.url));
    area.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => scan(read()), 700); });
    area.addEventListener("change", () => { clearTimeout(timer); scan(read()); });
    // fill() sets the value without an input event: look once the saved EPK is in.
    let last = "";
    setInterval(() => { if (area.value !== last && document.activeElement !== area) { last = area.value; scan(read()); } }, 1500);
  }

  window.danzstakEpkVideoCheck = Object.freeze({ embedSource, poster, watchPlayer, mark, seed, scan, onChange: fn => listeners.add(fn), state: url => results.get(url)?.state || "" });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
