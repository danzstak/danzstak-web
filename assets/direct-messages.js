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
let activeFilter = "all";

function openMessageReactions(item, x, y) {
  document.querySelector(".message-reaction-palette")?.remove();
  const palette = document.createElement("div"); palette.className = "message-reaction-palette"; palette.style.left = Math.max(8, Math.min(x - 110, innerWidth - 248)) + "px"; palette.style.top = Math.max(8, y - 64) + "px";
  for (const emoji of ["👍","❤️","😂","😮","😢","😡"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.addEventListener("click", () => { let badge = item.querySelector(".message-reaction"); if (!badge) { badge = document.createElement("span"); badge.className = "message-reaction"; item.appendChild(badge); } badge.textContent = emoji; palette.remove(); }); palette.appendChild(button); }
  document.body.appendChild(palette);
}

function openConversation(conversation) {
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
  const contact = contactInput?.value.trim().toLowerCase();
  if (!contact || loadingMessages) return;
  if (contact !== directContact) { directContact = contact; reset = true; }
  loadingMessages = true;
  try {
    const response = await fetch(directApi + "/messages?contact=" + encodeURIComponent(contact), { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (reset) { shownMessages.clear(); messageList.replaceChildren(); }
    for (const message of data.messages || []) {
      if (shownMessages.has(message.messageId)) continue;
      shownMessages.add(message.messageId);
      messageList.appendChild(directMessageItem(message));
    }
    messageList.scrollTop = messageList.scrollHeight;
    messageInput.disabled = false;
    sendButton.disabled = false;
    callStatus.textContent = "You can message " + contact + " directly.";
  } finally { loadingMessages = false; }
}

async function loadConversations() {
  try {
    const response = await fetch(directApi + "/conversations", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    cachedConversations = data.conversations || [];
    conversationUsers.replaceChildren();
    const query = chatSearch?.value.trim().toLowerCase() || "";
    const visible = cachedConversations.filter(item => activeFilter === "all" && (!query || (item.name + " " + item.contactEmail + " " + item.preview).toLowerCase().includes(query)));
    if (!visible.length) { const empty = document.createElement("p"); empty.className = "chat-note"; empty.textContent = query ? "No chats match your search." : "No saved chats yet."; conversationUsers.appendChild(empty); return; }
    for (const conversation of visible) {
      const row = document.createElement("div"); row.className = "conversation-row";
      const button = document.createElement("button"); button.type = "button"; button.className = "conversation-user";
      const avatar = conversation.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "conversation-list-avatar";
      if (conversation.picture) { avatar.src = conversation.picture; avatar.alt = ""; } else { avatar.textContent = (conversation.name || conversation.contactEmail).charAt(0).toUpperCase(); }
      const copy = document.createElement("span"); copy.className = "conversation-copy";
      const name = document.createElement("strong"); name.textContent = conversation.name || conversation.contactEmail;
      const preview = document.createElement("small"); preview.textContent = conversation.preview || "Open chat";
      const time = document.createElement("time"); time.textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
      copy.append(name, preview); button.append(avatar, copy, time);
      button.addEventListener("click", () => openConversation(conversation));
      const calls = document.createElement("div"); calls.className = "conversation-call-actions";
      for (const [label, targetId] of [["☎", "startPhone"], ["▣", "startVideo"]]) {
        const call = document.createElement("button"); call.type = "button"; call.className = "conversation-call"; call.textContent = label; call.title = targetId === "startPhone" ? "Phone call" : "Video call";
        call.addEventListener("click", () => { contactInput.value = conversation.contactEmail; document.getElementById(targetId)?.click(); });
        calls.appendChild(call);
      }
      row.append(button, calls); conversationUsers.appendChild(row);
    }
    const requested = contactInput.value.trim().toLowerCase();
    if (requested && conversationHeader.hidden) openConversation(cachedConversations.find(item => item.contactEmail === requested) || { contactEmail: requested, name: requested.split("@")[0], picture: "" });
  } catch { /* Retry on the next refresh. */ }
}

chatSearch?.addEventListener("input", loadConversations);
document.querySelectorAll("[data-chat-filter]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-chat-filter]").forEach(item => item.classList.toggle("active", item === button)); activeFilter = button.dataset.chatFilter; loadConversations(); }));
document.getElementById("headerPhone")?.addEventListener("click", () => document.getElementById("startPhone")?.click());
document.getElementById("headerVideo")?.addEventListener("click", () => document.getElementById("startVideo")?.click());
document.getElementById("closeConversation")?.addEventListener("click", () => { conversationHeader.hidden = true; contactInput.value = ""; directContact = ""; messageInput.disabled = true; sendButton.disabled = true; });
for (const emoji of ["😀","😂","😍","❤️","👍","🔥","🎉","😢","😮","🙏","👏","🎵"]) { const button = document.createElement("button"); button.type = "button"; button.textContent = emoji; button.addEventListener("click", () => { messageInput.value += emoji; emojiPalette.hidden = true; messageInput.focus(); }); emojiPalette.appendChild(button); }
emojiButton?.addEventListener("click", () => { emojiPalette.hidden = !emojiPalette.hidden; });

onlineUsers?.addEventListener("click", event => {
  if (!event.target.closest("button")) return;
  setTimeout(() => loadDirectMessages(true), 0);
});

textButton?.addEventListener("click", event => {
  event.stopImmediatePropagation();
  loadDirectMessages(true);
}, true);

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
  if (!contact || !confirm("Delete this saved chat? This removes the message history for both users.")) return;
  deleteChat.disabled = true;
  try {
    const response = await fetch(directApi + "/messages/delete?contact=" + encodeURIComponent(contact), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error("Chat could not be deleted");
    shownMessages.clear(); messageList.replaceChildren(); contactInput.value = ""; directContact = ""; messageInput.disabled = true; sendButton.disabled = true;
    callStatus.textContent = "Chat deleted.";
    await loadConversations();
  } catch (error) { callStatus.textContent = error.message; }
  finally { deleteChat.disabled = false; }
});

fetch(directApi + "/auth/session", { credentials: "include", cache: "no-store" })
  .then(response => response.ok ? response.json() : null)
  .then(data => { const profile = data?.user || data?.claims || data?.profile || data || {}; currentEmail = String(profile.email || profile.username || "").toLowerCase(); if (contactInput.value) loadDirectMessages(true); });
setInterval(() => loadDirectMessages(), 3000);
loadConversations();
setInterval(loadConversations, 15000);
