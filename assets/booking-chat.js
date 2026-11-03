(() => {
  "use strict";
  const api = "https://api.danzstak.com";
  const list = document.getElementById("conversationUsers"), messageList = document.getElementById("messageList"), form = document.getElementById("messageForm"), input = document.getElementById("messageInput"), header = document.getElementById("conversationHeader"), name = document.getElementById("conversationName"), avatar = document.getElementById("conversationAvatar"), presence = document.getElementById("conversationPresence");
  if (!list || !messageList || !form || !input) return;
  let conversations = [], active = null, category = "";
  const escape = value => String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const request = async (path, options = {}) => { const response = await fetch(api + path, { credentials: "include", headers: { "content-type": "application/json", ...(options.headers || {}) }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Booking Chat is unavailable."); return data; };
  const categoryFromFilter = filter => ({ "booking-club": "club", "booking-radio": "radio", "booking-record-store": "record-store" }[filter] || "");
  function ensureCards() {
    list.querySelectorAll("[data-booking-conversation]").forEach(element => element.remove());
    if (!category) return;
    const filtered = conversations.filter(item => item.category === category), fragment = document.createDocumentFragment();
    if (!filtered.length) { const empty = document.createElement("p"); empty.className = "chat-note booking-chat-empty"; empty.dataset.bookingConversation = "empty"; empty.textContent = "No email conversations in this category yet."; fragment.append(empty); }
    for (const item of filtered) { const button = document.createElement("button"); button.type = "button"; button.className = "booking-chat-row"; button.dataset.bookingConversation = item.conversationId; button.innerHTML = `<span class="booking-chat-avatar" aria-hidden="true">${escape(item.organizationName.slice(0, 1).toUpperCase())}</span><span><strong>${escape(item.organizationName)}</strong><small>${escape(item.preview || item.subject || "Booking email")}</small></span>${item.unread ? `<b aria-label="${item.unread} unread">${item.unread}</b>` : ""}`; fragment.append(button); }
    list.prepend(fragment);
  }
  async function loadConversations() { try { const data = await request("/tour-manager/booking-conversations"); conversations = data.conversations || []; ensureCards(); } catch (error) { console.warn(error.message); } }
  function renderMessages(messages) { messageList.innerHTML = messages.length ? messages.map(item => `<article class="message-bubble ${item.direction === "outbound" ? "mine" : "theirs"}"><p>${escape(item.content)}</p><time>${escape(new Date(item.createdAt).toLocaleString())}</time></article>`).join("") : '<p class="system-message">No messages in this booking conversation yet.</p>'; messageList.scrollTop = messageList.scrollHeight; }
  async function openConversation(id) {
    active = conversations.find(item => item.conversationId === id); if (!active) return;
    header.hidden = false; name.textContent = active.organizationName; name.removeAttribute("href"); avatar.textContent = active.organizationName.slice(0, 1).toUpperCase(); avatar.removeAttribute("href"); presence.hidden = false; presence.textContent = `${active.categoryLabel} · Email`; input.disabled = false; form.querySelector("button[type=submit]").disabled = false;
    document.querySelectorAll(".conversation-header-actions button, .message-attach, .message-camera").forEach(element => { element.hidden = true; });
    try { const data = await request(`/tour-manager/booking-messages?conversation=${encodeURIComponent(id)}`); renderMessages(data.messages || []); } catch (error) { messageList.innerHTML = `<p class="system-message">${escape(error.message)}</p>`; }
  }
  document.querySelector(".chat-filters")?.addEventListener("click", event => { const button = event.target.closest("[data-chat-filter]"); if (!button) return; const next = categoryFromFilter(button.dataset.chatFilter); if (!next) { category = ""; active = null; ensureCards(); return; } event.preventDefault(); event.stopImmediatePropagation(); category = next; document.querySelectorAll("[data-chat-filter]").forEach(item => { const selected = item === button; item.classList.toggle("active", selected); item.setAttribute("aria-selected", String(selected)); }); ensureCards(); }, true);
  list.addEventListener("click", event => { const button = event.target.closest("[data-booking-conversation]"); if (!button || button.dataset.bookingConversation === "empty") return; event.preventDefault(); event.stopImmediatePropagation(); openConversation(button.dataset.bookingConversation); }, true);
  form.addEventListener("submit", async event => { if (!active) return; event.preventDefault(); event.stopImmediatePropagation(); const content = input.value.trim(); if (!content) return; input.disabled = true; try { await request("/tour-manager/booking-messages", { method: "POST", body: JSON.stringify({ conversationId: active.conversationId, content }) }); input.value = ""; await openConversation(active.conversationId); } catch (error) { alert(error.message); } finally { input.disabled = false; input.focus(); } }, true);
  document.querySelector(".chat-filters")?.insertAdjacentHTML("beforeend", '<button type="button" data-chat-filter="booking-club" role="tab" aria-selected="false">Clubs</button><button type="button" data-chat-filter="booking-radio" role="tab" aria-selected="false">Radio</button><button type="button" data-chat-filter="booking-record-store" role="tab" aria-selected="false">Stores</button>');
  new MutationObserver(() => { if (category && !list.querySelector("[data-booking-conversation]")) ensureCards(); }).observe(list, { childList: true });
  loadConversations(); setInterval(loadConversations, 30000);
})();
