"use strict";

if (new URLSearchParams(location.search).get("embedded") === "1") {
  document.body.classList.add("embedded-messages");
}

const directApi = "https://api.danzstak.com";
const contactInput = document.getElementById("contactEmail");
const onlineUsers = document.getElementById("onlineUsers");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messageList = document.getElementById("messageList");
const sendButton = messageForm?.querySelector('button[type="submit"]');
const textButton = document.getElementById("startText");
const callStatus = document.getElementById("callStatus");
const conversationUsers = document.getElementById("conversationUsers");
const deleteChat = document.getElementById("deleteChat");
const chatSearch = document.getElementById("chatSearch");
const conversationHeader = document.getElementById("conversationHeader");
const conversationName = document.getElementById("conversationName");
const conversationAvatar = document.getElementById("conversationAvatar");
const emojiButton = document.getElementById("emojiButton");
const emojiPalette = document.getElementById("emojiPalette");
let directContact = "";
let currentEmail = "";
let loadingMessages = false;
const shownMessages = new Set();
let cachedConversations = [];
let reactionTimer = null;
async function directFetch(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(directApi + path, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
let activeFilter = "all";
const chatReadKey = "danzstak_chat_read";

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

function openMessageReactions(item, x, y) {
  document.querySelector(".message-reaction-palette")?.remove();
  const palette = document.createElement("div"); palette.className = "message-reaction-palette"; palette.style.left = Math.max(8, Math.min(x - 110, innerWidth - 248)) + "px"; palette.style.top = Math.max(8, y - 64) + "px";
  for (const emoji of ["👍","❤️","😂","😮","😢","😡"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.setAttribute("aria-label", "React with " + emoji); button.addEventListener("click", () => { let badge = item.querySelector(".message-reaction"); if (!badge) { badge = document.createElement("span"); badge.className = "message-reaction"; item.appendChild(badge); } badge.textContent = emoji; palette.remove(); }); palette.appendChild(button); }
  document.body.appendChild(palette);
}

function openConversation(conversation) {
  document.body.classList.add("is-conversation-open");
  if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: true }, location.origin);
  contactInput.value = conversation.contactEmail;
  directContact = "";
  conversationHeader.hidden = false;
  conversationName.textContent = conversation.name || conversation.contactEmail;
  conversationAvatar.textContent = (conversation.name || conversation.contactEmail).charAt(0).toUpperCase();
  if (conversation.picture) { conversationAvatar.style.backgroundImage = `url("${conversation.picture}")`; conversationAvatar.textContent = ""; }
  else conversationAvatar.style.backgroundImage = "";
  loadDirectMessages(true);
}

function directMessageItem(message) {
  const mine = message.senderEmail === currentEmail;
  const item = document.createElement("div");
  item.className = "message" + (mine ? " mine" : "");
  item.textContent = message.content;
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = (mine ? "You" : message.senderEmail) + " · " + new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  item.appendChild(meta);
  item.addEventListener("pointerdown", event => { reactionTimer = setTimeout(() => openMessageReactions(item, event.clientX, event.clientY), 550); });
  for (const type of ["pointerup","pointercancel","pointerleave"]) item.addEventListener(type, () => { clearTimeout(reactionTimer); reactionTimer = null; });
  item.addEventListener("contextmenu", event => { event.preventDefault(); clearTimeout(reactionTimer); openMessageReactions(item, event.clientX, event.clientY); });
  return item;
}

async function loadDirectMessages(reset = false) {
  if (!document.body.classList.contains("is-conversation-open")) return;
  if (document.hidden && !reset) return;
  const contact = contactInput?.value.trim().toLowerCase();
  if (!contact || loadingMessages) return;
  if (contact !== directContact) { directContact = contact; reset = true; }
  loadingMessages = true;
  try {
    const response = await fetch(directApi + "/messages?read=1&contact=" + encodeURIComponent(contact), { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const distanceFromBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight;
    const followNewest = reset || distanceFromBottom < 80;
    if (reset) { shownMessages.clear(); messageList.replaceChildren(); }
    let appended = 0;
    for (const message of data.messages || []) {
      if (shownMessages.has(message.messageId)) continue;
      shownMessages.add(message.messageId);
      messageList.appendChild(directMessageItem(message));
      appended += 1;
    }
    const receivedMessages = data.messages || [];
    const newest = receivedMessages.length ? receivedMessages[receivedMessages.length - 1].createdAt : "";
    markChatRead(contact, newest || new Date().toISOString());
    if (followNewest && appended) messageList.scrollTop = messageList.scrollHeight;
    messageInput.disabled = false;
    sendButton.disabled = false;
    callStatus.textContent = "You can message " + contact + " directly.";
  } finally { loadingMessages = false; }
}

async function loadConversations() {
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
        name: friend.name || email,
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
        name: existing?.name || member.name || email.split("@")[0],
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
      const matchesFilter = activeFilter === "all" || (activeFilter === "unread" && unread) || (["groups", "communities"].includes(activeFilter) && item.sharedGroup);
      return matchesSearch && matchesFilter;
    });
    if (!visible.length) { const empty = document.createElement("p"); empty.className = "chat-note"; empty.textContent = query ? "No friends or chats match your search." : "No friends or saved chats yet."; conversationUsers.appendChild(empty); return; }
    for (const conversation of visible) {
      const row = document.createElement("div"); row.className = "conversation-row";
      const button = document.createElement("button"); button.type = "button"; button.className = "conversation-user";
      const avatar = conversation.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "conversation-list-avatar";
      if (conversation.picture) { avatar.src = conversation.picture; avatar.alt = ""; } else { avatar.textContent = (conversation.name || conversation.contactEmail).charAt(0).toUpperCase(); }
      const copy = document.createElement("span"); copy.className = "conversation-copy";
      const name = document.createElement("strong"); name.textContent = conversation.name || conversation.contactEmail;
      const preview = document.createElement("small"); preview.textContent = conversation.preview || "Open chat";
      const unread = Number(conversation.unread || 0) > 0;
      button.classList.toggle("is-unread", Boolean(unread));
      const time = document.createElement("time"); time.textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
      copy.append(name, preview); button.append(avatar, copy, time);
      button.addEventListener("click", () => { markChatRead(conversation.contactEmail, conversation.updatedAt || new Date().toISOString()); openConversation(conversation); });
      const calls = document.createElement("div"); calls.className = "conversation-call-actions";
      for (const [label, targetId] of [["☎", "startPhone"], ["▣", "startVideo"]]) {
        const call = document.createElement("button"); call.type = "button"; call.className = "conversation-call"; call.textContent = label; call.title = targetId === "startPhone" ? "Phone call" : "Video call"; call.setAttribute("aria-label", call.title);
        call.addEventListener("click", () => { contactInput.value = conversation.contactEmail; document.getElementById(targetId)?.click(); });
        calls.appendChild(call);
      }
      row.append(button, calls); conversationUsers.appendChild(row);
    }
    const requested = contactInput.value.trim().toLowerCase();
    if (requested && conversationHeader.hidden) openConversation(cachedConversations.find(item => item.contactEmail === requested) || { contactEmail: requested, name: requested.split("@")[0], picture: "" });
  } catch {
    if (!cachedConversations.length) {
      conversationUsers.replaceChildren();
      const unavailable = document.createElement("p"); unavailable.className = "chat-note"; unavailable.textContent = "Contacts are temporarily unavailable. Retrying automatically…"; conversationUsers.appendChild(unavailable);
    }
  }
}

chatSearch?.addEventListener("input", loadConversations);
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
document.getElementById("closeConversation")?.addEventListener("click", () => { conversationHeader.hidden = true; contactInput.value = ""; directContact = ""; messageInput.disabled = true; sendButton.disabled = true; document.body.classList.remove("is-conversation-open"); if (window.parent !== window) window.parent.postMessage({ type: "danzstak-chat-view", open: false }, location.origin); });
for (const emoji of ["😀","😂","😍","❤️","👍","🔥","🎉","😢","😮","🙏","👏","🎵"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.setAttribute("aria-label", "Insert " + emoji); button.addEventListener("click", () => { messageInput.value += emoji; emojiPalette.hidden = true; messageInput.focus(); }); emojiPalette.appendChild(button); }
emojiButton?.addEventListener("click", () => { emojiPalette.hidden = !emojiPalette.hidden; });
window.addEventListener("message", event => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === "danzstak-chat-hidden") document.body.classList.remove("is-conversation-open"); });

onlineUsers?.addEventListener("click", event => {
  if (!event.target.closest("button")) return;
  setTimeout(() => loadDirectMessages(true), 0);
});

textButton?.addEventListener("click", event => {
  event.stopImmediatePropagation();
  const email = contactInput.value.trim().toLowerCase();
  if (!email) { callStatus.textContent = "Select a friend or group member first."; return; }
  openConversation(cachedConversations.find(item => item.contactEmail === email) || { contactEmail: email, name: email.split("@")[0], picture: "" });
}, true);

window.addEventListener("danzstak-contact-selected", event => {
  const selected = event.detail;
  if (!selected?.contactEmail) return;
  openConversation(selected);
});

messageForm?.addEventListener("submit", async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const content = messageInput.value.trim();
  const recipientEmail = contactInput.value.trim().toLowerCase();
  if (!content || !recipientEmail) return;
  sendButton.disabled = true;
  try {
    const response = await fetch(directApi + "/messages", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientEmail, content }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Message could not be sent");
    messageInput.value = "";
    await loadDirectMessages();
    await loadConversations();
  } catch (error) { callStatus.textContent = error.message; }
  finally { sendButton.disabled = false; }
}, true);

deleteChat?.addEventListener("click", async () => {
  const contact = contactInput.value.trim().toLowerCase();
  if (!contact || !confirm("Delete this chat from your account? The other person will keep their message history.")) return;
  deleteChat.disabled = true;
  try {
    const response = await fetch(directApi + "/messages/delete?contact=" + encodeURIComponent(contact), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error("Chat could not be deleted");
    shownMessages.clear(); messageList.replaceChildren(); contactInput.value = ""; directContact = ""; messageInput.disabled = true; sendButton.disabled = true;
    callStatus.textContent = "Chat deleted from your account.";
    await loadConversations();
  } catch (error) { callStatus.textContent = error.message; }
  finally { deleteChat.disabled = false; }
});

fetch(directApi + "/auth/session", { credentials: "include", cache: "no-store" })
  .then(response => response.ok ? response.json() : null)
  .then(data => { const profile = data?.user || data?.claims || data?.profile || data || {}; currentEmail = String(profile.email || profile.username || "").toLowerCase(); if (contactInput.value) loadDirectMessages(true); });
setInterval(() => loadDirectMessages(), 3000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadDirectMessages(); loadConversations(); } });
loadConversations();
setInterval(loadConversations, 15000);
