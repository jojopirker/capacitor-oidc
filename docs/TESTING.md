# Testing

## Local checks

Run the TypeScript checks and package build:

```sh
npm run verify
```

`verify` also checks that the TypeScript, Swift, and Java bridge constants still
match `contracts/native-api.json`.

Build the native libraries with:

```sh
npm run verify:ios
npm run verify:android
```

CI runs Vitest, the iOS XCTest suite in a simulator, Android unit tests, native
builds, Android lint, and `npm pack --dry-run`. The shared `StoredSessionV1`
fixture is decoded or produced by all three platform implementations.

## Physical-device coverage

Before a stable release, install example applications on physical iOS and Android
devices and verify:

- system login and logout UI, provider-consent UI, cancellation, and callbacks;
- Web Crypto availability in the packaged Capacitor WebView;
- shared and ephemeral iOS browser sessions;
- Keychain and Keystore persistence across app restarts;
- session reads from iOS and Android widgets.

## Provider integration coverage

Run the following flows against at least two conforming providers, including a
locally configurable provider:

- discovery and explicit metadata;
- login, code exchange, UserInfo, and logout;
- refresh-token renewal, rotation, and concurrent renewal triggers;
- token revocation and terminal `invalid_grant` handling;
- invalid state, nonce, callback, and ID-token claims;
- a provider that omits refresh tokens;
- a provider that rejects the configured Capacitor origin through CORS.
