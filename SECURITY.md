# Security

## Design boundary

`capacitor-oidc` delegates OAuth and OpenID Connect protocol behavior to
`oidc-client-ts`. Native code is limited to presenting system authentication UI
and storing state securely. The package does not patch `fetch`, process JWTs, or
implement OAuth endpoints in Swift or Java.

Installed applications are public clients. They must use Authorization Code Flow
with PKCE and must not contain a client secret. Authorization and provider logout
run in system authentication UI, never an embedded WebView.

## ID-token validation in `oidc-client-ts` 3.5.0

The pinned `oidc-client-ts` 3.5.0 decodes ID-token claims and validates `sub`,
`nonce`, and selected refresh-token continuity claims. It does not independently
compare the decoded `iss`, `aud`, and `exp` claims with the configured client and
current time. This behavior is visible in the
[v3.5.0 ResponseValidator](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts)
and is the subject of the open upstream report
[authts/oidc-client-ts#2475](https://github.com/authts/oidc-client-ts/issues/2475).

The practical exposure is narrower than an implicit-flow token parser: this
package uses Authorization Code Flow only, and the token response comes from the
configured token endpoint over TLS after state, nonce, and PKCE processing. The
upstream project has not yet classified or resolved the report.

This is a standards-conformance and threat-model consideration, not a categorical
claim that every application using `oidc-client-ts` is unsafe. Consumers should
evaluate it against their provider, reliance on ID-token claims, and assurance
requirements. Resource servers must always validate access tokens independently;
an application must not use unverified client-side profile claims as its API
authorization boundary.

The package will follow the upstream resolution and cover the expected behavior
in provider integration tests before a stable v1 decision. It will not add a
package-local JWT or cryptographic-validation layer, because duplicating protocol
security code would expand the attack surface and create a second OIDC engine.

## Secure-storage boundary

OIDC transactions and sessions are stored through iOS Keychain or an Android
Keystore-backed vault. Configuring an iOS Keychain access group gives every
entitled target access to the plugin's canonical session, transaction data, and
widget snapshot. Treat those extensions as part of the application's credential
trust boundary.

The widget snapshot can contain access, refresh, and ID tokens. Autonomous widget
refresh is not currently implemented; see
[Sessions, secure storage, and widgets](docs/SESSIONS_AND_WIDGETS.md).

## Runtime assumptions

`oidc-client-ts` requires `crypto.subtle` and `crypto.getRandomValues`.
`CapacitorUserManager.create()` rejects with `UNSUPPORTED_RUNTIME` when they are
absent. Their behavior must be verified in packaged applications on supported
physical devices.

See [Testing](docs/TESTING.md) for current platform and provider coverage.
