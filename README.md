# danzstak-web
Official DanzStak social networking and music platform website.

## Product boundary

DanzStak is an installable, responsive Progressive Web App for social
networking. It does not include blockchain, cryptocurrency, wallets, tokens,
or Web3 transactions. Those capabilities belong to the separate SFSCOOP
product and must not be introduced into DanzStak.
## Production runtime configuration

Run `./aws-configure-production.ps1` from an authenticated AWS shell to reapply the production-safe runtime settings used by the site:

- optional software-token MFA for existing users;
- credentialed CORS restricted to `https://danzstak.com`;
- GET, POST, PATCH, DELETE, and OPTIONS support;
- API throttling and detailed CloudWatch metrics.

Run `./aws-harden-cloudfront.ps1` from the same authenticated shell to attach AWS's managed `SecurityHeadersPolicy` to the `danzstak.com` distribution. The script discovers the distribution by alias, preserves its current configuration, and adds HSTS, `nosniff`, frame protection, and a strict referrer policy.

The browser receives only the opaque `__Host-danzstak_session` cookie. Cognito tokens remain server-side and must not be added to local storage, session storage, URLs, or browser-readable cookies.
