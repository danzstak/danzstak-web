"use strict";
// DanzStak buyer-paid fees for price displays (task 12). Mirrors infrastructure/auth-api/fees.mjs exactly:
// 6% of the item or ticket price (never shipping), plus a $1 processing fee on orders under $30.
// Prices are shown all-in wherever they first appear, e.g. "$6.30 (incl. $1.30 fees)".
(() => {
  const FEE_PERCENT = 6, SMALL_ORDER_FEE_CENTS = 100, SMALL_ORDER_LIMIT_CENTS = 3000;
  const cents = value => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
  const buyerFees = subtotal => { const s = cents(subtotal); return s ? Math.round(s * FEE_PERCENT / 100) + (s < SMALL_ORDER_LIMIT_CENTS ? SMALL_ORDER_FEE_CENTS : 0) : 0; };
  const money = value => `$${(Number(value || 0) / 100).toFixed(2)}`;
  const withFees = subtotal => { const s = cents(subtotal), fee = buyerFees(s); return { subtotalCents: s, feeCents: fee, totalCents: s + fee }; };
  const allIn = subtotal => { const { feeCents, totalCents } = withFees(subtotal); return feeCents ? `${money(totalCents)} (incl. ${money(feeCents)} fees)` : money(totalCents); };
  const allInShort = subtotal => { const { feeCents, totalCents } = withFees(subtotal); return feeCents ? `${money(totalCents)} incl. fees` : money(totalCents); };
  window.DanzStakFees = Object.freeze({ FEE_PERCENT, SMALL_ORDER_FEE_CENTS, SMALL_ORDER_LIMIT_CENTS, buyerFees, withFees, allIn, allInShort, money });
})();
