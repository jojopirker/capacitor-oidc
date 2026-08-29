# API and `oidc-client-ts` compatibility

`CapacitorUserManager` extends `UserManager` from `oidc-client-ts`. Applications
use the package's manager on web, iOS, and Android; the package selects browser or
native navigation, storage, renewal, and lifecycle behavior.

## Portable API

| API                                          | Purpose                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| `CapacitorUserManager.create(configuration)` | Resolves the current platform and restores its stored user.   |
| `signin(args?)`                              | Starts the configured redirect, popup, or native interaction. |
| `signout(args?)`                             | Starts the configured provider logout interaction.            |
| `getValidUser(minimumValiditySeconds?)`      | Returns the user or performs one serialized renewal.          |
| `cancel()`                                   | Cancels pending native navigation; it is a no-op on web.      |
| `dispose()`                                  | Stops renewal and disposes platform lifecycle work.           |

`signin()` and `signout()` return `Promise<void>` consistently. Read user state
through `getUser()`, `getValidUser()`, or `events`. Configuration-level arguments
are shallowly merged with call-level arguments, with call values taking
precedence.

## Configuration

```ts
interface CapacitorUserManagerConfiguration {
  common: CapacitorUserManagerCommonSettings;
  web?: CapacitorWebUserManagerConfiguration;
  native?: CapacitorNativeUserManagerConfiguration;
  ios?: CapacitorNativeUserManagerOverride;
  android?: CapacitorNativeUserManagerOverride;
}
```

Resolution is `common -> web` in a browser and
`common -> native -> ios|android` on native platforms. All merges are shallow.

The web section accepts public-client `UserManagerSettings`, including custom
`stateStore` and `userStore`, DPoP, silent iframe settings, and session
monitoring. It also accepts:

```ts
interface CapacitorWebUserManagerConfiguration {
  settings: CapacitorWebUserManagerSettings;
  signinMode?: 'redirect' | 'popup';
  signoutMode?: 'redirect' | 'popup';
  signinArgs?: CapacitorSigninArgs;
  signoutArgs?: CapacitorSignoutArgs;
}
```

Popup sign-in defaults its popup callback to `settings.redirect_uri`. Popup
sign-out requires either `settings.post_logout_redirect_uri` or an explicit
`settings.popup_post_logout_redirect_uri`, which becomes the popup callback.

The native section and platform overrides accept native-compatible settings,
default arguments, and these options:

```ts
interface CapacitorOidcNativeOptions {
  prefersEphemeralWebBrowserSession?: boolean;
  storageNamespace?: string;
  ios?: {
    keychainAccessGroup?: string;
    keychainAccessibility?: 'afterFirstUnlockThisDeviceOnly' | 'whenUnlockedThisDeviceOnly';
  };
}
```

`storageNamespace` defaults to `default`. Use a stable application-specific
value and do not change it between releases unless intentionally starting a new
session store.

All platforms reject `client_secret`, `client_authentication`, `disablePKCE`,
and `response_type`. The manager forces Authorization Code Flow with PKCE.
Native settings additionally exclude browser stores, DPoP, iframe callbacks,
and browser session monitoring.

### Legacy native configuration

The native-only factory signature from earlier releases remains available so an
application can upgrade before moving its configuration:

```ts
const manager = await CapacitorUserManager.create(
  {
    authority: 'https://identity.example.com',
    client_id: 'mobile-app',
    redirect_uri: 'com.example.app:/callback',
    scope: 'openid profile offline_access',
  },
  { storageNamespace: 'primary' },
);
```

This signature and `CapacitorUserManagerSettings` are deprecated. They remain
native-only and do not infer browser settings. New code should use the layered
configuration above. `signin()` now returns `Promise<void>` for every factory
signature; use `getUser()`, `getValidUser()`, or events to read the signed-in
user.

## Inherited API by platform

| Upstream capability                        | Web                       | iOS and Android                 |
| ------------------------------------------ | ------------------------- | ------------------------------- |
| `getUser()`, `storeUser()`, `removeUser()` | Browser stores            | Secure native stores            |
| `signinRedirect()` and callback            | Supported                 | `UNSUPPORTED_RUNTIME`           |
| `signinPopup()`                            | Browser popup             | Native system authentication UI |
| `signinSilent()`                           | Refresh token or iframe   | Refresh token only              |
| `signoutRedirect()` and callback           | Supported                 | `UNSUPPORTED_RUNTIME`           |
| `signoutPopup()`                           | Browser popup             | Native system authentication UI |
| Silent logout and session monitoring       | Supported when configured | `UNSUPPORTED_RUNTIME`           |
| `revokeTokens()`, UserInfo, and events     | Supported                 | Supported                       |
| Resource Owner Password Credentials        | Unsupported               | Unsupported                     |

Browser callback dispatch through `signinCallback()` and `signoutCallback()` is
supported on web. Native callbacks complete inside the system authentication
session.

The package re-exports `User`, `WebStorageStateStore`, `StateStore`, and
`UserManagerEvents`, so normal application code does not need to import
`oidc-client-ts` directly.

## Adapter error codes

| Code                       | Meaning                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `AUTH_SESSION_IN_PROGRESS` | Another native login or logout is active.                                     |
| `USER_CANCELLED`           | The user or application cancelled the native system session.                  |
| `BROWSER_UNAVAILABLE`      | No compatible native browser exists or the request endpoint is insecure.      |
| `INVALID_CALLBACK`         | A native callback is absent, malformed, or does not match the configured URI. |
| `SECURE_STORAGE_ERROR`     | Keychain or Keystore-backed storage failed.                                   |
| `UNSUPPORTED_RUNTIME`      | Required platform configuration or capability is unavailable.                 |

OAuth and OIDC server errors remain upstream `oidc-client-ts` errors.
