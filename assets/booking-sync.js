"use strict";

(() => {
  const API = "https://api.danzstak.com";
  const list = document.getElementById("conversationUsers");
  const search = document.getElementById("chatSearch");
  const messageList = document.getElementById("messageList");
  const header = document.getElementById("conversationHeader");
  const name = document.getElementById("conversationName");
  const avatar = document.getElementById("conversationAvatar");
  const presence = document.getElementById("conversationPresence");
  const form = document.getElementById("messageForm");
  let loading = false;

  const text = value => document.createTextNode(String(value || ""));
  const formatDate = value => {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  };
  const labelFor = action => ({ interested: "Interested", offer_date: "Offered a date", pass: "Passed", reply: "Reply" }[action] || "Reply");

  function showEmpty(message) {
    const note = document.createElement("p");
    note.className = "chat-note";
    note.append(text(message));
    list.replaceChildren(note);
  }

  function renderThread(thread) {
    document.body.classList.add("is-conversation-open");
    document.body.dataset.syncScreen = "bookings";
    header.hidden = false;
    name.removeAttribute("href");
    name.textContent = thread.message.venueName || "Venue";
    avatar.removeAttribute("href");
    avatar.textContent = (thread.message.venueName || "V").charAt(0).toUpperCase();
    if (presence) presence.hidden = true;
    if (form) form.hidden = true;
    messageList.replaceChildren();

    const sent = document.createElement("article");
    sent.className = "message mine booking-message";
    const sentHeading = document.createElement("strong");
    sentHeading.append(text(thread.message.subject || "Booking pitch"));
    const sentCopy = document.createElement("p");
    sentCopy.append(text(`Pitch ${thread.message.status || "sent"}`));
    const sentTime = document.createElement("time");
    sentTime.append(text(formatDate(thread.message.sentAt || thread.message.createdAt)));
    sent.append(sentHeading, sentCopy, sentTime);
    messageList.append(sent);

    for (const reply of thread.replies) {
      const bubble = document.createElement("article");
      bubble.className = "message booking-message";
      const replyHeading = document.createElement("strong");
      replyHeading.append(text(labelFor(reply.action)));
      const replyCopy = document.createElement("p");
      replyCopy.append(text(reply.content));
      bubble.append(replyHeading, replyCopy);
      if (reply.proposedDate) {
        const offered = document.createElement("p");
        offered.className = "booking-date-offer";
        offered.append(text(`Proposed date: ${reply.proposedDate}`));
        bubble.append(offered);
      }
      const replyTime = document.createElement("time");
      replyTime.append(text(formatDate(reply.createdAt)));
      bubble.append(replyTime);
      messageList.append(bubble);
    }

    const boundary = document.createElement("p");
    boundary.className = "system-message";
    boundary.append(text("This venue replied through its secure DanzStak link. Reply by email for now; sending email from SYNC is not enabled yet."));
    messageList.append(boundary);
    messageList.scrollTop = messageList.scrollHeight;
  }

  function render(data) {
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const replies = Array.isArray(data.replies) ? data.replies : [];
    const query = String(search?.value || "").trim().toLowerCase();
    const threads = messages.map(message => ({
      message,
      replies: replies.filter(reply => reply.outreachId === message.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    })).filter(thread => thread.replies.length && (!query || `${thread.message.venueName} ${thread.message.subject} ${thread.replies.map(reply => reply.content).join(" ")}`.toLowerCase().includes(query)));
    list.replaceChildren();
    if (!threads.length) {
      showEmpty(query ? "No booking replies match your search." : "No venue replies yet. Replies to secure booking links appear here.");
      return;
    }
    for (const thread of threads) {
      const row = document.createElement("div");
      row.className = "conversation-row";
      row.dataset.syncSection = "bookings";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-user is-unread";
      const avatarWrap = document.createElement("span");
      avatarWrap.className = "conversation-avatar-wrap";
      const mark = document.createElement("span");
      mark.className = "conversation-list-avatar";
      mark.append(text((thread.message.venueName || "V").charAt(0).toUpperCase()));
      avatarWrap.append(mark);
      const copy = document.createElement("span");
      copy.className = "conversation-copy";
      const venue = document.createElement("strong");
      venue.append(text(thread.message.venueName || "Venue"));
      const preview = document.createElement("small");
      preview.append(text(thread.replies.at(-1)?.content || "Venue replied"));
      copy.append(venue, preview);
      const meta = document.createElement("span");
      meta.className = "conversation-list-meta";
      const time = document.createElement("time");
      time.append(text(formatDate(thread.replies.at(-1)?.createdAt)));
      meta.append(time);
      button.append(avatarWrap, copy, meta);
      button.addEventListener("click", () => renderThread(thread));
      row.append(button);
      list.append(row);
    }
  }

  async function load() {
    if (loading || document.body.dataset.syncScreen !== "bookings") return;
    loading = true;
    list.setAttribute("aria-busy", "true");
    showEmpty("Loading booking replies…");
    try {
      const response = await fetch(`${API}/tour-manager/outreach`, { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Booking replies are temporarily unavailable.");
      render(data);
    } catch (error) {
      showEmpty(error.message || "Booking replies are temporarily unavailable.");
    } finally {
      loading = false;
      list.setAttribute("aria-busy", "false");
    }
  }

  window.danzstakLoadBookingThreads = load;
  window.danzstakLeaveBookingThreads = () => {
    if (form) form.hidden = false;
    name.setAttribute("href", "profile.html");
    avatar.setAttribute("href", "profile.html");
  };
})();
