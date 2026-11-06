# Issue #35 — password visibility ownership audit

Status: **BLOCKED ON AN AUTHENTICATION-ARCHITECTURE DECISION; NOT IMPLEMENTED OR DEPLOYED**

Audit date: 2026-11-06

Branch: `codex/issue-35-password-eye`

## Finding

DanzStak does not render or control a password input in its HTML or browser JavaScript. The landing page sends sign-in to `https://api.danzstak.com/auth/login`; accepted signup consent sends signup to `https://api.danzstak.com/auth/signup`. The Auth API creates a PKCE authorization request and redirects the browser to Amazon Cognito Managed Login v2. Cognito owns the password, confirmation, recovery and password-management screens.

The current Cognito signup screen does **not** satisfy Issue #35. It renders two secure `autocomplete="new-password"` inputs and one shared **Show password** checkbox. Activating the checkbox reveals both fields together. It does not provide an independent eye/eye-slash control beside each field, and the checkbox itself measures 16 × 16 CSS pixels rather than the required 44 × 44 coarse-pointer target.

Amazon's supported Managed Login branding controls can change styles and assets, but they do not provide supported arbitrary DOM or JavaScript injection. DanzStak must not inject a script into the cross-origin hosted page. Meeting the requested independent-control behavior therefore requires a separately reviewed custom authentication UI and Cognito integration, or a future supported Cognito capability. A cosmetic change in `index.html` cannot fix the real password screens.

Official AWS references:

- [Managed Login branding editor](https://docs.aws.amazon.com/cognito/latest/developerguide/managed-login-brandingeditor.html)
- [Managed Login branding](https://docs.aws.amazon.com/cognito/latest/developerguide/managed-login-branding.html)
- [DescribeManagedLoginBrandingByClient](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_DescribeManagedLoginBrandingByClient.html)

## Route and ownership matrix

| DanzStak entry | Actual password surface | Owner | Result |
|---|---|---|---|
| `GET /auth/login` | Cognito Managed Login `/login` password step | Cognito | Hosted; no repository-controlled input |
| Legal consent → `GET /auth/signup` | Cognito Managed Login `/signup` Password + Confirm password | Cognito | Two fields, one shared checkbox; Issue #35 fails |
| Mobile `GET /auth/mobile-login` | System-browser Cognito OAuth flow | Cognito | Same hosted ownership |
| Forgotten-password/recovery flow | Cognito Managed Login password-management pages | Cognito | Hosted; unavailable for per-field DOM control through branding |
| Settings recent reauthentication | Existing Cognito OAuth login | Cognito | Hosted; no repository-controlled input |
| Account deletion/protected actions | Recent-auth/session checks; no local password input | DanzStak + Cognito | No password field to enhance |
| Administrative surfaces | No password input found | DanzStak | No field to enhance |

## Evidence

`browser-checks/cognito-password-visibility-audit.cjs` performs a read-only live audit at 320, 360, 390, 414, 430 and 1366 CSS pixels. It uses no account and enters no password. At every width it found:

- two new-password fields;
- one visibility control;
- both fields hidden by default;
- the single control reveals both fields;
- a 16 × 16 checkbox target;
- no horizontal document overflow.

The audit reports `acceptanceSatisfied: false`. Run it with `--strict` to turn the unmet acceptance criteria into a failing release gate. `test-password-field-ownership.cjs` also prevents a future repository password form from being added without explicitly revisiting the shared-control requirement.

The screenshots `cognito-login-audit.png` and `cognito-signup-audit.png` contain empty fields only. No password, account email, token, cookie or customer data was captured.

## Required owner/security decision

Choose and authorize one of these paths before implementation:

1. retain Cognito Managed Login and accept its current shared checkbox as a documented provider limitation; or
2. authorize a separately scoped custom Cognito authentication UI security review covering signup, confirmation, sign-in, recovery, MFA, passkeys, password managers, CSRF/PKCE, abuse controls, localization and accessibility.

No production AWS, Cognito, Lambda, frontend or PWA resource was changed by this audit.
