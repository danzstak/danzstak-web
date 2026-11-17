// DanzStak buyer-paid fees (task 12, owner decision 2026-11-16).
// Every purchase carries one 6% fee paid by the buyer on top of the price, plus a $1 processing fee when the
// order subtotal is under $30. The subtotal is the item or ticket price before fees and shipping; shipping never
// carries the 6%. Sellers and promoters receive the full subtotal plus the shipping they charged. DanzStak pays
// Stripe's processing fees out of this fee. This is the one place the rule lives: server modules import it.

export const FEE_PERCENT = 6;
export const SMALL_ORDER_FEE_CENTS = 100;
export const SMALL_ORDER_LIMIT_CENTS = 3000; // orders of $30.00 and up pay no $1

function cents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be integer cents`);
  return value;
}

export function percentFeeCents(subtotalCents) {
  return Math.round(cents(subtotalCents, "Subtotal") * FEE_PERCENT / 100);
}

export function smallOrderFeeCents(subtotalCents) {
  const subtotal = cents(subtotalCents, "Subtotal");
  return subtotal > 0 && subtotal < SMALL_ORDER_LIMIT_CENTS ? SMALL_ORDER_FEE_CENTS : 0;
}

// buyerFees(subtotal) = round(subtotal × 6%) + (subtotal < $30 ? $1 : 0). A zero subtotal owes nothing.
export function buyerFees(subtotalCents) {
  return percentFeeCents(subtotalCents) + smallOrderFeeCents(subtotalCents);
}

// The whole order in one object, so checkout, webhook checks and price displays agree to the cent.
export function orderTotals({ subtotalCents, shippingCents = 0 }) {
  const subtotal = cents(subtotalCents, "Subtotal");
  const shipping = cents(shippingCents, "Shipping");
  const percent = percentFeeCents(subtotal), small = smallOrderFeeCents(subtotal);
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    percentFeeCents: percent,
    smallOrderFeeCents: small,
    feeCents: percent + small,
    totalCents: subtotal + shipping + percent + small,
    payoutCents: subtotal + shipping
  };
}
