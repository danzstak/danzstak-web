"use strict";

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
let directContact = "";
let currentEmail = "";
let loadingMessages = false;
const shownMessages = new Set();

function directMessageItem(message) {
  const mine = message.senderEmail === currentEmail;
  const item = document.createElement("div");
  item.className = "message" + (mine ? " mine" : "");
  item.textContent = message.content;
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = (mine ? "You" : message.senderEmail) + " · " + new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  item.appendChild(meta);
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
    conversationUsers.replaceChildren();
    if (!(data.conversations || []).length) { const empty = document.createElement("p"); empty.className = "chat-note"; empty.textContent = "No saved chats yet."; conversationUsers.appendChild(empty); return; }
    for (const conversation of data.conversations) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-user";
      const name = document.createElement("strong"); name.textContent = conversation.contactEmail;
      const preview = document.createElement("small"); preview.textContent = conversation.preview || "Open chat";
      button.append(name, preview);
      button.addEventListener("click", () => { contactInput.value = conversation.contactEmail; directContact = ""; loadDirectMessages(true); });
      conversationUsers.appendChild(button);
    }
  } catch { /* Retry on the next refresh. */ }
}

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
