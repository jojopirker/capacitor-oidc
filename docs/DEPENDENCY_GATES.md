# Dependency gates

Checked on 2026-08-24 against `oidc-client-ts` 3.5.0.

Neither gate may be bypassed with package-local crypto, JWT, or validation code. A failed gate reopens ADR 0001.

## Web Crypto in packaged Capacitor apps

Status: **requires physical-device verification**.

`CapacitorUserManager.create()` rejects with `UNSUPPORTED_RUNTIME` unless `globalThis.crypto.subtle` and `crypto.getRandomValues` exist. TypeScript unit tests and native library compilation cannot establish that these APIs work in the final packaged iOS and Android WebViews. This must be tested in installed applications on both platforms.

## Required ID-token claim validation

Status: **failed; production release blocked**.

The selected version's `ResponseValidator._validateIdTokenAttributes()` decodes the ID token and checks `sub`, `nonce`, and selected refresh-token continuity claims. It does not validate:

- `iss` against the discovered issuer;
- `aud` against the configured client ID;
- `exp` against the current time.

The upstream report is still open: [authts/oidc-client-ts#2475](https://github.com/authts/oidc-client-ts/issues/2475). The inspected implementation is in [`ResponseValidator.ts` at v3.5.0](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts).

Do not publish a production version until an upstream release provides the required checks and its behavior is covered by integration tests, or ADR 0001 is replaced with a different protocol engine decision.

## Upstream storage-path audit

`oidc-client-ts` 3.5.0 calls the virtual `storeUser()` method after interactive signin, refresh-token renewal, token revocation, and through `removeUser()` during signout. `CapacitorUserManager.storeUser()` therefore updates or clears the native `StoredSessionV1` snapshot on these paths. Unit tests cover direct upstream storage and removal dispatch; provider integration tests must cover signin, refresh rotation, revocation, and signout before release.
