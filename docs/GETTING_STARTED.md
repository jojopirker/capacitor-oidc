# Getting started

## 1. Configure a public client

Create a native or public client at your identity provider with:

- Authorization Code Flow enabled;
- PKCE with the `S256` challenge method;
- no client secret;
- an exact native redirect URI, such as `com.example.app:/callback`;
- an exact post-logout redirect URI when the provider supports one;
- the `openid` scope and any application scopes you need;
- a refresh-token or offline-access grant if the app must renew sessions.

The redirect URI must be registered at the provider and in the native app. A
minor difference in scheme, host, path, casing, or slash placement can prevent
the callback from completing.

## 2. Install the package

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

Complete the [iOS or Android setup](PLATFORM_SETUP.md) before running the app.

## 3. Create one manager

Create and retain one manager for the application session. Recreating managers
for individual API calls also recreates listeners and can produce competing
renewal work.

```ts
import { CapacitorUserManager } from 'capacitor-oidc';

export const auth = await CapacitorUserManager.create(
  {
    authority: 'https://identity.example.com',
    client_id: 'mobile-app',
    redirect_uri: 'com.example.app:/callback',
    post_logout_redirect_uri: 'com.example.app:/logout-callback',
    scope: 'openid profile offline_access',
    automaticSilentRenew: true,
    loadUserInfo: true,
    revokeTokensOnSignout: true,
  },
  {
    prefersEphemeralWebBrowserSession: false,
    storageNamespace: 'primary',
  },
);
```

`prefersEphemeralWebBrowserSession` defaults to `false`, allowing the system
browser to reuse an existing provider session. Set it to `true` when an isolated
session is more important than shared SSO. Android fallback browsers may ignore
the preference.

`create()` restores the stored user from secure native storage. When
`automaticSilentRenew` is enabled, any necessary renewal then runs without
blocking manager creation. Listen for `silentRenewError` to handle a failed
startup renewal; temporary failures preserve the stored session.

## 4. Sign in

```ts
const user = await auth.signin();

console.log(user.profile.sub);
```

The promise resolves after the system authentication session returns to the app,
the authorization response is validated, and the code is exchanged.

Listen for session changes through the normal `oidc-client-ts` events:

```ts
auth.events.addUserLoaded((user) => {
  console.log('Signed in as', user.profile.sub);
});

auth.events.addSilentRenewError((error) => {
  console.error('Token renewal failed', error);
});
```

## 5. Get a usable access token

```ts
const user = await auth.getValidUser(30);

if (!user) {
  // No signed-in session is available.
} else {
  await fetch('https://api.example.com/profile', {
    headers: { Authorization: `Bearer ${user.access_token}` },
  });
}
```

`getValidUser(30)` returns the current user when its access token is valid for at
least 30 more seconds. Otherwise it performs one refresh-token renewal. Concurrent
renewal triggers share the same request.

## 6. Sign out

```ts
await auth.signout();
```

`signout()` opens the provider's end-session endpoint in the same native system
authentication UI. Provider-specific parameters can be passed through
`extraQueryParams`; see [Provider configuration](PROVIDERS.md).

Use `removeUser()` when the application intentionally needs local-only logout.

## 7. Dispose application listeners

```ts
await auth.dispose();
```

Call `dispose()` when the manager will no longer be used. It stops silent renewal,
removes the Capacitor app-state listener, and cancels a pending native session.

## Browser builds

`CapacitorUserManager` depends on native Capacitor plugins and is not a web
replacement for `UserManager`. Applications that also run in a normal browser
should instantiate `UserManager` from `oidc-client-ts` for the web branch and
`CapacitorUserManager` for the native branch.
