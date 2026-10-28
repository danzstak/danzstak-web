"use strict";

if (new URLSearchParams(location.search).get("embedded") === "1") {
  document.body.classList.add("embedded-messages");
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
const conversationUsers = document.getElementById("conversationUsers");
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
const conversationMenu = document.getElementById("conversationMenu");
const headerDeleteChat = document.getElementById("headerDeleteChat");
let directContact = "";
let activeContactName = "Contact";
let currentEmail = "";
let loadingMessages = false;
let conversationVersion = 0;
const pendingMessageSends = new Set();
let nextMessageCursor = "";
const shownMessages = new Set();
let cachedConversations = [];
let activeCanContact = false;
let reactionTimer = null;
let selectedMessageMedia = null;
let selectedMessageMediaUrl = "";
function setConversationActionsEnabled(enabled) {
  for (const button of conversationActions) button.disabled = !enabled;
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
  if (!allowed.test(file.type)) { callStatus.textContent = "Choose a photo or video. Standalone audio files are not supported."; return; }
  selectedMessageMedia = file;
  selectedMessageMediaUrl = URL.createObjectURL(file);
  const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
  media.src = selectedMessageMediaUrl;
  media.alt = file.type.startsWith("image/") ? "Photo ready to send" : "";
  if (media.tagName === "VIDEO") { media.controls = true; media.preload = "metadata"; }
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "message-media-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove attachment"); remove.addEventListener("click", clearSelectedMessageMedia);
  messageMediaPreview.append(media, remove); messageMediaPreview.hidden = false;
}

async function uploadSelectedMessageMedia(file) {
  const ticketResponse = await directFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, purpose: "message" }) });
  const ticket = await ticketResponse.json().catch(() => ({}));
  if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "Attachment upload could not start");
  try {
    const upload = await directFetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, Math.max(30000, Math.min(300000, Math.ceil(file.size / 20000))));
    if (!upload.ok) throw new Error("Attachment upload failed");
  } catch (error) {
    if (/taking too long/i.test(error.message)) throw new Error("Attachment upload took too long. Try again on a stronger connection.");
    throw error;
  }
  return { mediaKey: ticket.mediaKey, mediaType: file.type.startsWith("video/") ? "video" : "image" };
}
function labelConversationHeaderActions(name = "") {
  const labels = { phone: "Phone call", video: "Video call", minimize: "Minimize chat", more: "More chat options", close: "Close chat" };
  for (const [key, button] of Object.entries(conversationHeaderActions)) {
    if (!button) continue;
    const label = name ? `${labels[key]} with ${name}` : labels[key];
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
  if (typeof target !== "string" && target.origin !== "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com") throw new Error("Unexpected upload destination");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(String(target), { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error("DanzStak is taking too long to respond. Try again.");
    throw error;
  }
  finally { clearTimeout(timer); }
}
let activeFilter = "all";
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
  if (!response.ok) throw new Error(data.error || "Reaction could not be saved");
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
  input.setAttribute("aria-label", "Edit message text");
  actions.className = "message-edit-actions";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  save.type = "submit";
  save.textContent = "Save";
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
      if (!content) { input.setCustomValidity("Message text cannot be empty"); input.reportValidity(); }
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
      if (!response.ok) throw new Error(data.error || "Message could not be edited");
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
  if (!response.ok) throw new Error(data.error || "Message could not be deleted");
  item.remove();
  callStatus.textContent = scope === "everyone" ? "Message deleted for everyone." : "Message deleted for you.";
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
  addChoice("Delete for me", "me");
  if (message.senderEmail === currentEmail) addChoice("Delete for everyone", "everyone", true);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => palette.remove());
  palette.appendChild(cancel);
  palette.querySelector("button")?.focus();
}

function openMessageReactions(item, message, x, y, focusFirst = false) {
  document.querySelector(".message-reaction-palette")?.remove();
  const palette = document.createElement("div"); palette.className = "message-reaction-palette"; palette.style.left = Math.max(8, Math.min(x - 110, innerWidth - 248)) + "px"; palette.style.top = Math.max(8, y - 64) + "px";
  for (const emoji of ["👍","❤️","😂","😮","😢","😡"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.setAttribute("aria-label", (message.myReaction === emoji ? "Remove " : "React with ") + emoji); button.classList.toggle("selected", message.myReaction === emoji); button.addEventListener("click", async () => { button.disabled = true; try { await saveMessageReaction(item, message, emoji); palette.remove(); } catch (error) { callStatus.textContent = error.message; button.disabled = false; } }); palette.appendChild(button); }
  if (message.senderEmail === currentEmail && message.content) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "message-edit-choice";
    edit.textContent = "✎ Edit";
    edit.setAttribute("aria-label", "Edit message");
    edit.addEventListener("click", () => openMessageEditor(item, message));
    palette.appendChild(edit);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "message-delete-choice";
  remove.textContent = "⌫ Delete";
  remove.setAttribute("aria-label", "Delete message");
  remove.addEventListener("click", () => openMessageDeleteChoices(item, message, palette));
  palette.appendChild(remove);
  palette.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); palette.remove(); item.focus(); } });
  document.body.appendChild(palette);
  if (focusFirst) palette.querySelector("button")?.focus();
}

function openConversation(conversation) {
  closeConversation();
  document.body.classList.add("is-conversation-open");
  if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: true }, location.origin);
  contactInput.value = conversation.contactEmail;
  window.danzstakActiveContactName = conversation.name || "DanzStak member";
  activeCanContact = conversation.canContact !== false;
  setConversationActionsEnabled(activeCanContact);
  directContact = "";
  conversationHeader.hidden = false;
  conversationName.textContent = conversation.name || "DanzStak member";
  labelConversationHeaderActions(conversationName.textContent);
  if (conversationPresence) conversationPresence.hidden = conversation.online !== true;
  activeContactName = conversation.name || "Contact";
  if (deleteChat) deleteChat.disabled = false;
  conversationAvatar.textContent = (conversation.name || "DanzStak member").charAt(0).toUpperCase();
  if (conversation.picture) { conversationAvatar.style.backgroundImage = `url("${conversation.picture}")`; conversationAvatar.textContent = ""; }
  else conversationAvatar.style.backgroundImage = "";
  restoreChatDraft(contactInput.value);
  loadDirectMessages(true);
}

function closeConversation({ focusList = false, preserveDraft = true } = {}) {
  const closingContact = contactInput.value.trim().toLowerCase();
  if (closingContact && preserveDraft) saveChatDraft(closingContact, messageInput.value);
  conversationVersion += 1;
  loadingMessages = false;
  document.querySelector(".message-reaction-palette")?.remove();
  closeConversationMenu();
  conversationHeader.hidden = true;
  labelConversationHeaderActions();
  if (conversationPresence) conversationPresence.hidden = true;
  contactInput.value = "";
  directContact = "";
  activeContactName = "Contact";
  activeCanContact = false;
  setConversationActionsEnabled(false);
  nextMessageCursor = "";
  shownMessages.clear();
  messageList.replaceChildren();
  messageInput.value = "";
  clearSelectedMessageMedia();
  messageInput.disabled = true;
  sendButton.disabled = true;
  if (deleteChat) deleteChat.disabled = true;
  document.body.classList.remove("is-conversation-open");
  if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: false }, location.origin);
  if (focusList) conversationUsers?.querySelector(".conversation-user")?.focus();
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
    text.textContent = message.content;
    item.appendChild(text);
  }
  if (message.mediaUrl && ["image", "video"].includes(message.mediaType)) {
    const media = document.createElement(message.mediaType === "video" ? "video" : "img");
    media.className = "message-attachment"; media.src = message.mediaUrl;
    if (message.mediaType === "image") { media.alt = mine ? "Photo you sent" : `Photo from ${activeContactName}`; media.loading = "lazy"; }
    else { media.controls = true; media.playsInline = true; media.preload = "metadata"; media.setAttribute("aria-label", mine ? "Video you sent" : `Video from ${activeContactName}`); }
    item.prepend(media);
  }
  const sharedUrl = firstSafeMessageUrl(message.content);
  if (sharedUrl) item.appendChild(messageLinkPreview(sharedUrl));
  item.setAttribute("aria-label", `${mine ? "You" : activeContactName}: ${message.content}. Long press or press Shift F10 for reactions${mine && message.content ? " and editing" : ""}.`);
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = (mine ? "You" : activeContactName) + " · " + new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (message.editedAt ? " · edited" : "");
  if (mine) {
    const receipt = document.createElement("span");
    receipt.className = message.read ? "message-receipt is-read" : "message-receipt";
    receipt.textContent = message.read ? "✓✓" : "✓";
    receipt.setAttribute("aria-label", message.read ? "Read" : "Delivered");
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
  card.rel = "noopener noreferrer";
  card.setAttribute("aria-label", `Open shared link on ${url.hostname}`);
  icon.className = "message-link-icon";
  icon.textContent = "🔗";
  domain.textContent = url.hostname.replace(/^www\./, "");
  detail.textContent = (url.pathname === "/" ? "Open shared link" : url.pathname.replace(/%20/gi, " ").replace(/\/+$/, "").split("/").filter(Boolean).slice(-2).join(" / ")) || "Open shared link";
  copy.append(domain, detail);
  card.append(icon, copy);
  return card;
}

function pendingMessageItem(content, mediaFile) {
  const item = document.createElement("div");
  const text = content || (mediaFile?.type.startsWith("video/") ? "Video" : "Photo");
  const meta = document.createElement("span");
  item.className = "message mine message-pending";
  item.textContent = text;
  item.setAttribute("aria-label", `You: ${text}. Sending.`);
  meta.className = "message-meta";
  meta.textContent = "Sending…";
  item.appendChild(meta);
  return item;
}

function renderEarlierMessagesButton() {
  messageList.querySelector(".load-earlier-messages")?.remove();
  if (!nextMessageCursor) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "load-earlier-messages";
  button.textContent = "Load earlier messages";
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
  if (button) { button.disabled = true; button.textContent = "Loading…"; }
  const previousHeight = messageList.scrollHeight;
  try {
    const response = await directFetch("/messages?contact=" + encodeURIComponent(contact) + "&before=" + encodeURIComponent(cursor), { credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (version !== conversationVersion) return;
    if (!response.ok) throw new Error(data.error || "Earlier messages could not be loaded");
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
    if (button) { button.disabled = false; button.textContent = "Try loading earlier messages again"; }
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
  try {
    const response = await directFetch("/messages?read=1&contact=" + encodeURIComponent(contact), { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (version !== conversationVersion) return;
    if (!response.ok) throw new Error(data.error || "Messages could not be loaded");
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
    callStatus.textContent = activeCanContact ? "You can message " + activeContactName + " directly." : "Saved chat. Become friends or join the same group to send new messages or call.";
  } catch (error) {
    if (version === conversationVersion) callStatus.textContent = error.message || "Messages could not be loaded";
  } finally { if (version === conversationVersion) loadingMessages = false; }
}

let loadingConversations = false;
async function loadConversations() {
  if (document.hidden || loadingConversations) return;
  loadingConversations = true;
  try {
    const results = await Promise.allSettled([
      directFetch("/conversations", { credentials: "include", cache: "no-store" }),
      directFetch("/friends", { credentials: "include", cache: "no-store" }),
      directFetch("/calls/directory", { credentials: "include", cache: "no-store" })
    ]);
    const usableResponse = result => result.status === "fulfilled" && result.value.ok ? result.value : null;
    const conversationResponse = usableResponse(results[0]);
    const friendsResponse = usableResponse(results[1]);
    const directoryResponse = usableResponse(results[2]);
    if (!conversationResponse && !friendsResponse && !directoryResponse) throw new Error("Contacts are temporarily unavailable");
    const data = conversationResponse ? await conversationResponse.json() : { conversations: [] };
    const friendsData = friendsResponse ? await friendsResponse.json() : { friends: [] };
    const directoryData = directoryResponse ? await directoryResponse.json() : { users: [] };
    const contacts = new Map();
    for (const conversation of data.conversations || []) {
      if (conversation.contactEmail) contacts.set(conversation.contactEmail.toLowerCase(), conversation);
    }
    for (const friend of friendsData.friends || []) {
      const email = String(friend.email || "").toLowerCase();
      if (!email || contacts.has(email)) continue;
      contacts.set(email, {
        contactEmail: email,
        name: friend.name || "DanzStak member",
        picture: friend.picture || "",
        preview: "Start a conversation",
        updatedAt: "",
        isFriend: true
      });
    }
    for (const member of directoryData.users || []) {
      const email = String(member.email || "").toLowerCase();
      const existing = contacts.get(email);
      if (!email || (!existing && !member.sharedGroup)) continue;
      contacts.set(email, {
        ...(existing || {}),
        contactEmail: email,
        name: existing?.name || member.name || "DanzStak member",
        picture: existing?.picture || member.picture || "",
        preview: existing?.preview || "Shared group member",
        updatedAt: existing?.updatedAt || "",
        sharedGroup: existing?.sharedGroup === true || member.sharedGroup === true,
        online: member.online === true
      });
    }
    cachedConversations = [...contacts.values()];
    conversationUsers.replaceChildren();
    const query = chatSearch?.value.trim().toLowerCase() || "";
    const visible = cachedConversations.filter(item => {
      const matchesSearch = !query || (item.name + " " + item.contactEmail + " " + item.preview).toLowerCase().includes(query);
      const unread = Number(item.unread || 0) > 0;
      const matchesFilter = activeFilter === "all" || (activeFilter === "unread" && unread) || (activeFilter === "groups" && item.sharedGroup);
      return matchesSearch && matchesFilter;
    });
    if (!visible.length) { const empty = document.createElement("p"); empty.className = "chat-note"; empty.textContent = query ? "No friends or chats match your search." : "No friends or saved chats yet."; conversationUsers.appendChild(empty); return; }
    for (const conversation of visible) {
      const row = document.createElement("div"); row.className = "conversation-row";
      const button = document.createElement("button"); button.type = "button"; button.className = "conversation-user";
      const avatarWrap = document.createElement("span"); avatarWrap.className = "conversation-avatar-wrap";
      const avatar = conversation.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "conversation-list-avatar";
      if (conversation.picture) { avatar.src = conversation.picture; avatar.alt = ""; } else { avatar.textContent = (conversation.name || "DanzStak member").charAt(0).toUpperCase(); }
      avatarWrap.appendChild(avatar);
      if (conversation.online === true) {
        const onlineDot = document.createElement("span"); onlineDot.className = "conversation-online-dot"; onlineDot.setAttribute("role", "img"); onlineDot.setAttribute("aria-label", "Online"); onlineDot.title = "Online"; avatarWrap.appendChild(onlineDot);
      }
      const copy = document.createElement("span"); copy.className = "conversation-copy";
      const name = document.createElement("strong"); name.textContent = conversation.name || "DanzStak member";
      const preview = document.createElement("small"); preview.textContent = conversation.preview || "Open chat";
      const unread = Number(conversation.unread || 0) > 0;
      button.classList.toggle("is-unread", Boolean(unread));
      const meta = document.createElement("span"); meta.className = "conversation-list-meta";
      const time = document.createElement("time"); time.textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
      meta.appendChild(time);
      if (unread) {
        const badge = document.createElement("span");
        badge.className = "conversation-unread";
        badge.textContent = Number(conversation.unread) > 99 ? "99+" : String(Number(conversation.unread));
        badge.setAttribute("aria-label", `${conversation.unread} unread message${Number(conversation.unread) === 1 ? "" : "s"}`);
        meta.appendChild(badge);
      }
      copy.append(name, preview); button.append(avatarWrap, copy, meta);
      button.addEventListener("click", () => { conversation.unread = 0; markChatRead(conversation.contactEmail, conversation.updatedAt || new Date().toISOString()); openConversation(conversation); });
      const calls = document.createElement("div"); calls.className = "conversation-call-actions";
      for (const [label, targetId] of [["📞", "startPhone"], ["📹", "startVideo"]]) {
        const call = document.createElement("button"), publicName = conversation.name || "DanzStak member"; call.type = "button"; call.className = "conversation-call"; call.textContent = label; call.title = `${targetId === "startPhone" ? "Phone" : "Video"} call with ${publicName}`; call.setAttribute("aria-label", call.title);
        call.disabled = conversation.canContact === false;
        call.addEventListener("click", () => { openConversation(conversation); document.getElementById(targetId)?.click(); });
        calls.appendChild(call);
      }
      row.append(button, calls); conversationUsers.appendChild(row);
    }
    const requested = contactInput.value.trim().toLowerCase();
    if (requested && conversationHeader.hidden) openConversation(cachedConversations.find(item => item.contactEmail === requested) || { contactEmail: requested, name: "DanzStak member", picture: "" });
  } catch {
    if (!cachedConversations.length) {
      conversationUsers.replaceChildren();
      const unavailable = document.createElement("p"); unavailable.className = "chat-note"; unavailable.textContent = "Contacts are temporarily unavailable. Retrying automatically…"; conversationUsers.appendChild(unavailable);
    }
  } finally { loadingConversations = false; }
}

chatSearch?.addEventListener("input", loadConversations);
document.getElementById("newChat")?.addEventListener("click", () => {
  activeFilter = "all";
  chatFilters.forEach(item => {
    const selected = item.dataset.chatFilter === "all";
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
chatFilters.forEach(button => button.addEventListener("click", () => { chatFilters.forEach(item => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1; }); activeFilter = button.dataset.chatFilter; loadConversations(); }));
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
document.getElementById("minimizeConversation")?.addEventListener("click", () => { document.body.classList.remove("is-conversation-open"); if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-minimize" }, location.origin); });
conversationHeaderActions.more?.addEventListener("click", event => {
  event.stopPropagation();
  const opening = conversationMenu.hidden;
  conversationMenu.hidden = !opening;
  conversationHeaderActions.more.setAttribute("aria-expanded", String(opening));
  if (opening) headerDeleteChat?.focus();
});
headerDeleteChat?.addEventListener("click", () => { closeConversationMenu(); deleteChat?.click(); });
conversationMenu?.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); closeConversationMenu({ restoreFocus: true }); } });
document.addEventListener("click", event => { if (!conversationMenu?.hidden && !conversationHeader.contains(event.target)) closeConversationMenu(); });
document.getElementById("closeConversation")?.addEventListener("click", () => closeConversation({ focusList: true }));

window.addEventListener("message", event => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === "danzstak-chat-hidden") document.body.classList.remove("is-conversation-open"); });

onlineUsers?.addEventListener("click", event => {
  if (!event.target.closest("button")) return;
  setTimeout(() => loadDirectMessages(true), 0);
});

textButton?.addEventListener("click", event => {
  event.stopImmediatePropagation();
  const email = contactInput.value.trim().toLowerCase();
  if (!email) { callStatus.textContent = "Select a friend or group member first."; return; }
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
  const version = conversationVersion;
  const mediaFile = selectedMessageMedia;
  const pendingItem = pendingMessageItem(content, mediaFile);
  pendingMessageSends.add(version);
  sendButton.disabled = true;
  messageList.appendChild(pendingItem);
  messageList.scrollTop = messageList.scrollHeight;
  if (content && messageInput.value.trim() === content) messageInput.value = "";
  try {
    if (mediaFile) callStatus.textContent = "Uploading attachment…";
    const attachment = mediaFile ? await uploadSelectedMessageMedia(mediaFile) : {};
    const response = await directFetch("/messages", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientEmail, content, ...attachment }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Message could not be sent");
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
      if (content && !messageInput.value.trim()) messageInput.value = content;
      callStatus.textContent = `${error.message}. Your message is still in the composer.`;
      messageInput.focus();
    }
  }
  finally { pendingMessageSends.delete(version); if (version === conversationVersion) sendButton.disabled = !activeCanContact; }
}, true);

messageMedia?.addEventListener("change", () => previewSelectedMessageMedia(messageMedia.files?.[0]));
messageCamera?.addEventListener("change", () => previewSelectedMessageMedia(messageCamera.files?.[0]));

deleteChat?.addEventListener("click", async () => {
  const contact = contactInput.value.trim().toLowerCase();
  if (!contact || !confirm("Delete this chat from your account? The other person will keep their message history.")) return;
  const version = conversationVersion;
  deleteChat.disabled = true;
  try {
    const response = await directFetch("/messages/delete?contact=" + encodeURIComponent(contact), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error("Chat could not be deleted");
    if (version === conversationVersion) {
      saveChatDraft(contact, "");
      closeConversation({ focusList: true, preserveDraft: false });
      callStatus.textContent = "Chat deleted from your account.";
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
    if (!response.ok) throw new Error("Your account could not be loaded");
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
