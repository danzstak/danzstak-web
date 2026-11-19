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
  const callStatus = document.getElementById("callStatus");
  const form = document.getElementById("messageForm");
  const bookingForm = document.createElement("form");
  const bookingInput = document.createElement("textarea");
  const bookingStatus = document.createElement("p");
  const bookingSend = document.createElement("button");
  const requested = new URLSearchParams(location.search);
  const requestedSection = requested.get("section") || "";
  let requestedOutreachId = /^[a-zA-Z0-9_-]{16,100}$/.test(requested.get("outreach") || "") ? requested.get("outreach") : "";
  if (requested.has("section") || requested.has("outreach")) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("section");
    cleanUrl.searchParams.delete("outreach");
    history.replaceState(history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }
  let loading = false;

  bookingForm.id = "bookingReplyForm";
  bookingForm.className = "booking-reply-composer";
  bookingForm.hidden = true;
  bookingInput.id = "bookingReplyInput";
  bookingInput.maxLength = 4000;
  bookingInput.rows = 2;
  bookingInput.required = true;
  bookingInput.placeholder = "Reply to this venue by email";
  bookingInput.setAttribute("aria-label", "Reply to this venue by email");
  bookingStatus.className = "booking-reply-status";
  bookingStatus.setAttribute("role", "status");
  bookingStatus.setAttribute("aria-live", "polite");
  bookingSend.type = "submit";
  bookingSend.className = "message-send";
  bookingSend.textContent = "Send";
  bookingSend.setAttribute("aria-label", "Send booking reply by email");
  bookingForm.append(bookingInput, bookingSend, bookingStatus);
  form?.before(bookingForm);

  const text = value => document.createTextNode(String(value || ""));
  const formatDate = value => {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  };
  const labelFor = action => ({ interested: "Interested", offer_date: "Offered a date", confirm_date: "Confirmed a date", pass: "Passed", reply: "Reply" }[action] || "Reply");

  async function useDateOffer(button, outreachId, reply) {
    const confirmed = reply.action === "confirm_date";
    if (confirmed) {
      const approved = await (window.danzstakConfirm?.(`Record ${reply.proposedDate} as a confirmed show? The venue's written reply will be saved as confirmation evidence.`, { title: "Confirm this show", confirmLabel: "Add confirmed show" }) ?? Promise.resolve(window.confirm(`Record ${reply.proposedDate} as a confirmed show?`)));
      if (!approved) return;
    }
    button.disabled = true;
    bookingStatus.textContent = confirmed ? "Adding the confirmed show to Tour Manager…" : "Adding the proposed date to Tour Manager…";
    try {
      const response = await fetch(`${API}/tour-manager/outreach/use-date`, { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ outreachId, replyId: reply.id, confirm: confirmed }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The proposed date could not be added to Tour Manager.");
      button.textContent = confirmed ? "Confirmed show added" : "Added to Tour";
      bookingStatus.replaceChildren(text(confirmed ? `${data.venueName || "Venue"} · ${data.proposedDate} added as a confirmed show with the venue's written reply saved as evidence. ` : `${data.venueName || "Venue"} · ${data.proposedDate} added as Date proposed. Confirm it only after you have written agreement. `));
      const link = document.createElement("a"); link.href = "booking-selections.html#tourManager"; link.textContent = "Open Tour Manager"; bookingStatus.append(link);
    } catch (error) {
      button.disabled = false;
      bookingStatus.textContent = error.message || "The proposed date could not be added to Tour Manager.";
    }
  }

  async function useReplyStatus(button, outreachId, reply) {
    const interested = reply.action === "interested";
    const nextStatus = interested ? "Interested" : "Declined";
    const approved = await (window.danzstakConfirm?.(`Mark ${button.dataset.venueName || "this venue"} as ${nextStatus}? The venue's written reply will stay in this booking thread.`, { title: "Update booking status", confirmLabel: `Mark ${nextStatus}` }) ?? Promise.resolve(window.confirm(`Mark this venue as ${nextStatus}?`)));
    if (!approved) return;
    button.disabled = true;
    bookingStatus.textContent = `Updating Tour Manager to ${nextStatus}…`;
    try {
      const response = await fetch(`${API}/tour-manager/outreach/use-status`, { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ outreachId, replyId: reply.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The booking status could not be updated.");
      button.textContent = `${data.status} saved`;
      bookingStatus.replaceChildren(text(`${data.venueName || "Venue"} marked ${data.status}. `));
      const link = document.createElement("a"); link.href = "booking-selections.html#tourManager"; link.textContent = "Open Tour Manager"; bookingStatus.append(link);
    } catch (error) {
      button.disabled = false;
      bookingStatus.textContent = error.message || "The booking status could not be updated.";
    }
  }

  function showEmpty(message) {
    const note = document.createElement("p");
    note.className = "chat-note";
    note.append(text(message));
    list.replaceChildren(note);
  }

  function renderThread(thread) {
    document.body.classList.add("is-conversation-open");
    document.body.classList.add("is-booking-thread");
    document.body.dataset.syncScreen = "bookings";
    header.hidden = false;
    name.removeAttribute("href");
    name.textContent = thread.message.venueName || "Venue";
    avatar.removeAttribute("href");
    avatar.textContent = (thread.message.venueName || "V").charAt(0).toUpperCase();
    if (presence) presence.hidden = true;
    if (callStatus) callStatus.hidden = true;
    if (form) form.hidden = true;
    bookingForm.hidden = false;
    bookingForm.dataset.outreachId = thread.message.id;
    bookingForm.dataset.venueName = thread.message.venueName || "Venue";
    bookingStatus.textContent = "Artist-approved replies are emailed to the venue. No booking credit is charged.";
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
      bubble.className = `message booking-message${reply.direction === "outbound" ? " mine" : ""}`;
      const replyHeading = document.createElement("strong");
      replyHeading.append(text(reply.direction === "outbound" ? "You" : labelFor(reply.action)));
      const replyCopy = document.createElement("p");
      replyCopy.append(text(reply.content));
      bubble.append(replyHeading, replyCopy);
      if (reply.appliedStatus) {
        const applied = document.createElement("p");
        applied.className = "booking-date-offer";
        applied.append(text(`Tour Manager: ${reply.appliedStatus}`));
        bubble.append(applied);
      }
      if (reply.direction !== "outbound" && !reply.appliedStatus && (reply.action === "interested" || reply.action === "pass")) {
        const useStatus = document.createElement("button");
        useStatus.type = "button"; useStatus.className = "booking-use-date"; useStatus.dataset.venueName = thread.message.venueName || "Venue";
        useStatus.textContent = reply.action === "interested" ? "Review interest" : "Review pass";
        useStatus.addEventListener("click", () => useReplyStatus(useStatus, thread.message.id, reply));
        bubble.append(useStatus);
      }
      if (reply.proposedDate) {
        const offered = document.createElement("p");
        offered.className = "booking-date-offer";
        offered.append(text(`${reply.action === "confirm_date" ? "Confirmed" : "Proposed"} date: ${reply.proposedDate}`));
        bubble.append(offered);
        if (reply.direction !== "outbound" && !reply.appliedStatus) {
          const useDate = document.createElement("button");
          useDate.type = "button"; useDate.className = "booking-use-date"; useDate.textContent = reply.action === "confirm_date" ? "Review confirmed date" : "Add proposed date to Tour";
          useDate.addEventListener("click", () => useDateOffer(useDate, thread.message.id, reply));
          bubble.append(useDate);
        }
      }
      const replyTime = document.createElement("time");
      replyTime.append(text(formatDate(reply.createdAt)));
      bubble.append(replyTime);
      messageList.append(bubble);
    }

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
    if (requestedOutreachId) {
      const requestedThread = threads.find(thread => thread.message.id === requestedOutreachId);
      if (requestedThread) renderThread(requestedThread);
      requestedOutreachId = "";
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
    document.body.classList.remove("is-booking-thread");
    if (form) form.hidden = false;
    if (callStatus) callStatus.hidden = false;
    bookingForm.hidden = true;
    name.setAttribute("href", "profile.html");
    avatar.setAttribute("href", "profile.html");
  };

  if (requestedSection === "bookings") {
    document.querySelector('[data-chat-filter="bookings"]')?.click();
  }

  bookingForm.addEventListener("submit", async event => {
    event.preventDefault();
    const outreachId = bookingForm.dataset.outreachId || "", content = bookingInput.value.trim();
    if (!outreachId || !content) return;
    bookingInput.disabled = true; bookingSend.disabled = true; bookingStatus.textContent = "Sending your approved reply…";
    try {
      const response = await fetch(`${API}/tour-manager/outreach/reply`, { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ outreachId, content, clientMessageId: crypto.randomUUID().replaceAll("-", "") }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your booking reply could not be sent.");
      bookingInput.value = "";
      bookingStatus.textContent = "Reply submitted to the venue by email. No booking credit was charged.";
      await load();
      const row = [...list.querySelectorAll(".conversation-user")].find(button => button.textContent.includes(bookingForm.dataset.venueName));
      row?.click();
      bookingStatus.textContent = "Reply submitted to the venue by email. No booking credit was charged.";
    } catch (error) {
      bookingStatus.textContent = error.message || "Your booking reply could not be sent.";
    } finally {
      bookingInput.disabled = false; bookingSend.disabled = false; bookingInput.focus();
    }
  });
})();
