# SYNC call device registration visual checks

Captured from the automated browser check at 320, 360, 375, 390, 414, 430, 768, 1024, and 1366 pixels.

- `call-registration-auto-open-*`: registration opens when SYNC detects an unregistered device.
- `call-registration-required-*`: the conversation remains visible with a truthful registration status.
- `calling-devices-*`: the registered-device state after a successful challenge and registration.

The browser check also confirms that the registration dialog remains inside the viewport at every width and that the call button opens registration before contact-directory loading can intercept the action.
