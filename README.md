# capacitor-oidc

A small native Capacitor adapter for [`oidc-client-ts`](https://github.com/authts/oidc-client-ts).

> [!WARNING]
> This package is not ready for production use. `oidc-client-ts` 3.5.0 does not validate the required ID-token `iss`, `aud`, and `exp` claims. See [dependency gates](docs/DEPENDENCY_GATES.md).

The package keeps OAuth and OpenID Connect in `oidc-client-ts`. Its native code only presents system authentication UI and stores state securely:

- iOS: `ASWebAuthenticationSession` and Keychain.
- Android: Auth Tab with its Custom Tab fallback, plus AES-GCM protected storage with a key held by Android Keystore.
- TypeScript: a native `INavigator`, secure `StateStore`, foreground refresh serialization, and a resume check.

It does not patch `fetch`, add native OIDC networking, accept client secrets, render authentication in a WebView, or implement iframe renewal.

## Install

```sh
npm install capacitor-oidc oidc-client-ts @capacitor/app
npx cap sync
```

All discovery, token, refresh, UserInfo, and revocation requests use normal WebView `fetch`. The provider must allow the app's configured Capacitor origin through CORS.

Authorization and logout endpoints must use HTTPS. Plain HTTP is accepted only for loopback local development.

## Usage

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
    ios: {
      keychainAccessGroup: 'TEAMID.group.com.example.app',
      keychainAccessibility: 'afterFirstUnlockThisDeviceOnly',
      prefersEphemeralWebBrowserSession: false,
    },
  },
);

const user = await manager.signin();
const validUser = await manager.getValidUser(30);
await manager.signout();
await manager.dispose();
```

`automaticSilentRenew` uses `oidc-client-ts`'s foreground expiry timer. Native silent renewal uses a refresh token only and never falls back to an iframe. Concurrent renewal triggers share one request. Returning to the foreground calls `getValidUser()` so a token that expired while the app was suspended is refreshed.

The operating system can suspend or terminate the app, so exact background refresh timing is not promised.

## Redirect setup

Register the redirect URI as a native public-client redirect at the provider. Never put a client secret in the app.

For an iOS custom scheme, add it to the application target's `CFBundleURLTypes`. HTTPS callbacks through `ASWebAuthenticationSession` require iOS 17.4 or newer and the appropriate Associated Domains configuration.

For Android custom-scheme fallback, add an intent filter to the app's `BridgeActivity`. HTTPS callbacks require a verified App Link and Digital Asset Links. Auth Tab handles the result directly when the installed browser supports it; its intent is intentionally compatible with Custom Tabs on older browsers.

Calling `cancel()` on Android rejects the pending JavaScript promise, but Android does not provide an API to forcibly close an already-open system Auth Tab or Custom Tab. Ephemeral browsing is a request to the installed browser and may be ignored by a fallback browser.

## Secure storage and widgets

`userStore` and transaction `stateStore` are separate secure namespaces. Each successful user write also updates a versioned native `StoredSessionV1` snapshot.

An iOS app and WidgetKit extension can construct the public `TokenVault` with the same Keychain access group:

```swift
let vault = TokenVault(accessGroup: "TEAMID.group.com.example.app")
let session = try vault.loadSession(namespace: "primary")
```

Replace `TEAMID` with the Apple Developer Team ID. Both targets must carry the same
Keychain Sharing entitlement, normally declared as
`$(AppIdentifierPrefix)group.com.example.app`; the runtime option uses its expanded
`TEAMID.group.com.example.app` value. The default accessibility is
`AfterFirstUnlockThisDeviceOnly`; Keychain synchronization and biometric gating are disabled.

An Android app widget in the same package can use the public native vault:

```java
TokenVault vault = new TokenVault(context);
StoredSessionV1 session = vault.loadSession("primary");
```

Widgets may read the current session. Autonomous native refresh is deliberately not implemented.

## Logout behavior

`signout()` uses the provider's end-session endpoint in the same native authentication UI. If `revokeTokensOnSignout` is enabled, upstream revocation runs before local state is cleared. A revocation failure therefore preserves the local session and its renewal timer; after revocation succeeds, a later browser or callback failure leaves the app locally signed out. Removing the user cancels its expiry timer without disabling renewal for a later sign-in with the same manager.

## Unsupported APIs

Use `signin()` and `signout()` for interactive flows. Redirect navigation, iframe logout, and browser session monitoring reject with `UNSUPPORTED_RUNTIME`. Resource Owner Password Credentials, DPoP, client secrets, exact background scheduling, and autonomous widget refresh are outside v1.

Only one interactive native authentication session and one configured manager are supported at a time.

## Development

```sh
npm run verify
npm run verify:ios
npm run verify:android
```

Physical-device verification remains required for Web Crypto, system consent UI, redirects, and shared widget access before a production release.

See [Publishing](docs/PUBLISHING.md) for the guarded npm trusted-publishing setup and release process.

## License

Apache-2.0
