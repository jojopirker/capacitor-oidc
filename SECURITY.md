# Security

## Design boundary

`capacitor-oidc` delegates OAuth and OpenID Connect protocol behavior to
`oidc-client-ts`. Native code is limited to presenting system authentication UI
and storing state securely. The package does not patch `fetch`, process JWTs, or
implement OAuth endpoints in Swift or Java.

## Known limitation in the pinned OIDC engine

This prerelease pins `oidc-client-ts` 3.5.0. Its ID-token response validation
checks `sub`, `nonce`, and selected refresh-token continuity claims, but does not
check the required `iss`, `aud`, and `exp` claims. The behavior is visible in the
[v3.5.0 ResponseValidator](https://github.com/authts/oidc-client-ts/blob/v3.5.0/src/ResponseValidator.ts)
and is tracked in [authts/oidc-client-ts#2475](https://github.com/authts/oidc-client-ts/issues/2475).

The current alpha must not be treated as production-ready. Before a stable
release, use an upstream version that performs the required validation and cover
it with provider integration tests, or replace ADR 0001 with a different protocol
engine decision. Do not add package-local JWT or cryptographic validation as a
workaround.

## Runtime assumptions

`oidc-client-ts` requires `crypto.subtle` and `crypto.getRandomValues`.
`CapacitorUserManager.create()` rejects with `UNSUPPORTED_RUNTIME` when they are
absent. Their presence and behavior must also be verified in packaged applications
on physical iOS and Android devices.

See [Testing](docs/TESTING.md) for the remaining device and provider coverage.
