# Testing

## Automated checks

Run TypeScript linting, unit tests, and the package build:

```sh
npm run verify
```

Build and test the native libraries with:

```sh
npm run verify:ios
npm run verify:android
```

CI currently runs:

- TypeScript linting, Vitest, package builds, and `npm pack --dry-run`;
- iOS XCTest in an iOS 18.5 simulator;
- Android unit tests, assembly, and lint with SDK 36;
- packaged iOS and Android consumer builds with Capacitor 7 and 8;
- cross-platform decoding of the versioned `StoredSessionV1` fixture.

## Current manual validation

Basic Amazon Cognito login has been tested in a packaged application on a
physical iOS device. The system authentication UI, callback, code exchange, and
resulting session work in that path.

This does not yet cover all iOS cancellation, logout, refresh, rotation, restart,
ephemeral-session, and error edge cases. Physical Android and the provider matrix
also remain incomplete.

## Required physical-device coverage

Before a stable release, verify on physical iOS and Android devices:

- system login and logout UI, provider-consent UI, cancellation, and callbacks;
- Web Crypto availability in the packaged Capacitor WebView;
- shared and ephemeral browser sessions;
- Keychain and Keystore persistence across app restarts;
- refresh before expiry and refresh after resuming beyond expiry;
- reads from iOS and Android widgets.

## Provider integration coverage

The target matrix contains at least two conforming providers, including a locally
configurable provider, and covers:

- discovery and explicit metadata;
- login, code exchange, UserInfo, and logout;
- refresh-token renewal, rotation, and concurrent renewal triggers;
- token revocation and terminal `invalid_grant` handling;
- invalid state, nonce, callback, and ID-token claims;
- a provider that omits refresh tokens;
- a provider that rejects the configured Capacitor origin through CORS.

Provider configuration examples that have not been tested on physical devices are
labelled as guidance in [Provider configuration](PROVIDERS.md).
