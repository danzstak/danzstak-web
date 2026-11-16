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
  // Seller and promoter notice (owner 2026-11-16), a live "Buyer pays · You get" preview and a one-time change banner.
  const SELLER_NOTICE = "Buyers pay your price plus DanzStak's 6% fee ($1 more on orders under $30). You receive your full price plus your shipping. No fees come out of your payout.";
  const PROMOTER_NOTICE = "Buyers pay your ticket price plus DanzStak's 6% fee ($1 more on orders under $30). You receive your full ticket price. No fees come out of your payout.";
  const payoutPreview = (priceCents, shippingCents = 0) => { const s = cents(priceCents), ship = cents(shippingCents); return `Buyer pays ${money(s + buyerFees(s) + ship)} · You get ${money(s + ship)}`; };
  const NOTICE_KEY = "danzstak_fee_change_2026_11_16";
  function feeChangeBanner(host, notice = SELLER_NOTICE) {
    if (!host) return null;
    try { if (localStorage.getItem(NOTICE_KEY) === "seen") return null; } catch {}
    const banner = document.createElement("aside"), text = document.createElement("p"), close = document.createElement("button");
    banner.className = "fee-change-banner"; banner.setAttribute("role", "status");
    text.append(Object.assign(document.createElement("strong"), { textContent: "Fee change: " }), notice);
    close.type = "button"; close.className = "fee-change-close"; close.textContent = "Got it";
    close.addEventListener("click", () => { try { localStorage.setItem(NOTICE_KEY, "seen"); } catch {} banner.remove(); });
    banner.append(text, close); host.prepend(banner);
    return banner;
  }
  window.DanzStakFees = Object.freeze({ FEE_PERCENT, SMALL_ORDER_FEE_CENTS, SMALL_ORDER_LIMIT_CENTS, SELLER_NOTICE, PROMOTER_NOTICE, buyerFees, withFees, allIn, allInShort, money, payoutPreview, feeChangeBanner });
})();
