# SYNC SMS device enrollment — PWA v812

Captured by `browser-checks/call-device-registration.cjs` at 320, 360, 375, 390, 414, 430, 768, 1024, and 1366 CSS pixels.

Each viewport includes:

- `call-registration-from-phone-*`: the single phone-number entry flow, with no independent device-registration button;
- `call-registration-otp-*`: the six-digit input shown only after the mocked SMS provider accepts the send request;
- `calling-devices-*`: the registered-device result after a correct mocked code is confirmed and consumed by device registration; and
- `sync-registered-no-footer-*`: the registered SYNC list with the global footer removed.

The browser fixture mocks the provider so it can exercise the complete UI and credential boundary deterministically. It does not claim that AWS sent a physical text. The production AWS End User Messaging configuration remains rejected and sandboxed, so the live UI stays fail-closed and explains that no code was sent.
