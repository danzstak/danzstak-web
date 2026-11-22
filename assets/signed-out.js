"use strict";
// Owner 2026-11-22: "link goes to the sign in, I think it should go to the store." A shared profile link opened by
// someone who isn't signed in lands on that member's shop. Profile pages send a signed-out visitor here instead of to the
// landing page; shop.html goes on to the landing page when the member has no open shop.
window.danzstakSignedOutPage = () => {
  const member = new URLSearchParams(location.search).get("member") || "";
  return /\/profile(\.html)?$/.test(location.pathname) && /^[a-f0-9-]{36}$/i.test(member) ? `shop.html?member=${encodeURIComponent(member)}` : "./";
};
