# 24 — SYNC contacts and "SYNC up" invites (owner 2026-11-18)

Owner: "Phones also need to go through contacts like a phone and be able to be invited to SYNC conversations, like WhatsApp. So-and-so is inviting you to SYNC up."

## Find people from your phone's contacts
- **Android (Chrome / installed PWA):** a "From your contacts" button in SYNC → New chat opens the phone's own contact picker (Contact Picker API). The member picks the people; DanzStak never reads the whole address book and never uploads it.
- The picked numbers are normalised to E.164 on the device, sent once over HTTPS, compared on the server as keyed hashes against SYNC-verified numbers, and **discarded** — never stored, never logged (hashes only, as today).
- A match shows the person's DanzStak name, @username and avatar with **Message** / **Call**. It never shows or returns their number, masked or not.
- **Who can be found:** only members who switched on **"People who have my number can find me on SYNC"** (Settings → SYNC → Privacy). Off by default. Owner choice 2026-11-18 replaces "phone numbers are never searchable" with this opt-in; numbers stay private, hashed and never displayed. A number that is not opted in returns "not on SYNC" exactly like an unknown number (no way to tell the difference).
- Rate limits: 50 numbers per pick, 200 per day per account; no repeat-lookup enumeration.
- **iPhone / computers:** no contact picker in the browser. Show **Invite** (below) and search by name/@username instead; never a dead button.

## "SYNC up" invites
- Every picked contact who is not found gets **Invite**. It opens the member's **own** SMS / WhatsApp / share sheet (sms: link or native share), pre-filled: **"<Name> is inviting you to SYNC up on DanzStak"** + a personal invite link. DanzStak does not send the text itself (no A2P, no spam).
- The same invite is in SYNC → New chat → **Invite to SYNC** (link, QR, share) for any phone.
- The invite link is personal to the inviter (short link, tracked as counts only — task 17). Opening it shows "<Name> is inviting you to SYNC up" with the inviter's avatar, then sign-up (name + @username first, as today).
- **After sign-up the new member lands straight in a SYNC chat with the inviter**, and the two are friends (the inviter sent the request by inviting; the new member accepted by joining). The inviter gets a push: "<Name> joined — say hi".
- **Group invites:** a group chat admin can make an invite link for that chat ("<Name> is inviting you to SYNC up in <Group>"); joining adds the member to the group. Admin can reset or turn off the link.
- Invite links expire after 30 days or when revoked; one-person links work once.

## Not allowed
- No reading or uploading the full address book, no "people you may know" from contacts, no texting non-members from DanzStak, no showing anyone's number. Phone verification rules for calls stay as they are.

## Tests
Contact matching only finds opted-in members; non-opted-in and unknown look identical; numbers never in responses/logs/storage; limits; iPhone/desktop fallbacks; invite link → sign-up → lands in chat with inviter + friendship + push; group link join/reset; expiry. Visual check at phone widths.

## Join from SYNC alone (owner 2026-11-18)
Owner: "They could register their device without being a member of DanzStak — the standalone part. I would make the sign-up page there as well so they auto-become members of DanzStak."
- The standalone SYNC app (16-G) gets its own short sign-up, so someone who only wants to chat never has to visit the main site: **mobile number → Text me a code (Twilio Verify, the existing flow) → name + @username → done.** That one flow verifies the number, registers this device for calls, and **creates their DanzStak account** at the same time — one account, not a separate SYNC account.
- Email and password are optional at that point (asked later only when they want the rest of DanzStak, e.g. selling or an EPK). Check the Cognito user pool: if it requires an email, use the phone number as the sign-in attribute for these accounts or add a phone-first pool setting — do not invent placeholder emails.
- An invite link opened on a phone goes to this SYNC sign-up (not the full site sign-up) and lands in the chat with the inviter.
- Their DanzStak profile starts minimal (name, @username, avatar if they add one), private by default; Mix, shop and EPK are there when they open DanzStak, with no extra sign-up.
- All existing SYNC rules hold: the number stays private and hashed, never shown; terms and privacy are accepted on this screen; one number may be linked to up to 10 accounts as today.
