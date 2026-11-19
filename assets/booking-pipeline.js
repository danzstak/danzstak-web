"use strict";
// Booking pipeline rules (task 02), browser copy of infrastructure/auth-api/booking-pipeline.mjs.
// test-booking-pipeline-stages.cjs fails if the two tables drift apart.
(() => {
  const BOOKING_STATUSES = ["Not contacted", "Email prepared", "Email sent", "Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Played", "Declined", "No response"];
  const PIPELINE_STAGES = ["found", "pitched", "replied", "offer", "confirmed", "played", "passed", "no_reply"];
  const STAGE_BY_STATUS = {
    "Not contacted": "found", "Email prepared": "found",
    "Email sent": "pitched",
    "Reply received": "replied", "Interested": "replied", "Negotiating": "replied",
    "Date proposed": "offer",
    "Confirmed": "confirmed",
    "Played": "played",
    "Declined": "passed",
    "No response": "no_reply"
  };
  const NEXT_STAGES = {
    found: ["found", "pitched"],
    pitched: ["pitched", "replied", "no_reply", "passed"],
    replied: ["replied", "offer", "passed"],
    offer: ["offer", "replied", "confirmed", "passed"],
    confirmed: ["confirmed", "played", "passed"],
    played: ["played"],
    passed: ["passed"],
    no_reply: ["no_reply", "replied", "passed"]
  };
  const STAGE_LABELS = { found: "Found", pitched: "Pitched", replied: "Replied", offer: "Offer", confirmed: "Confirmed", played: "Played", passed: "Passed", no_reply: "No reply" };
  const stageOf = status => STAGE_BY_STATUS[status] || "found";
  // Statuses the artist can pick next from the card: one step, Played only after the show date.
  function nextStatuses(status, { showDate = "", today = "" } = {}) {
    const allowed = NEXT_STAGES[stageOf(status)] || ["found"];
    return BOOKING_STATUSES.filter(option => option === status || (allowed.includes(stageOf(option)) && (stageOf(option) !== "played" || (showDate && today && showDate <= today))));
  }
  const api = { BOOKING_STATUSES, PIPELINE_STAGES, STAGE_BY_STATUS, NEXT_STAGES, STAGE_LABELS, stageOf, nextStatuses };
  if (typeof window !== "undefined") window.danzstakBookingPipeline = Object.freeze(api);
  if (typeof module !== "undefined") module.exports = api;
})();
