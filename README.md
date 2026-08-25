# capacitor-oidc

[![npm](https://img.shields.io/npm/v/capacitor-oidc)](https://www.npmjs.com/package/capacitor-oidc)
[![CI](https://github.com/jojopirker/capacitor-oidc/actions/workflows/ci.yml/badge.svg)](https://github.com/jojopirker/capacitor-oidc/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/capacitor-oidc)](LICENSE)

Native OAuth 2.0 and OpenID Connect for Capacitor, powered by
[`oidc-client-ts`](https://github.com/authts/oidc-client-ts).

`capacitor-oidc` adapts the familiar `UserManager` API to native iOS and Android
applications. It keeps protocol behavior in `oidc-client-ts` and adds only the
Capacitor-specific pieces:

- system authentication UI instead of an embedded WebView;
- secure native storage for OIDC transactions and sessions;
- refresh-token renewal when the app is active or resumes;
- a native-readable session snapshot for app widgets.

On iOS, authentication uses `ASWebAuthenticationSession`. On Android, it uses
AndroidX Auth Tab with its Custom Tab fallback.

> [!CAUTION]
> This package is an alpha. The public API and stored-session format can still
> change before v1. See [Security](SECURITY.md) and
> [current test coverage](docs/TESTING.md) before making a production decision.

## Requirements

- Capacitor 7 or 8
- iOS 15 or newer
- Android API 24 or newer
- Android compile SDK 36, Java 21, and a compatible Android Gradle Plugin
- an OAuth public client using Authorization Code Flow with PKCE
- Web Crypto in the packaged Capacitor WebView
- CORS support for the app's Capacitor origin on OIDC HTTP endpoints

Never ship a client secret in a Capacitor application.

## Install

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

## Quick start

```ts
import { CapacitorUserManager } from 'capacitor-oidc';

const manager = await CapacitorUserManager.create(
  {
    authority: 'https://identity.example.com',
    client_id: 'mobile-app',
    redirect_uri: 'com.example.app:/callback',
    post_logout_redirect_uri: 'com.example.app:/logout-callback',
    scope: 'openid profile offline_access',
    automaticSilentRenew: true,
    revokeTokensOnSignout: true,
  },
  {
    storageNamespace: 'primary',
  },
);

const user = await manager.signin();
const validUser = await manager.getValidUser(30);

await manager.signout();
await manager.dispose();
```

Register the redirect and post-logout redirect URIs exactly at your provider and
in the native application. The provider client must be public and must allow
Authorization Code Flow with PKCE.

`CapacitorUserManager` is for native Capacitor runtimes. For a browser build, use
the normal `UserManager` from `oidc-client-ts` and select the implementation with
`Capacitor.isNativePlatform()` in the application.

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [iOS and Android setup](docs/PLATFORM_SETUP.md)
- [Provider configuration](docs/PROVIDERS.md)
- [API and `oidc-client-ts` compatibility](docs/API.md)
- [Sessions, secure storage, and widgets](docs/SESSIONS_AND_WIDGETS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Testing status](docs/TESTING.md)
- [Security](SECURITY.md)

## Session renewal

`automaticSilentRenew` uses the foreground expiry timer from `oidc-client-ts`.
Native silent renewal uses the refresh token and never falls back to an iframe.
Concurrent renewal triggers share one request. When the app returns to the
foreground, the manager checks whether the current user needs renewal.

The operating system can suspend or terminate the app, so the package does not
promise exact background refresh timing.

## Networking

Discovery, token exchange, refresh, UserInfo, and revocation are performed by
`oidc-client-ts` through the unmodified WebView `fetch`. The corresponding
provider endpoints must allow the application's configured Capacitor origin
through CORS.

The package does not patch `fetch`, add native OIDC networking, accept client
secrets, or render authentication inside a WebView.

## Development

```sh
npm run verify
npm run verify:ios
npm run verify:android
```

Architecture decisions and contributor constraints are documented in
[ARCHITECTURE.md](ARCHITECTURE.md), [REQUIREMENTS.md](REQUIREMENTS.md), and
[docs/adr](docs/adr).

## License

Apache-2.0
