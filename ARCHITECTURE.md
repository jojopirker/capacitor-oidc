# Architecture

`capacitor-oidc` adapts `oidc-client-ts` to Capacitor. It does not
implement OAuth or OpenID Connect protocol operations itself.

This document is the implementation boundary. Changes that move behavior across
that boundary require an ADR.

## Goals

- Use Authorization Code Flow with PKCE for public native clients.
- Present authorization and provider logout with platform authentication UI.
- Reuse `oidc-client-ts` for discovery, requests, response processing, user
  management, refresh, UserInfo, revocation, logout request construction, and
  events.
- Persist transaction and session state in platform-secure storage.
- Let a future iOS or Android widget read the stored session.
- Keep the custom code and dependency surface small.

## Non-goals

- Client secrets in an installed application.
- Resource Owner Password Credentials.
- Embedded WebView authentication.
- Iframe login, iframe logout, or browser session monitoring on native platforms.
- A custom `fetch`, a global `fetch` patch, or native OIDC networking.
- Guaranteed refresh while the operating system has suspended or terminated the
  application.
- DPoP in v1. DPoP requires a separate design for non-exportable native signing
  keys.
- Autonomous widget refresh in v1. Widgets may read the current session.

## Runtime model

```text
Application
    |
    v
CapacitorUserManager extends oidc-client-ts UserManager
    |                         |                         |
    v                         v                         v
CapacitorNavigator    CapacitorSecureStateStore   normal global fetch
    |                         |
    v                         v
native auth UI             TokenVault
```

### `oidc-client-ts` owns

- OIDC discovery and metadata.
- Authorization request construction.
- State, nonce, and PKCE values.
- Authorization response and token response processing.
- Code exchange and refresh-token grants.
- UserInfo and revocation requests.
- End-session request construction.
- The `User` model, events, and foreground expiry timer.

### This package owns

- Adapting `INavigator` to native authentication UI.
- Adapting `StateStore` to native secure storage.
- A native-readable, versioned session record for widgets.
- Refresh serialization and application-resume renewal.
- A small native-friendly API around interactive signin and signout.

### This package must not own

- Protocol request or response parsing.
- Discovery, token, UserInfo, or revocation HTTP clients.
- JWT or JOSE algorithms.
- Provider-specific branches in native code.

## Public API

The main type extends `UserManager` so callers retain its user model, events, and
non-browser-specific methods.

```ts
const manager = await CapacitorUserManager.create(settings, nativeOptions);

const user = await manager.signin();
const validUser = await manager.getValidUser();
await manager.revokeTokens();
await manager.signout();
await manager.cancel();
await manager.dispose();
```

`signin()` and `signout()` are the recommended interactive methods. A native
authentication session completes within the same promise, which matches
`oidc-client-ts` popup navigation semantics rather than browser page-redirect
semantics.

The settings type excludes insecure or browser-only choices:

```ts
type CapacitorUserManagerSettings = Omit<
  UserManagerSettings,
  | "client_secret"
  | "client_authentication"
  | "disablePKCE"
  | "response_type"
  | "userStore"
  | "stateStore"
  | "monitorSession"
  | "silent_redirect_uri"
>;
```

The implementation forces code flow, PKCE, secure native stores, and no native
iframe session monitoring.

## Interactive navigation

`CapacitorNavigator` implements `INavigator`. `prepare()` creates an `IWindow`;
`navigate()` sends the URL to the native bridge and resolves with the complete
callback URL; `close()` cancels the native session.

Only one native session may be active. Concurrent attempts fail with
`AUTH_SESSION_IN_PROGRESS`.

### iOS

- Use `ASWebAuthenticationSession`.
- Set a valid `presentationContextProvider` from the Capacitor view hierarchy.
- Default `prefersEphemeralWebBrowserSession` to `false` for shared SSO.
- Allow the caller to request an ephemeral session.
- Let iOS own the consent dialog, sheet, and browser appearance.
- Map system cancellation to `USER_CANCELLED`.
- Use the same implementation for authorization and end-session navigation.

### Android

- Prefer Android Auth Tab when supported.
- Fall back to Custom Tabs, never WebView.
- Return redirects through Activity Result handling.
- Support custom-scheme redirects and verified App Links.
- Use the same implementation for authorization and end-session navigation.

## Networking

`oidc-client-ts` uses the unmodified global `fetch` implementation.

- Do not patch `fetch`.
- Do not enable CapacitorHttp on behalf of the application.
- Do not provide a native fallback.
- Document that discovery, token, UserInfo, and revocation endpoints must allow
  the application's Capacitor origin through CORS.
- Require HTTPS authorization-server endpoints in production.

Static provider metadata can replace discovery, but it does not remove CORS
requirements from the other endpoints.

## Session renewal

`oidc-client-ts` performs scheduled foreground renewal. The adapter adds:

- A single-flight `signinSilent()` so rotating refresh tokens cannot be used by
  concurrent refresh requests.
- A foreground/resume check that refreshes an expired or nearly expired user.
- `getValidUser(minimumValiditySeconds)` for authenticated call sites.
- No iframe fallback when a refresh token is absent.

An `invalid_grant` refresh result clears the local session. A transient network
failure does not destroy the refresh token.

This design does not promise exact refresh timing while the app is suspended.

## Secure storage

Both `userStore` and `stateStore` use `CapacitorSecureStateStore`, implementing:

```ts
set(key, value)
get(key)
remove(key)
getAllKeys()
```

The store has separate transaction and session namespaces. Writes are atomic and
logs never contain stored values.

### iOS TokenVault

- Store secrets as Keychain generic-password items.
- Disable synchronization.
- Use a configurable Keychain/App Group access group.
- Use a `ThisDeviceOnly` accessibility class.
- Do not require biometrics by default, because unattended renewal must remain
  possible.

### Android TokenVault

- Generate a non-exportable AES-GCM key in Android Keystore.
- Store only ciphertext, IV, and format metadata in app-private no-backup storage.
- Do not use deprecated `EncryptedSharedPreferences`.
- Do not require user authentication for each key operation by default.

## Widget compatibility

The storage implementation is a public native library component, not private code
inside the Capacitor plugin class.

The vault exposes a versioned native session record:

```ts
interface StoredSessionV1 {
  version: 1;
  issuer: string;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt?: number;
}
```

An iOS widget uses the same Keychain/App Group entitlement. An Android widget in
the same application package uses the same vault. V1 allows reading a valid token;
native widget refresh is a future feature.

## Errors

Keep adapter errors small and stable:

- `AUTH_SESSION_IN_PROGRESS`
- `USER_CANCELLED`
- `BROWSER_UNAVAILABLE`
- `INVALID_CALLBACK`
- `SECURE_STORAGE_ERROR`
- `UNSUPPORTED_RUNTIME`

OIDC and OAuth server errors remain `oidc-client-ts` errors.

## Dependency gates

Do not publish a production version until both gates pass:

1. `crypto.subtle` works in packaged iOS and Android Capacitor WebViews.
2. The selected `oidc-client-ts` version correctly validates required ID-token
   issuer, audience, and expiration claims, or an upstream fix has been adopted.

Do not add crypto or validation workarounds to this package merely to make either
gate pass. Reconsider the protocol engine instead.
