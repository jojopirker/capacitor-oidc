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
- unit coverage for web/native configuration resolution and navigation dispatch;
- iOS XCTest in an iOS 18.5 simulator;
- Android unit tests, assembly, and lint with SDK 36;
- packaged iOS and Android consumer builds with Capacitor 7 and 8;
- Keycloak-backed login, refresh, and logout flows on iOS and Android with
  Capacitor 7 and 8;
- cross-platform decoding of the versioned `StoredSessionV1` fixture.
