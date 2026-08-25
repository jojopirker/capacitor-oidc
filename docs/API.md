# API and `oidc-client-ts` compatibility

`CapacitorUserManager` extends `UserManager` from `oidc-client-ts`. The adapter
adds a small native-friendly surface and preserves upstream session objects,
events, settings, refresh, UserInfo, and revocation behavior where they apply to
a native public client.

## Added API

| API                                                     | Purpose                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CapacitorUserManager.create(settings, nativeOptions?)` | Configures native storage and creates the manager.                       |
| `signin(args?)`                                         | Runs interactive Authorization Code Flow with PKCE in system UI.         |
| `signout(args?)`                                        | Runs provider logout in system UI.                                       |
| `getValidUser(minimumValiditySeconds?)`                 | Returns the user or performs one refresh-token renewal.                  |
| `cancel()`                                              | Rejects the pending native session.                                      |
| `dispose()`                                             | Stops renewal, removes the app listener, and cancels pending navigation. |

Only one configured manager and one interactive native authentication session are
supported at a time.

## Relevant inherited API

The following upstream APIs remain available:

- `getUser()`, `storeUser()`, and `removeUser()`;
- `signinSilent()` for refresh-token renewal;
- `revokeTokens()`;
- `startSilentRenew()` and `stopSilentRenew()`;
- `events`, including user-loaded, user-unloaded, token-expiring, token-expired,
  and silent-renew-error events;
- the upstream `User`, profile, settings, metadata, UserInfo, and token response
  types.

`signinPopup()` and `signoutPopup()` are inherited and use the native navigator,
but applications should prefer `signin()` and `signout()`.

## Unsupported browser API

These inherited browser-oriented methods reject with `UNSUPPORTED_RUNTIME`:

- `signinRedirect()`, `signinRedirectCallback()`, and `signinCallback()`;
- `signinSilentCallback()` and iframe-based silent authentication;
- `signoutRedirect()`, `signoutRedirectCallback()`, and `signoutCallback()`;
- `signoutSilent()` and `signoutSilentCallback()`;
- `querySessionStatus()`;
- Resource Owner Password Credentials.

The native settings type excludes:

- `client_secret` and `client_authentication`;
- `disablePKCE` and `response_type`;
- `dpop`;
- `monitorSession` and `silent_redirect_uri`;
- custom `stateStore` and `userStore`.

The adapter forces Authorization Code Flow with PKCE, secure native stores, and
no iframe session monitoring.

## Native options

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

`storageNamespace` defaults to `default`. Use a stable, application-specific
value and do not change it between releases unless intentionally starting a new
session store.

## Adapter error codes

| Code                       | Meaning                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `AUTH_SESSION_IN_PROGRESS` | Another native login or logout is active.                                |
| `USER_CANCELLED`           | The user or application cancelled the system session.                    |
| `BROWSER_UNAVAILABLE`      | No compatible browser exists or the request endpoint is insecure.        |
| `INVALID_CALLBACK`         | The callback is absent, malformed, or does not match the configured URI. |
| `SECURE_STORAGE_ERROR`     | Keychain or Keystore-backed storage failed.                              |
| `UNSUPPORTED_RUNTIME`      | Web Crypto is unavailable or a browser-only API was called.              |

OAuth and OIDC server errors remain upstream `oidc-client-ts` errors.

For the complete upstream model and event API, use the
[`oidc-client-ts` documentation](https://authts.github.io/oidc-client-ts/).
