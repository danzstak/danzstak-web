"use strict";

if (new URLSearchParams(location.search).get("embedded") === "1") {
  document.body.classList.add("embedded-messages");
}

const returnControl = document.querySelector("[data-chat-return]");
const requestedReturn = new URLSearchParams(location.search).get("return") || "";
if (returnControl && requestedReturn.startsWith("/") && !requestedReturn.startsWith("//")) {
  try {
    const safeReturn = new URL(requestedReturn, location.origin);
    if (safeReturn.origin === location.origin) returnControl.href = safeReturn.pathname + safeReturn.search + safeReturn.hash;
  } catch {}
}

const directApi = "https://api.danzstak.com";
const contactInput = document.getElementById("contactEmail");
const onlineUsers = document.getElementById("onlineUsers");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messageMedia = document.getElementById("messageMedia");
const messageCamera = document.getElementById("messageCamera");
const messageMediaPreview = document.getElementById("messageMediaPreview");
const messageList = document.getElementById("messageList");
const sendButton = messageForm?.querySelector('button[type="submit"]');
const textButton = document.getElementById("startText");
const conversationActions = [textButton, document.getElementById("startPhone"), document.getElementById("startVideo")].filter(Boolean);
const callStatus = document.getElementById("callStatus");
const messageTranslate = value => window.danzstakTranslate?.(value) || value;
const messageFormat = (key, values = {}) => Object.entries(values).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
  messageTranslate(key)
);

function createCallActionIcon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "call-action-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  if (kind === "phone") {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", "M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.5-.36c1.1.36 2.28.56 3.5.56a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1-1.5 1.5A18.3 18.3 0 0 1 2.1 3.6a1.5 1.5 0 0 1 1.5-1.5h3.5a1.5 1.5 0 0 1 1.5 1.5c0 1.23.2 2.4.56 3.5.17.54.04 1.13-.36 1.53z");
    svg.appendChild(path);
  } else {
    const body = document.createElementNS(svg.namespaceURI, "rect");
    body.setAttribute("x", "2.5"); body.setAttribute("y", "5"); body.setAttribute("width", "13"); body.setAttribute("height", "14"); body.setAttribute("rx", "2.5");
    const lens = document.createElementNS(svg.namespaceURI, "path");
    lens.setAttribute("d", "m15.5 10 5-3v10l-5-3z");
    svg.append(body, lens);
  }
  return svg;
}
const conversationUsers = document.getElementById("conversationUsers");
const chatContacts = document.getElementById("chatContacts");
const deleteChat = document.getElementById("deleteChat");
const chatSearch = document.getElementById("chatSearch");
const conversationHeader = document.getElementById("conversationHeader");
const conversationPresence = document.getElementById("conversationPresence");
const conversationName = document.getElementById("conversationName");
const conversationAvatar = document.getElementById("conversationAvatar");
const conversationHeaderActions = {
  phone: document.getElementById("headerPhone"),
  video: document.getElementById("headerVideo"),
  minimize: document.getElementById("minimizeConversation"),
  more: document.getElementById("conversationMore"),
  close: document.getElementById("closeConversation")
};
if (conversationHeader && conversationAvatar && conversationHeaderActions.close) {
  conversationHeaderActions.close.classList.add("conversation-back");
  conversationHeaderActions.close.dataset.icon = "back";
  conversationHeaderActions.close.title = messageTranslate("Back to chats");
  conversationHeaderActions.close.setAttribute("aria-label", messageTranslate("Back to chats"));
  window.danzstakIcons?.upgrade(conversationHeaderActions.close);
  conversationHeader.insertBefore(conversationHeaderActions.close, conversationAvatar);
}
const conversationMenu = document.getElementById("conversationMenu");
const headerMakePlansMenu = document.getElementById("headerMakePlansMenu");
const headerDeleteChat = document.getElementById("headerDeleteChat");
let directContact = "";
let activeContactName = messageTranslate("Contact");
let currentEmail = "";
let loadingMessages = false;
let conversationVersion = 0;
const pendingMessageSends = new Set();
let retryMessageSend = null;
let nextMessageCursor = "";
const shownMessages = new Set();
let cachedConversations = [];
let activeCanContact = false;
let reactionTimer = null;
let selectedMessageMedia = null;
let selectedMessageMediaUrl = "";
let mobileHistoryConversation = null;

function usesMobileConversationHistory() {
  return window.parent === window && window.matchMedia?.("(max-width: 760px)").matches === true;
}

function rememberMobileConversation(conversation) {
  if (!usesMobileConversationHistory()) return;
  mobileHistoryConversation = { ...conversation };
  if (history.state?.danzstakChatOpen === true) return;
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  history.pushState({ ...currentState, danzstakChatOpen: true }, "");
}

function closeConversationFromControl() {
  if (usesMobileConversationHistory() && history.state?.danzstakChatOpen === true) {
    history.back();
    return;
  }
  closeConversation({ focusList: true });
}
function setConversationActionsEnabled(enabled) {
  for (const button of conversationActions) button.disabled = !enabled;
  for (const button of [conversationHeaderActions.phone, conversationHeaderActions.video]) {
    if (!button) continue;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  }
  if (messageMedia) messageMedia.disabled = !enabled;
  if (messageCamera) messageCamera.disabled = !enabled;
}

function clearSelectedMessageMedia() {
  selectedMessageMedia = null;
  if (messageMedia) messageMedia.value = "";
  if (messageCamera) messageCamera.value = "";
  if (selectedMessageMediaUrl) URL.revokeObjectURL(selectedMessageMediaUrl);
  selectedMessageMediaUrl = "";
  if (messageMediaPreview) { messageMediaPreview.replaceChildren(); messageMediaPreview.hidden = true; }
}

function previewSelectedMessageMedia(file) {
  clearSelectedMessageMedia();
  if (!file) return;
  const allowed = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/i;
  if (!allowed.test(file.type)) { callStatus.textContent = messageTranslate("Choose a photo or video. Standalone audio files are not supported."); return; }
  selectedMessageMedia = file;
  selectedMessageMediaUrl = URL.createObjectURL(file);
  const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
  media.src = selectedMessageMediaUrl;
  media.alt = file.type.startsWith("image/") ? messageTranslate("Photo ready to send") : "";
  if (media.tagName === "VIDEO") { media.controls = true; media.preload = "metadata"; media.setAttribute("aria-label", messageTranslate("Video ready to send")); }
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "message-media-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", messageTranslate("Remove attachment")); remove.addEventListener("click", clearSelectedMessageMedia);
  messageMediaPreview.append(media, remove); messageMediaPreview.hidden = false;
}

async function uploadSelectedMessageMedia(file) {
  const ticketResponse = await directFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, purpose: "message" }) });
  const ticket = await ticketResponse.json().catch(() => ({}));
  if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || messageTranslate("Attachment upload could not start"));
  try {
    const upload = await directFetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, Math.max(30000, Math.min(300000, Math.ceil(file.size / 20000))));
    if (!upload.ok) throw new Error(messageTranslate("Attachment upload failed"));
  } catch (error) {
    await discardMessageMedia(ticket.mediaKey);
    if (/taking too long/i.test(error.message)) throw new Error(messageTranslate("Attachment upload took too long. Try again on a stronger connection."));
    throw error;
  }
  return { mediaKey: ticket.mediaKey, mediaType: file.type.startsWith("video/") ? "video" : "image" };
}
async function discardMessageMedia(mediaKey) {
  if (!mediaKey) return;
  await directFetch("/stories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "discard", mediaKey })
  }).catch(() => null);
}
function labelConversationHeaderActions(name = "") {
  const labels = { phone: "Phone call", video: "Video call", minimize: "Minimize chat", more: "More chat options", close: "Close chat" };
  for (const [key, button] of Object.entries(conversationHeaderActions)) {
    if (!button) continue;
    const translated = messageTranslate(labels[key]);
    const label = name ? `${translated}: ${name}` : translated;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
}
function closeConversationMenu({ restoreFocus = false } = {}) {
  if (!conversationMenu || !conversationHeaderActions.more) return;
  conversationMenu.hidden = true;
  conversationHeaderActions.more.setAttribute("aria-expanded", "false");
  if (restoreFocus) conversationHeaderActions.more.focus();
}
async function directFetch(path, options = {}, timeoutMs = 10000) {
  const target = path.startsWith("/") ? directApi + path : new URL(path);
  if (typeof target !== "string" && target.origin !== "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com") throw new Error(messageTranslate("Unexpected upload destination"));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(String(target), { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error(messageTranslate("DanzStak is taking too long to respond. Try again."));
    throw new Error(messageTranslate("DanzStak cannot connect right now. Check your connection and try again."));
  }
  finally { clearTimeout(timer); }
}
let activeFilter = "chats";
const chatReadKey = "danzstak_chat_read";
const chatDraftKey = "danzstak_chat_drafts";
let memoryChatDrafts = {};

function readChatDrafts() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(chatDraftKey) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch { return { ...memoryChatDrafts }; }
}

function saveChatDraft(email, content) {
  if (!email) return;
  const drafts = readChatDrafts();
  const draft = String(content || "").slice(0, 2000);
  if (draft.trim()) drafts[email] = draft;
  else delete drafts[email];
  memoryChatDrafts = { ...drafts };
  try { sessionStorage.setItem(chatDraftKey, JSON.stringify(drafts)); }
  catch { /* Drafts remain available in memory when storage is blocked. */ }
}

function restoreChatDraft(email) {
  messageInput.value = String(readChatDrafts()[email] || "");
}

function readChatTimes() {
  try { return JSON.parse(localStorage.getItem(chatReadKey) || "{}"); }
  catch { return {}; }
}

function markChatRead(email, timestamp = new Date().toISOString()) {
  const times = readChatTimes();
  times[email] = timestamp;
  try { localStorage.setItem(chatReadKey, JSON.stringify(times)); }
  catch { /* Messaging remains usable when browser storage is unavailable. */ }
}

function updateMessageReactionBadge(item, message) {
  item.querySelector(".message-reaction")?.remove();
  const entries = Object.entries(message.reactionCounts || {}).filter(([, count]) => Number(count) > 0);
  if (!entries.length) return;
  const badge = document.createElement("span");
  badge.className = "message-reaction";
  badge.textContent = entries.map(([emoji, count]) => emoji + (Number(count) > 1 ? ` ${count}` : "")).join("  ");
  badge.setAttribute("aria-label", entries.map(([emoji, count]) => `${count} ${emoji} reaction${Number(count) === 1 ? "" : "s"}`).join(", "));
  item.appendChild(badge);
}

async function saveMessageReaction(item, message, emoji) {
  const reaction = message.myReaction === emoji ? "" : emoji;
  const response = await directFetch("/messages", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reaction", contactEmail: directContact, messageId: message.messageId, reaction })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || messageTranslate("Reaction could not be saved"));
  const counts = { ...(message.reactionCounts || {}) };
  if (message.myReaction) counts[message.myReaction] = Math.max(0, Number(counts[message.myReaction] || 0) - 1);
  if (reaction) counts[reaction] = Number(counts[reaction] || 0) + 1;
  message.reactionCounts = counts;
  message.myReaction = reaction;
  updateMessageReactionBadge(item, message);
}

function isReactionKeyboardShortcut(event) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function cancelMessageEditor(item, message) {
  item.replaceWith(directMessageItem(message));
}

function openMessageEditor(item, message) {
  if (message.senderEmail !== currentEmail || !message.content || item.querySelector(".message-edit-form")) return;
  document.querySelector(".message-reaction-palette")?.remove();
  const text = item.querySelector(".message-text");
  const form = document.createElement("form");
  const input = document.createElement("textarea");
  const actions = document.createElement("div");
  const cancel = document.createElement("button");
  const save = document.createElement("button");
  form.className = "message-edit-form";
  input.value = message.content;
  input.maxLength = 2000;
  input.rows = Math.min(6, Math.max(2, String(message.content).split("\n").length));
  input.setAttribute("aria-label", messageTranslate("Edit message text"));
  actions.className = "message-edit-actions";
  cancel.type = "button";
  cancel.textContent = messageTranslate("Cancel");
  save.type = "submit";
  save.textContent = messageTranslate("Save");
  actions.append(cancel, save);
  form.append(input, actions);
  if (text) text.hidden = true;
  item.insertBefore(form, item.querySelector(".message-meta"));
  cancel.addEventListener("click", () => cancelMessageEditor(item, message));
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); cancelMessageEditor(item, message); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || content === message.content) {
      if (!content) { input.setCustomValidity(messageTranslate("Message text cannot be empty")); input.reportValidity(); }
      else cancelMessageEditor(item, message);
      return;
    }
    input.setCustomValidity("");
    input.disabled = cancel.disabled = save.disabled = true;
    try {
      const response = await directFetch("/messages", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", contactEmail: directContact, messageId: message.messageId, content })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || messageTranslate("Message could not be edited"));
      Object.assign(message, data.message || {}, { content });
      item.replaceWith(directMessageItem(message));
    } catch (error) {
      callStatus.textContent = error.message;
      input.disabled = cancel.disabled = save.disabled = false;
      input.focus();
    }
  });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

async function deleteDirectMessage(item, message, scope) {
  const response = await directFetch("/messages", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", contactEmail: directContact, messageId: message.messageId, scope })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || messageTranslate("Message could not be deleted"));
  item.remove();
  callStatus.textContent = messageTranslate(scope === "everyone" ? "Message deleted for everyone." : "Message deleted for you.");
}

function openMessageDeleteChoices(item, message, palette) {
  palette.replaceChildren();
  palette.classList.add("message-delete-choices");
  const addChoice = (label, scope, danger = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = danger ? "message-delete-danger" : "";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await deleteDirectMessage(item, message, scope); palette.remove(); }
      catch (error) { callStatus.textContent = error.message; button.disabled = false; }
    });
    palette.appendChild(button);
  };
  addChoice(messageTranslate("Remove for me"), "me");
  if (message.senderEmail === currentEmail) addChoice(messageTranslate("Remove for everyone"), "everyone", true);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = messageTranslate("Cancel");
  cancel.addEventListener("click", () => palette.remove());
  palette.appendChild(cancel);
  palette.querySelector("button")?.focus();
}

function openMessageReactions(item, message, x, y, focusFirst = false) {
  document.querySelector(".message-reaction-palette")?.remove();
  const palette = document.createElement("div"); palette.className = "message-reaction-palette"; palette.style.left = Math.max(8, Math.min(x - 110, innerWidth - 248)) + "px"; palette.style.top = Math.max(8, y - 64) + "px";
  for (const emoji of ["👍","❤️","😂","😮","😢","😡"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.setAttribute("aria-label", messageFormat(message.myReaction === emoji ? "Remove {emoji}" : "React with {emoji}", { emoji })); button.classList.toggle("selected", message.myReaction === emoji); button.addEventListener("click", async () => { button.disabled = true; try { await saveMessageReaction(item, message, emoji); palette.remove(); } catch (error) { callStatus.textContent = error.message; button.disabled = false; } }); palette.appendChild(button); }
  if (message.senderEmail === currentEmail && message.content) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "message-edit-choice";
    edit.dataset.icon = "edit";
    edit.textContent = "✎ " + messageTranslate("Edit message");
    edit.title = messageTranslate("Edit message");
    edit.setAttribute("aria-label", messageTranslate("Edit message"));
    edit.addEventListener("click", () => openMessageEditor(item, message));
    palette.appendChild(edit);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "message-delete-choice";
  remove.dataset.icon = "trash";
  remove.textContent = "🗑️";
  remove.title = messageTranslate("Delete message");
  remove.setAttribute("aria-label", messageTranslate("Delete message"));
  remove.addEventListener("click", () => openMessageDeleteChoices(item, message, palette));
  palette.appendChild(remove);
  palette.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); palette.remove(); item.focus(); } });
  document.body.appendChild(palette);
  if (focusFirst) palette.querySelector("button")?.focus();
}

function updateConversationPresence(conversation) {
  if (!conversationPresence) return;
  const isOnline = conversation?.online === true;
  const contactName = conversation?.name || conversationName?.textContent || "DanzStak member";
  const translatedPresence = messageTranslate(isOnline ? "Online" : "Offline");
  conversationPresence.hidden = false;
  conversationPresence.textContent = translatedPresence;
  conversationPresence.classList.toggle("is-offline", !isOnline);
  conversationPresence.setAttribute("aria-label", `${contactName}: ${translatedPresence}`);
}

function openConversation(conversation, { updateHistory = true } = {}) {
  closeConversation();
  document.body.classList.add("is-conversation-open");
  if (document.body?.dataset) {
    const callMode = document.body.dataset.callMode;
    document.body.dataset.syncScreen = callMode === "video" ? "video-call" : callMode === "phone" ? "voice-call" : "conversation";
  }
  if (updateHistory) rememberMobileConversation(conversation);
  if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: true }, location.origin);
  contactInput.value = conversation.contactEmail;
  window.danzstakActiveContactName = conversation.name || "DanzStak member";
  activeCanContact = conversation.canContact !== false;
  setConversationActionsEnabled(activeCanContact);
  directContact = "";
  conversationHeader.hidden = false;
  conversationName.textContent = conversation.name || "DanzStak member";
  const profileHref = conversation.memberId ? "profile.html?member=" + encodeURIComponent(conversation.memberId) : "profile.html";
  conversationName.href = profileHref;
  conversationName.setAttribute("aria-label", `${messageTranslate("Open contact profile")}: ${conversationName.textContent}`);
  conversationAvatar.href = profileHref;
  conversationAvatar.setAttribute("aria-label", `${messageTranslate("Open contact profile")}: ${conversationName.textContent}`);
  labelConversationHeaderActions(conversationName.textContent);
  updateConversationPresence(conversation);
  activeContactName = conversation.name || messageTranslate("Contact");
  if (deleteChat) deleteChat.disabled = false;
  conversationAvatar.textContent = (conversation.name || "DanzStak member").charAt(0).toUpperCase();
  conversationAvatar.style.backgroundImage = "";
  if (conversation.picture) {
    const avatarContact = conversation.contactEmail;
    const image = new Image();
    image.addEventListener("load", () => {
      if (contactInput.value !== avatarContact) return;
      conversationAvatar.style.backgroundImage = `url("${conversation.picture}")`;
      conversationAvatar.textContent = "";
    }, { once: true });
    image.src = conversation.picture;
  }
  restoreChatDraft(contactInput.value);
  loadDirectMessages(true);
}

function closeConversation({ focusList = false, preserveDraft = true } = {}) {
  const closingContact = contactInput.value.trim().toLowerCase();
  if (closingContact && preserveDraft) saveChatDraft(closingContact, messageInput.value);
  conversationVersion += 1;
  loadingMessages = false;
  document.querySelector(".message-reaction-palette")?.remove();
  if (document.body?.dataset) document.body.dataset.syncScreen = activeFilter;
  closeConversationMenu();
  conversationHeader.hidden = true;
  conversationName.href = "profile.html";
  conversationName.setAttribute("aria-label", messageTranslate("Open contact profile"));
  conversationAvatar.href = "profile.html";
  conversationAvatar.setAttribute("aria-label", messageTranslate("Open contact profile"));
  labelConversationHeaderActions();
  if (conversationPresence) conversationPresence.hidden = true;
  contactInput.value = "";
  directContact = "";
  activeContactName = messageTranslate("Contact");
  activeCanContact = false;
  setConversationActionsEnabled(false);
  nextMessageCursor = "";
  shownMessages.clear();
  messageList.replaceChildren();
  messageList.setAttribute("aria-busy", "false");
  messageInput.value = "";
  clearSelectedMessageMedia();
  messageInput.disabled = true;
  sendButton.disabled = true;
  if (deleteChat) deleteChat.disabled = true;
  document.body.classList.remove("is-conversation-open");
  if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: false }, location.origin);
  if (focusList) conversationUsers?.querySelector(".conversation-user")?.focus();
}

function renderMessageLoadingState() {
  const status = document.createElement("p");
  status.className = "system-message message-loading-state";
  status.setAttribute("role", "status");
  status.textContent = messageFormat("Loading messages with {name}…", { name: activeContactName });
  messageList.replaceChildren(status);
}

function renderMessageLoadError(message) {
  const panel = document.createElement("div");
  const status = document.createElement("p");
  const retry = document.createElement("button");
  panel.className = "message-load-error";
  status.className = "system-message";
  status.setAttribute("role", "alert");
  status.textContent = message || messageTranslate("Messages could not be loaded");
  retry.type = "button";
  retry.className = "message-load-retry";
  retry.textContent = messageTranslate("Try loading messages again");
  retry.addEventListener?.("click", () => loadDirectMessages(true));
  panel.append(status, retry);
  messageList.replaceChildren(panel);
}

function messageAccessibleSummary(message, mine) {
  const actor = mine ? messageTranslate("You") : activeContactName;
  const content = String(message.content || "").trim();
  const lead = content
    ? messageFormat("{name}: {text}.", { name: actor, text: content })
    : message.mediaType === "video"
      ? messageFormat("{name} sent a video.", { name: actor })
      : message.mediaType === "image"
        ? messageFormat("{name} sent a photo.", { name: actor })
        : messageFormat("{name} sent a message.", { name: actor });
  const guidance = messageTranslate(mine && content
    ? "Long press or press Shift F10 for reactions and editing."
    : "Long press or press Shift F10 for reactions.");
  return `${lead} ${guidance}`;
}

async function refreshDirectMessageMedia(message) {
  const contact = contactInput?.value.trim().toLowerCase();
  if (!contact || !message?.messageId) return "";
  const response = await directFetch("/messages?contact=" + encodeURIComponent(contact) + "&message=" + encodeURIComponent(message.messageId), { credentials: "include", cache: "no-store" }).catch(() => null);
  if (!response?.ok) return "";
  const data = await response.json().catch(() => ({}));
  if (!data.message?.mediaUrl) return "";
  message.mediaUrl = data.message.mediaUrl;
  return message.mediaUrl;
}

function installDirectMessageMedia(item, message, mine) {
  const recovery = document.createElement("div");
  recovery.className = "message-attachment-recovery";
  const copy = document.createElement("span");
  copy.textContent = messageTranslate("Media is temporarily unavailable.");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = messageTranslate("Retry media");
  recovery.append(copy, retry);
  const showRecovery = () => {
    item.querySelector(".message-attachment")?.remove();
    if (!recovery.parentNode) item.prepend(recovery);
  };
  const install = async () => {
    retry.disabled = true;
    const mediaUrl = message.mediaUrl || await refreshDirectMessageMedia(message);
    retry.disabled = false;
    if (!mediaUrl) { showRecovery(); return; }
    recovery.remove();
    const media = document.createElement(message.mediaType === "video" ? "video" : "img");
    media.className = "message-attachment";
    media.addEventListener("error", () => { message.mediaUrl = ""; showRecovery(); }, { once: true });
    if (message.mediaType === "image") { media.alt = mine ? messageTranslate("Photo you sent") : messageFormat("Photo from {name}", { name: activeContactName }); media.loading = "lazy"; }
    else { media.controls = true; media.playsInline = true; media.preload = "metadata"; media.setAttribute("aria-label", mine ? messageTranslate("Video you sent") : messageFormat("Video from {name}", { name: activeContactName })); }
    media.src = mediaUrl;
    item.prepend(media);
  };
  retry.addEventListener("click", () => { message.mediaUrl = ""; void install(); });
  void install();
}

function directMessageItem(message) {
  const mine = message.senderEmail === currentEmail;
  const item = document.createElement("div");
  item.className = "message" + (mine ? " mine" : "");
  item.tabIndex = 0;
  item.dataset.messageId = message.messageId;
  if (message.content) {
    const text = document.createElement("span");
    text.className = "message-text";
    window.danzstakRenderUserText?.(text, message.content) || (text.textContent = message.content);
    item.appendChild(text);
  }
  if (["image", "video"].includes(message.mediaType)) installDirectMessageMedia(item, message, mine);
  const sharedUrl = firstSafeMessageUrl(message.content);
  if (sharedUrl) item.appendChild(messageLinkPreview(sharedUrl));
  item.setAttribute("aria-label", messageAccessibleSummary(message, mine));
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = (mine ? messageTranslate("You") : activeContactName) + " · " + new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (message.editedAt ? " · " + messageTranslate("edited") : "");
  if (mine) {
    const receipt = document.createElement("span");
    receipt.className = message.read ? "message-receipt is-read" : "message-receipt";
    receipt.textContent = message.read ? "✓✓" : "✓";
    receipt.setAttribute("aria-label", messageTranslate(message.read ? "Read" : "Delivered"));
    meta.append(" ", receipt);
  }
  item.appendChild(meta);
  updateMessageReactionBadge(item, message);
  item.addEventListener("pointerdown", event => { reactionTimer = setTimeout(() => openMessageReactions(item, message, event.clientX, event.clientY), 550); });
  for (const type of ["pointerup","pointercancel","pointerleave"]) item.addEventListener(type, () => { clearTimeout(reactionTimer); reactionTimer = null; });
  item.addEventListener("contextmenu", event => { event.preventDefault(); clearTimeout(reactionTimer); openMessageReactions(item, message, event.clientX, event.clientY); });
  item.addEventListener("keydown", event => {
    if (mine && message.content && event.key.toLowerCase() === "e" && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); openMessageEditor(item, message); return; }
    if (!isReactionKeyboardShortcut(event)) return;
    event.preventDefault(); const rect = item.getBoundingClientRect(); openMessageReactions(item, message, rect.left + rect.width / 2, rect.top, true);
  });
  return item;
}

function firstSafeMessageUrl(content) {
  const match = String(content || "").match(/\bhttps:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.!?;:]+$/, "");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

function messageLinkPreview(url) {
  const card = document.createElement("a");
  const icon = document.createElement("span");
  const copy = document.createElement("span");
  const domain = document.createElement("strong");
  const detail = document.createElement("small");
  card.className = "message-link-preview";
  card.href = url.href;
  card.target = "_blank";
  card.rel = "noopener noreferrer nofollow ugc";
  card.referrerPolicy = "no-referrer";
  card.setAttribute("aria-label", messageFormat("Open shared link on {site}", { site: url.hostname }));
  icon.className = "message-link-icon";
  icon.textContent = "🔗";
  domain.textContent = url.hostname.replace(/^www\./, "");
  detail.textContent = (url.pathname === "/" ? messageTranslate("Open shared link") : url.pathname.replace(/%20/gi, " ").replace(/\/+$/, "").split("/").filter(Boolean).slice(-2).join(" / ")) || messageTranslate("Open shared link");
  copy.append(domain, detail);
  card.append(icon, copy);
  return card;
}

function pendingMessageItem(content, mediaFile) {
  const item = document.createElement("div");
  const text = content || messageTranslate(mediaFile?.type.startsWith("video/") ? "Video" : "Photo");
  const meta = document.createElement("span");
  item.className = "message mine message-pending";
  item.textContent = text;
  item.setAttribute("aria-label", messageFormat("You: {text}. Sending.", { text }));
  meta.className = "message-meta";
  meta.textContent = messageTranslate("Sending…");
  item.appendChild(meta);
  return item;
}

function renderEarlierMessagesButton() {
  messageList.querySelector(".load-earlier-messages")?.remove();
  if (!nextMessageCursor) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "load-earlier-messages";
  button.textContent = messageTranslate("Load earlier messages");
  button.addEventListener("click", loadEarlierMessages);
  messageList.prepend(button);
}

async function loadEarlierMessages() {
  const version = conversationVersion;
  const contact = directContact;
  const cursor = nextMessageCursor;
  if (!contact || !cursor || loadingMessages) return;
  loadingMessages = true;
  const button = messageList.querySelector(".load-earlier-messages");
  if (button) { button.disabled = true; button.textContent = messageTranslate("Loading…"); }
  const previousHeight = messageList.scrollHeight;
  try {
    const response = await directFetch("/messages?contact=" + encodeURIComponent(contact) + "&before=" + encodeURIComponent(cursor), { credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (version !== conversationVersion) return;
    if (!response.ok) throw new Error(data.error || messageTranslate("Earlier messages could not be loaded"));
    const fragment = document.createDocumentFragment();
    for (const message of data.messages || []) {
      if (shownMessages.has(message.messageId)) continue;
      shownMessages.add(message.messageId);
      fragment.appendChild(directMessageItem(message));
    }
    button?.remove();
    messageList.prepend(fragment);
    nextMessageCursor = data.nextCursor || "";
    renderEarlierMessagesButton();
    messageList.scrollTop += messageList.scrollHeight - previousHeight;
  } catch (error) {
    if (version !== conversationVersion) return;
    callStatus.textContent = error.message;
    if (button) { button.disabled = false; button.textContent = messageTranslate("Try loading earlier messages again"); }
  } finally { if (version === conversationVersion) loadingMessages = false; }
}

async function loadDirectMessages(reset = false) {
  const version = conversationVersion;
  if (!document.body.classList.contains("is-conversation-open")) return;
  if (document.hidden && !reset) return;
  const contact = contactInput?.value.trim().toLowerCase();
  if (!contact || loadingMessages) return;
  if (contact !== directContact) { directContact = contact; reset = true; }
  loadingMessages = true;
  messageList.setAttribute("aria-busy", "true");
  if (reset) renderMessageLoadingState();
  try {
    const response = await directFetch("/messages?read=1&contact=" + encodeURIComponent(contact), { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (version !== conversationVersion) return;
    if (!response.ok) throw new Error(data.error || messageTranslate("Messages could not be loaded"));
    const distanceFromBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight;
    const followNewest = reset || distanceFromBottom < 80;
    if (reset) { shownMessages.clear(); nextMessageCursor = data.nextCursor || ""; messageList.replaceChildren(); }
    let appended = 0;
    for (const message of data.messages || []) {
      if (shownMessages.has(message.messageId)) {
        const existing = [...messageList.querySelectorAll(".message")].find(item => item.dataset.messageId === message.messageId);
        if (existing) updateMessageReactionBadge(existing, message);
        continue;
      }
      shownMessages.add(message.messageId);
      messageList.appendChild(directMessageItem(message));
      appended += 1;
    }
    if (reset) renderEarlierMessagesButton();
    const receivedMessages = data.messages || [];
    const newest = receivedMessages.length ? receivedMessages[receivedMessages.length - 1].createdAt : "";
    markChatRead(contact, newest || new Date().toISOString());
    if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-read", contact }, location.origin);
    if (followNewest && appended) messageList.scrollTop = messageList.scrollHeight;
    activeCanContact = data.canContact !== false;
    setConversationActionsEnabled(activeCanContact);
    messageInput.disabled = !activeCanContact;
    sendButton.disabled = !activeCanContact;
    callStatus.textContent = activeCanContact
      ? messageFormat("You can message {name} directly.", { name: activeContactName })
      : messageTranslate("Saved chat. Become friends or join the same Tribe to send new messages or call.");
  } catch (error) {
    if (version === conversationVersion) {
      const message = error.message || messageTranslate("Messages could not be loaded");
      callStatus.textContent = message;
      if (reset) renderMessageLoadError(message);
    }
  } finally {
    if (version === conversationVersion) {
      loadingMessages = false;
      messageList.setAttribute("aria-busy", "false");
    }
  }
}

let loadingConversations = false;
async function readMessagingArrayResponse(response, key) {
  if (!response?.ok) return { available: false, items: [] };
  try {
    const data = await response.json();
    return { available: true, items: Array.isArray(data?.[key]) ? data[key] : [] };
  } catch {
    return { available: false, items: [] };
  }
}
function renderConversationLoadError() {
  if (!conversationUsers) return;
  if (typeof chatContacts !== "undefined" && chatContacts) {
    chatContacts.replaceChildren();
    chatContacts.hidden = true;
  }
  conversationUsers.replaceChildren();
  const panel = document.createElement("div");
  panel.className = "message-load-error contact-load-error";
  const status = document.createElement("p");
  status.className = "chat-note";
  status.setAttribute?.("role", "alert");
  status.textContent = messageTranslate("Contacts are temporarily unavailable");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "message-load-retry";
  retry.textContent = messageTranslate("Try loading messages again");
  retry.addEventListener("click", () => {
    retry.disabled = true;
    retry.textContent = messageTranslate("Loading…");
    loadConversations();
  });
  panel.append(status, retry);
  conversationUsers.appendChild(panel);
}
function openConversationFromInbox(conversation) {
  conversation.unread = 0;
  markChatRead(conversation.contactEmail, conversation.updatedAt || new Date().toISOString());
  openConversation(conversation);
}
function renderChatContactStrip(conversations) {
  if (typeof chatContacts === "undefined" || !chatContacts) return;
  chatContacts.replaceChildren();
  const eligible = conversations
    .filter(conversation => conversation?.contactEmail && conversation.canContact !== false)
    .sort((left, right) => {
      const recent = String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
      return recent || String(left.name || "").localeCompare(String(right.name || ""));
    });
  chatContacts.hidden = eligible.length === 0;
  for (const conversation of eligible) {
    const name = conversation.name || "DanzStak member";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-contact";
    button.dataset.contactEmail = conversation.contactEmail;
    button.setAttribute("aria-label", `${messageTranslate("Chats")}: ${name}`);
    button.title = name;
    const avatarWrap = document.createElement("span");
    avatarWrap.className = "chat-contact-avatar-wrap";
    const avatar = conversation.picture ? document.createElement("img") : document.createElement("span");
    avatar.className = "chat-contact-avatar";
    if (conversation.picture) {
      avatar.src = conversation.picture;
      avatar.alt = "";
      window.danzstakIdentityMedia?.install(avatar, conversation);
    } else avatar.textContent = name.charAt(0).toUpperCase();
    avatarWrap.appendChild(avatar);
    if (conversation.online === true) {
      const onlineDot = document.createElement("span");
      onlineDot.className = "chat-contact-online";
      onlineDot.setAttribute("role", "img");
      onlineDot.setAttribute("aria-label", messageTranslate("Online"));
      onlineDot.title = messageTranslate("Online");
      avatarWrap.appendChild(onlineDot);
    }
    const label = document.createElement("span");
    label.className = "chat-contact-name";
    label.textContent = name;
    button.append(avatarWrap, label);
    button.addEventListener("click", () => openConversationFromInbox(conversation));
    chatContacts.appendChild(button);
  }
}
function appendConversationAvailabilityWarning() {
  if (!conversationUsers) return;
  const panel = document.createElement("div");
  panel.className = "message-load-error contact-load-error message-partial-warning";
  const status = document.createElement("p");
  status.className = "chat-note";
  status.setAttribute("role", "status");
  status.textContent = messageTranslate("Some chats or online statuses are temporarily unavailable.");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "message-load-retry";
  retry.textContent = messageTranslate("Retry contacts");
  retry.addEventListener("click", () => loadConversations());
  panel.append(status, retry);
  conversationUsers.appendChild(panel);
}
async function loadConversations() {
  if (document.hidden || loadingConversations) return;
  loadingConversations = true;
  conversationUsers?.setAttribute?.("aria-busy", "true");
  try {
    await directFetch("/calls/presence", {
      method: "POST",
      credentials: "include"
    }).catch(() => null);
    const results = await Promise.allSettled([
      directFetch("/conversations", { credentials: "include", cache: "no-store" }),
      directFetch("/friends", { credentials: "include", cache: "no-store" }),
      directFetch("/calls/directory", { credentials: "include", cache: "no-store" })
    ]);
    const usableResponse = result => result.status === "fulfilled" && result.value.ok ? result.value : null;
    const conversationResponse = usableResponse(results[0]);
    const friendsResponse = usableResponse(results[1]);
    const directoryResponse = usableResponse(results[2]);
    const [conversationSource, friendsSource, directorySource] = await Promise.all([
      readMessagingArrayResponse(conversationResponse, "conversations"),
      readMessagingArrayResponse(friendsResponse, "friends"),
      readMessagingArrayResponse(directoryResponse, "users")
    ]);
    if (!conversationSource.available && !friendsSource.available && !directorySource.available) throw new Error(messageTranslate("Contacts are temporarily unavailable"));
    const sourcesComplete = conversationSource.available && friendsSource.available && directorySource.available;
    if (typeof window !== "undefined" && window.parent !== window && directorySource.available) {
      const users = directorySource.items.map(member => ({
        memberId: String(member.memberId || ""),
        online: member.online === true
      })).filter(member => /^[a-f0-9-]{36}$/.test(member.memberId));
      window.parent.postMessage({ type: "danzstak-presence-update", users }, location.origin);
    }
    const contacts = new Map();
    if (!sourcesComplete) {
      for (const conversation of cachedConversations) {
        const email = String(conversation.contactEmail || "").toLowerCase();
        if (email) contacts.set(email, { ...conversation, contactEmail: email });
      }
    }
    for (const conversation of conversationSource.items) {
      if (conversation.contactEmail) contacts.set(conversation.contactEmail.toLowerCase(), { ...conversation, hasConversation: true });
    }
    for (const friend of friendsSource.items) {
      const email = String(friend.email || "").toLowerCase();
      if (!email) continue;
      const existing = contacts.get(email) || {};
      contacts.set(email, {
        ...existing,
        contactEmail: email,
        memberId: friend.memberId || existing.memberId || "",
        name: friend.name || existing.name || "DanzStak member",
        picture: friend.picture || existing.picture || "",
        preview: existing.preview || messageTranslate("Start a conversation"),
        updatedAt: existing.updatedAt || "",
        isFriend: true,
        hasConversation: existing.hasConversation === true
      });
    }
    for (const member of directorySource.items) {
      const email = String(member.email || "").toLowerCase();
      const existing = contacts.get(email);
      if (!email || (!existing && !member.sharedGroup)) continue;
      contacts.set(email, {
        ...(existing || {}),
        contactEmail: email,
        name: existing?.name || member.name || "DanzStak member",
        memberId: existing?.memberId || member.memberId || "",
        picture: member.picture || existing?.picture || "",
        preview: existing?.preview || messageTranslate("Shared Tribe member"),
        updatedAt: existing?.updatedAt || "",
        sharedGroup: existing?.sharedGroup === true || member.sharedGroup === true,
        online: member.online === true,
        hasConversation: existing?.hasConversation === true
      });
    }
    cachedConversations = [...contacts.values()];
    if (activeFilter === "bookings") return;
    const focusedControl = document.activeElement?.closest?.(".conversation-user,.chat-contact");
    const focusedContact = focusedControl?.dataset.contactEmail || "";
    const focusedSelector = focusedControl?.classList.contains("chat-contact") ? ".chat-contact" : ".conversation-user";
    const activeContact = String(contactInput?.value || "").trim().toLowerCase();
    if (activeContact && !conversationHeader.hidden) {
      const activeConversation = cachedConversations.find(item => item.contactEmail === activeContact);
      if (activeConversation) updateConversationPresence(activeConversation);
    }
    conversationUsers.replaceChildren();
    renderChatContactStrip(cachedConversations);
    const query = chatSearch?.value.trim().toLowerCase() || "";
    const visible = cachedConversations.filter(item => {
      const matchesSearch = !query || (item.name + " " + item.contactEmail + " " + item.preview).toLowerCase().includes(query);
      const matchesFilter = activeFilter === "chats"
        ? item.hasConversation === true
        : activeFilter === "calls"
          ? item.canContact !== false
          : activeFilter === "contacts";
      return matchesSearch && matchesFilter;
    });
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "chat-note";
      const emptyBySection = activeFilter === "chats"
        ? "No saved conversations yet. Open Contacts to start one."
        : activeFilter === "calls"
          ? "No contacts are currently available to call."
          : "No permitted contacts are available yet.";
      empty.textContent = messageTranslate(query ? "No contacts match your search." : emptyBySection);
      conversationUsers.appendChild(empty);
      if (!sourcesComplete) appendConversationAvailabilityWarning();
      return;
    }
    for (const conversation of visible) {
      const row = document.createElement("div"); row.className = "conversation-row"; row.dataset.syncSection = activeFilter;
      const button = document.createElement("button"); button.type = "button"; button.className = "conversation-user";
      button.dataset.contactEmail = conversation.contactEmail;
      const isActiveContact = activeContact && conversation.contactEmail === activeContact && !conversationHeader.hidden;
      button.classList.toggle("is-active", Boolean(isActiveContact));
      if (isActiveContact) button.setAttribute("aria-current", "true");
      const avatarWrap = document.createElement("span"); avatarWrap.className = "conversation-avatar-wrap";
      const avatar = conversation.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "conversation-list-avatar";
      if (conversation.picture) {
        avatar.src = conversation.picture;
        avatar.alt = "";
        window.danzstakIdentityMedia?.install(avatar, conversation);
      } else avatar.textContent = (conversation.name || "DanzStak member").charAt(0).toUpperCase();
      avatarWrap.appendChild(avatar);
      if (conversation.online === true) {
        const onlineDot = document.createElement("span"); onlineDot.className = "conversation-online-dot"; onlineDot.setAttribute("role", "img"); onlineDot.setAttribute("aria-label", messageTranslate("Online")); onlineDot.title = messageTranslate("Online"); avatarWrap.appendChild(onlineDot);
      }
      const copy = document.createElement("span"); copy.className = "conversation-copy";
      const name = document.createElement("strong"); name.textContent = conversation.name || "DanzStak member";
      const preview = document.createElement("small"); preview.textContent = conversation.preview || messageTranslate("Open chat");
      const unread = Number(conversation.unread || 0) > 0;
      button.classList.toggle("is-unread", Boolean(unread));
      const meta = document.createElement("span"); meta.className = "conversation-list-meta";
      const time = document.createElement("time"); time.textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
      meta.appendChild(time);
      if (unread) {
        const badge = document.createElement("span");
        badge.className = "conversation-unread";
        badge.textContent = Number(conversation.unread) > 99 ? "99+" : String(Number(conversation.unread));
        badge.setAttribute("aria-label", messageFormat(Number(conversation.unread) === 1 ? "{count} unread message" : "{count} unread messages", { count: conversation.unread }));
        meta.appendChild(badge);
      }
      copy.append(name, preview); button.append(avatarWrap, copy, meta);
      button.addEventListener("click", () => openConversationFromInbox(conversation));
      const calls = document.createElement("div"); calls.className = "conversation-call-actions";
      for (const [kind, targetId] of [["phone", "startPhone"], ["video", "startVideo"]]) {
        const call = document.createElement("button"), publicName = conversation.name || "DanzStak member"; call.type = "button"; call.className = "conversation-call"; call.appendChild(createCallActionIcon(kind)); call.title = `${messageTranslate(targetId === "startPhone" ? "Phone call" : "Video call")}: ${publicName}`; call.setAttribute("aria-label", call.title);
        call.disabled = conversation.canContact === false;
        call.addEventListener("click", () => { openConversation(conversation); document.getElementById(targetId)?.click(); });
        calls.appendChild(call);
      }
      row.append(button, calls); conversationUsers.appendChild(row);
    }
    if (!sourcesComplete) appendConversationAvailabilityWarning();
    if (focusedContact) {
      const focusTarget = [...document.querySelectorAll(focusedSelector)].find(button => button.dataset.contactEmail === focusedContact);
      focusTarget?.focus({ preventScroll: true });
    }
    const requested = contactInput.value.trim().toLowerCase();
    if (requested && conversationHeader.hidden) openConversation(cachedConversations.find(item => item.contactEmail === requested) || { contactEmail: requested, name: "DanzStak member", picture: "" });
  } catch {
    if (!cachedConversations.length) renderConversationLoadError();
  } finally {
    loadingConversations = false;
    conversationUsers?.setAttribute?.("aria-busy", "false");
  }
}

chatSearch?.addEventListener("input", () => activeFilter === "bookings" ? window.danzstakLoadBookingThreads?.() : loadConversations());
document.getElementById("newChat")?.addEventListener("click", () => {
  activeFilter = "contacts";
  chatFilters.forEach(item => {
    const selected = item.dataset.chatFilter === "contacts";
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  if (chatSearch) chatSearch.value = "";
  document.body.classList.remove("is-conversation-open");
  loadConversations();
  chatSearch?.focus();
});
const chatFilters = [...document.querySelectorAll("[data-chat-filter]")];
const syncSectionNote = document.getElementById("syncSectionNote");
const syncSectionCopy = {
  chats: "Your saved conversations.",
  bookings: "Replies from clubs and venues you contacted through Tour Manager.",
  calls: "Start a secure voice or video call with an available contact.",
  contacts: "Friends and shared Tribe members you are permitted to contact."
};
document.body.dataset.syncScreen = activeFilter;
chatFilters.forEach(button => button.addEventListener("click", () => {
  chatFilters.forEach(item => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1; });
  activeFilter = button.dataset.chatFilter;
  document.body.dataset.syncScreen = activeFilter;
  if (syncSectionNote) syncSectionNote.textContent = messageTranslate(syncSectionCopy[activeFilter] || syncSectionCopy.chats);
  if (activeFilter === "bookings") window.danzstakLoadBookingThreads?.();
  else { window.danzstakLeaveBookingThreads?.(); loadConversations(); }
}));
document.querySelector(".chat-filters")?.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const current = chatFilters.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? chatFilters.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + chatFilters.length) % chatFilters.length;
  chatFilters[next].focus(); chatFilters[next].click();
});
document.getElementById("headerPhone")?.addEventListener("click", () => document.getElementById("startPhone")?.click());
document.getElementById("headerVideo")?.addEventListener("click", () => document.getElementById("startVideo")?.click());
document.getElementById("minimizeConversation")?.addEventListener("click", () => {
  if (window.parent === window) {
    closeConversationFromControl();
    return;
  }
  document.body.classList.remove("is-conversation-open");
  window.parent.postMessage({ type: "danzstak-chat-minimize" }, location.origin);
});
conversationHeaderActions.more?.addEventListener("click", event => {
  event.stopPropagation();
  const opening = conversationMenu.hidden;
  conversationMenu.hidden = !opening;
  conversationHeaderActions.more.setAttribute("aria-expanded", String(opening));
  if (opening) (headerMakePlansMenu || headerDeleteChat)?.focus();
});
headerMakePlansMenu?.addEventListener("click", () => { closeConversationMenu(); document.getElementById("makePlans")?.click(); });
headerDeleteChat?.addEventListener("click", () => { closeConversationMenu(); deleteChat?.click(); });
conversationMenu?.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); closeConversationMenu({ restoreFocus: true }); } });
document.addEventListener("click", event => { if (!conversationMenu?.hidden && !conversationHeader.contains(event.target)) closeConversationMenu(); });
document.getElementById("closeConversation")?.addEventListener("click", closeConversationFromControl);

window.addEventListener("popstate", event => {
  if (!usesMobileConversationHistory()) return;
  if (event.state?.danzstakChatOpen === true && mobileHistoryConversation) {
    openConversation(mobileHistoryConversation, { updateHistory: false });
    return;
  }
  if (document.body.classList.contains("is-conversation-open")) closeConversation({ focusList: true });
});

window.addEventListener("message", event => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === "danzstak-chat-hidden") document.body.classList.remove("is-conversation-open"); });

onlineUsers?.addEventListener("click", event => {
  if (!event.target.closest("button")) return;
  setTimeout(() => loadDirectMessages(true), 0);
});

textButton?.addEventListener("click", event => {
  event.stopImmediatePropagation();
  const email = contactInput.value.trim().toLowerCase();
  if (!email) { callStatus.textContent = messageTranslate("Select a friend or Tribe member first."); return; }
  openConversation(cachedConversations.find(item => item.contactEmail === email) || { contactEmail: email, name: "DanzStak member", picture: "" });
}, true);

window.addEventListener("danzstak-contact-selected", event => {
  const selected = event.detail;
  if (!selected?.contactEmail) return;
  openConversation(selected);
});

messageInput?.addEventListener("input", () => saveChatDraft(contactInput.value.trim().toLowerCase(), messageInput.value));

// Mobile Return and physical Enter use the same guarded send path.
messageInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.shiftKey) return;
  event.preventDefault();
  if (event.repeat || messageInput.disabled) return;
  messageForm.requestSubmit();
});

messageForm?.addEventListener("submit", async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const content = messageInput.value.trim();
  const recipientEmail = contactInput.value.trim().toLowerCase();
  if ((!content && !selectedMessageMedia) || !recipientEmail || !activeCanContact || pendingMessageSends.has(conversationVersion)) return;
  const mediaFile = selectedMessageMedia;
  const retry = retryMessageSend
    && retryMessageSend.recipientEmail === recipientEmail
    && retryMessageSend.content === content
    && retryMessageSend.mediaFile === mediaFile
    ? retryMessageSend
    : null;
  if (retryMessageSend && !retry) {
    await discardMessageMedia(retryMessageSend.attachment?.mediaKey);
    retryMessageSend = null;
  }
  const clientMessageId = retry?.clientMessageId || `${String(Date.now()).padStart(13, "0")}#${crypto.randomUUID()}`;
  if (window.navigator?.onLine === false && window.danzstakQueueOffline) {
    try {
      if (selectedMessageMedia) throw new Error(messageTranslate("Attachments need a connection. Your draft is still here."));
      window.danzstakQueueOffline("/messages", { recipientEmail, content, clientMessageId });
      retryMessageSend = null;
      messageInput.value = "";
      saveChatDraft(recipientEmail, "");
      callStatus.textContent = messageTranslate("Saved offline — waiting to send when you reconnect.");
    } catch (error) { callStatus.textContent = error.message; }
    return;
  }
  const version = conversationVersion;
  const pendingItem = pendingMessageItem(content, mediaFile);
  let attachment = retry?.attachment || {};
  pendingMessageSends.add(version);
  sendButton.disabled = true;
  messageList.appendChild(pendingItem);
  messageList.scrollTop = messageList.scrollHeight;
  if (content && messageInput.value.trim() === content) messageInput.value = "";
  try {
    if (mediaFile && !attachment.mediaKey) callStatus.textContent = messageTranslate("Uploading attachment…");
    if (mediaFile && !attachment.mediaKey) attachment = await uploadSelectedMessageMedia(mediaFile);
    const response = await directFetch("/messages", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientEmail, content, clientMessageId, ...attachment }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await discardMessageMedia(attachment.mediaKey);
      attachment = {};
      throw new Error(data.error || messageTranslate("Message could not be sent"));
    }
    retryMessageSend = null;
    if (version !== conversationVersion) { await loadConversations(); return; }
    if (data.message?.messageId) {
      shownMessages.add(data.message.messageId);
      pendingItem.replaceWith(directMessageItem(data.message));
    } else {
      pendingItem.remove();
    }
    saveChatDraft(recipientEmail, "");
    if (selectedMessageMedia === mediaFile) clearSelectedMessageMedia();
    await loadConversations();
  } catch (error) {
    pendingItem.remove();
    if (version === conversationVersion) {
      retryMessageSend = { recipientEmail, content, mediaFile, clientMessageId, attachment };
      if (content && !messageInput.value.trim()) messageInput.value = content;
      callStatus.textContent = messageFormat("{error}. Your message is still in the composer.", { error: error.message });
      messageInput.focus();
    }
  }
  finally { pendingMessageSends.delete(version); if (version === conversationVersion) sendButton.disabled = !activeCanContact; }
}, true);

messageMedia?.addEventListener("change", () => previewSelectedMessageMedia(messageMedia.files?.[0]));
messageCamera?.addEventListener("change", () => previewSelectedMessageMedia(messageCamera.files?.[0]));

deleteChat?.addEventListener("click", async () => {
  const contact = contactInput.value.trim().toLowerCase();
  if (!contact || !(await window.danzstakConfirm(messageTranslate("This removes the chat from your account. The other person will keep their message history."), { title: messageTranslate("Delete this chat?"), confirmLabel: messageTranslate("Delete chat"), danger: true }))) return;
  const version = conversationVersion;
  deleteChat.disabled = true;
  try {
    const response = await directFetch("/messages/delete?contact=" + encodeURIComponent(contact), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error(messageTranslate("Chat could not be deleted"));
    if (version === conversationVersion) {
      saveChatDraft(contact, "");
      closeConversation({ focusList: true, preserveDraft: false });
      callStatus.textContent = messageTranslate("Chat deleted from your account.");
    }
    await loadConversations();
  } catch (error) { callStatus.textContent = error.message; }
  finally {
    if (deleteChat && version === conversationVersion && contactInput.value.trim()) deleteChat.disabled = false;
  }
});

let sessionLoading = false;
async function loadCurrentSession() {
  if (sessionLoading || currentEmail) return;
  sessionLoading = true;
  try {
    const response = await directFetch("/auth/session", { credentials: "include", cache: "no-store" });
    if (response.status === 401) { location.replace("./"); return; }
    if (!response.ok) throw new Error(messageTranslate("Your account could not be loaded"));
    const data = await response.json().catch(() => ({}));
    const profile = data?.user || data?.claims || data?.profile || data || {};
    currentEmail = String(profile.email || profile.username || "").toLowerCase();
    if (contactInput.value) loadDirectMessages(true);
  } catch {
    setTimeout(loadCurrentSession, 5000);
  } finally { sessionLoading = false; }
}
loadCurrentSession();
setInterval(() => loadDirectMessages(), 3000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadDirectMessages(); loadConversations(); } });
loadConversations();
setInterval(loadConversations, 15000);

window.addEventListener("danzstak-offline-synced", () => { loadConversations(); loadDirectMessages(true); });
