(function (global) {
  "use strict";

  const HOST = String.raw`(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})`;
  const IPV4 = String.raw`(?:\d{1,3}\.){3}\d{1,3}`;
  const CANDIDATE = new RegExp(String.raw`(?:https?:\/\/|www\.)?(?:${HOST}|${IPV4})(?::\d{1,5})?(?:[/?#][^\s<>"']*)?`, "giu");
  const SKIP_ANCESTORS = "a, button, input, textarea, script, style, code, pre";

  function trimTrailingPunctuation(value) {
    let visible = value;
    let trailing = "";
    while (/[.,!?;:]$/.test(visible)) {
      trailing = visible.slice(-1) + trailing;
      visible = visible.slice(0, -1);
    }
    for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
      const count = character => [...visible].filter(item => item === character).length;
      while (visible.endsWith(close) && count(close) > count(open)) {
        trailing = close + trailing;
        visible = visible.slice(0, -1);
      }
    }
    return { visible, trailing };
  }

  function normalizeUserUrl(value) {
    const text = String(value || "").trim();
    if (!text || text.includes("@")) return null;
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      if (!url.hostname.includes(".") && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) return null;
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) && url.hostname.split(".").some(part => Number(part) > 255)) return null;
      if (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function userLinkTokens(value) {
    const text = String(value ?? "");
    const tokens = [];
    let cursor = 0;
    CANDIDATE.lastIndex = 0;
    for (const match of text.matchAll(CANDIDATE)) {
      const before = match.index > 0 ? text[match.index - 1] : "";
      if (before === "@" || /[\p{L}\p{N}_-]/u.test(before)) continue;
      const { visible, trailing } = trimTrailingPunctuation(match[0]);
      const href = normalizeUserUrl(visible);
      if (!href) continue;
      if (match.index > cursor) tokens.push({ type: "text", text: text.slice(cursor, match.index) });
      tokens.push({ type: "link", text: visible, href });
      if (trailing) tokens.push({ type: "text", text: trailing });
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) tokens.push({ type: "text", text: text.slice(cursor) });
    return tokens.length ? tokens : [{ type: "text", text }];
  }

  function linkifyTextNode(node) {
    const tokens = userLinkTokens(node.nodeValue);
    if (!tokens.some(token => token.type === "link")) return;
    const fragment = document.createDocumentFragment();
    for (const token of tokens) {
      if (token.type === "text") {
        fragment.append(document.createTextNode(token.text));
        continue;
      }
      const link = document.createElement("a");
      link.className = "user-content-link";
      link.href = token.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer nofollow ugc";
      link.referrerPolicy = "strict-origin-when-cross-origin";
      link.textContent = token.text;
      fragment.append(link);
    }
    node.replaceWith(fragment);
  }

  function linkifyUserText(element) {
    if (element?.nodeType !== 1 || typeof document === "undefined") return element;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue?.includes(".")) continue;
      if (node.parentElement?.closest(SKIP_ANCESTORS)) continue;
      nodes.push(node);
    }
    nodes.forEach(linkifyTextNode);
    return element;
  }

  function renderUserText(element, value) {
    if (!element) return element;
    element.textContent = String(value ?? "");
    return linkifyUserText(element);
  }

  global.danzstakNormalizeUserUrl = normalizeUserUrl;
  global.danzstakUserLinkTokens = userLinkTokens;
  global.danzstakLinkifyUserText = linkifyUserText;
  global.danzstakRenderUserText = renderUserText;

  if (typeof module !== "undefined" && module.exports) module.exports = { normalizeUserUrl, userLinkTokens, trimTrailingPunctuation };
})(typeof window !== "undefined" ? window : globalThis);
