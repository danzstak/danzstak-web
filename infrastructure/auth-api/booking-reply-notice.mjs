// Owner 2026-11-16: "can you see the replies and notify users that so and so contacted them about a gig".
// One bell notification per reply. Kept identical to booking-inbound/notice.mjs (checked by test).
const ACTIONS = { reply: "answered your pitch", interested: "is interested in your gig", offer_date: "offered you a date", confirm_date: "confirmed a date", pass: "passed on your pitch", opened: "opened your EPK" };
export const BOOKING_NOTICE_TYPE = "booking_reply";

export function bookingReplyNotice({ tableName, artistEmail, outreachId, dedupe, venueName, action = "reply", preview = "", proposedDate = "", at }) {
  const email = String(artistEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-zA-Z0-9_-]{16,100}$/.test(String(outreachId || "")) || !/^[a-zA-Z0-9_-]{8,100}$/.test(String(dedupe || ""))) return null;
  const createdAt = at || new Date().toISOString(), verb = ACTIONS[action] || ACTIONS.reply;
  return {
    TableName: tableName,
    Item: {
      userEmail: { S: email }, eventId: { S: `${BOOKING_NOTICE_TYPE}#${outreachId}#${dedupe}` }, type: { S: BOOKING_NOTICE_TYPE },
      outreachId: { S: outreachId }, venueName: { S: String(venueName || "A venue").replace(/\s+/g, " ").trim().slice(0, 120) || "A venue" },
      bookingAction: { S: ACTIONS[action] ? action : "reply" }, verb: { S: verb },
      preview: { S: String(preview || "").replace(/\s+/g, " ").trim().slice(0, 160) }, ...(/^\d{4}-\d{2}-\d{2}$/.test(proposedDate) ? { proposedDate: { S: proposedDate } } : {}),
      createdAt: { S: createdAt }, read: { BOOL: false }, expiresAt: { N: String(Math.floor(Date.parse(createdAt) / 1000) + 90 * 86400) }
    },
    ConditionExpression: "attribute_not_exists(eventId)"
  };
}

// Task 16-F (owner 2026-11-17): booking replies and "venue opened your EPK" also reach the lock screen. The bell notice and
// a push-outbox row are written together; the call-signaling outbox worker checks the notice is in the artist's own bell
// (their own booking thread) before it pushes, and links to /messages.html?section=bookings&outreach=<id>.
export function bookingNoticeWrites(notice, outboxTable) {
  if (!notice) return [];
  if (!outboxTable) return [{ Put: notice }];
  const item = notice.Item, createdAt = item.createdAt.S;
  return [
    { Put: notice },
    { Put: { TableName: outboxTable, Item: {
      eventId: item.eventId, recipientEmail: item.userEmail, type: { S: BOOKING_NOTICE_TYPE }, outreachId: item.outreachId,
      status: { S: "pending" }, createdAt: { S: createdAt }, expiresAt: { N: String(Math.floor(Date.parse(createdAt) / 1000) + 7 * 86400) }
    }, ConditionExpression: "attribute_not_exists(eventId)" } }
  ];
}
