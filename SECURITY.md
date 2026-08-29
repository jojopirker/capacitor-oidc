# Security

## Design boundary

`capacitor-oidc` delegates OAuth and OpenID Connect protocol behavior to
`oidc-client-ts`. Native code is limited to presenting system authentication UI
and storing state securely. The package does not patch `fetch`, process JWTs, or
implement OAuth endpoints in Swift or Java.

All configured applications are public clients. They use Authorization Code Flow
with PKCE and cannot contain a client secret. Native authorization and provider
logout run in system authentication UI, never an embedded WebView; web uses
normal browser redirect or popup navigation.

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

## Known issues

### ID-token claim validation in `oidc-client-ts` 3.5.0

The pinned `oidc-client-ts` 3.5.0 decodes ID-token claims and validates `sub`,
`nonce`, and selected refresh-token continuity claims. It does not independently
compare the decoded `iss`, `aud`, and `exp` claims with the configured client and
current time. This behavior is visible in the
[v3.5.0 ResponseValidator](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts)
and is the subject of the unresolved upstream report
[authts/oidc-client-ts#2475](https://github.com/authts/oidc-client-ts/issues/2475).

This package uses Authorization Code Flow, so the token response comes from the
configured token endpoint over TLS after state, nonce, and PKCE processing.
Applications that rely on `iss`, `aud`, or `exp` claims should still evaluate
the upstream gap against their assurance requirements. Resource servers must
validate access tokens independently, and client-side ID-token claims must not
be an API authorization boundary.

The package will follow the upstream resolution and cover the expected behavior
in provider integration tests before a stable v1 decision. It will not add a
package-local JWT validation layer that would duplicate protocol security code.
