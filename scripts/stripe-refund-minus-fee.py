#!/usr/bin/env python3
"""Refund a DanzStak Stripe purchase minus Stripe's processing fee (owner policy 2026-11-15).

Run in AWS CloudShell (us-west-1). The live key is read from Secrets Manager and never printed.

  python3 scripts/stripe-refund-minus-fee.py pi_XXXX            # dry run: shows amount, fee, refund
  python3 scripts/stripe-refund-minus-fee.py pi_XXXX --confirm  # issues the refund

The charge is tagged danzstak_refund_policy=fee_deducted before the refund so the
DanzStak webhook revokes the purchase (credits, unlock or number) even though the
refund is smaller than the price.
"""
import base64, json, subprocess, sys, urllib.error, urllib.parse, urllib.request

SECRET = "danzstak/stripe/live-secret-key"


def key():
    raw = subprocess.check_output(["aws", "secretsmanager", "get-secret-value", "--region", "us-west-1",
                                   "--secret-id", SECRET, "--query", "SecretString", "--output", "text"])
    return json.loads(raw)["STRIPE_SECRET_KEY"]


def api(k, path, data=None, idem=None):
    req = urllib.request.Request("https://api.stripe.com/v1/" + path,
                                 data=urllib.parse.urlencode(data).encode() if data is not None else None)
    req.add_header("Authorization", "Basic " + base64.b64encode((k + ":").encode()).decode())
    if idem:
        req.add_header("Idempotency-Key", idem)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit("Stripe error: " + json.load(e).get("error", {}).get("message", "")[:200])


def main():
    if len(sys.argv) < 2 or not sys.argv[1].startswith("pi_"):
        sys.exit(__doc__)
    pi, confirm, k = sys.argv[1], "--confirm" in sys.argv, key()
    intent = api(k, "payment_intents/" + pi + "?expand[]=latest_charge.balance_transaction")
    charge = intent["latest_charge"]
    fee = int(charge["balance_transaction"]["fee"])
    amount, already = int(charge["amount"]), int(charge.get("amount_refunded", 0))
    refund = amount - fee - already
    print(f"charge {charge['id'][:10]}…  paid {amount/100:.2f}  stripe fee {fee/100:.2f}  refund {refund/100:.2f}")
    if refund <= 0:
        sys.exit("Nothing to refund after the Stripe fee.")
    if not confirm:
        print("Dry run. Add --confirm to refund.")
        return
    api(k, "charges/" + charge["id"], {"metadata[danzstak_refund_policy]": "fee_deducted"})
    r = api(k, "refunds", {"payment_intent": pi, "amount": refund, "metadata[danzstak_refund_policy]": "fee_deducted"},
            idem="danzstak-fee-deducted-refund-" + pi)
    print("refund", r.get("status"), f"{int(r.get('amount', 0))/100:.2f}")


if __name__ == "__main__":
    main()
