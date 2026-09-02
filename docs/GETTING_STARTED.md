# Getting started

## 1. Configure a public client

Create a public client at your identity provider with:

- Authorization Code Flow enabled;
- PKCE with the `S256` challenge method;
- no client secret;
- every web, iOS, and Android redirect URI registered exactly;
- every post-logout redirect URI registered exactly;
- the `openid` scope and any application scopes you need;
- refresh tokens or offline access when the app must renew sessions.

A minor difference in scheme, host, path, casing, or slash placement can prevent
a callback from completing.

## 2. Install the package

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

Complete the [iOS or Android setup](PLATFORM_SETUP.md) before running a native
build.

## 3. Create one manager

Create and retain one manager for the application session. The package detects
the current platform and resolves settings in this order:

```text
web:     common -> web
iOS:     common -> native -> ios
Android: common -> native -> android
```

Every merge is shallow, including configured sign-in and sign-out arguments.

```ts
import { CapacitorUserManager, WebStorageStateStore } from 'capacitor-oidc';

export const auth = await CapacitorUserManager.create({
  common: {
    authority: 'https://identity.example.com',
    client_id: 'public-app',
    scope: 'openid profile offline_access',
    automaticSilentRenew: true,
    loadUserInfo: true,
    revokeTokensOnSignout: true,
  },
  web: {
    settings: {
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: `${window.location.origin}/logout-callback`,
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    },
  },
  native: {
    settings: {
      redirect_uri: 'com.example.app:/callback',
      post_logout_redirect_uri: 'com.example.app:/logout-callback',
    },
    options: {
      prefersEphemeralWebBrowserSession: false,
      storageNamespace: 'primary',
    },
  },
  ios: {
    settings: { redirect_uri: 'com.example.ios:/callback' },
  },
  android: {
    settings: { redirect_uri: 'com.example.android:/callback' },
  },
});
```

The `web` and `native` sections are optional so a single-platform application
does not need unused settings. Creation fails clearly if the running platform has
no matching configuration.

Browser-only settings such as custom stores, DPoP, silent iframe callbacks, and
session monitoring belong in `web.settings`. Native stores and navigation are
owned by the package and cannot be replaced. Public clients cannot configure a
secret, disable PKCE, or change the response type on any platform.

## 4. Handle web callbacks

Call the matching callback method on the configured browser route:

```ts
if (window.location.pathname === '/callback') {
  await auth.signinCallback();
} else if (window.location.pathname === '/logout-callback') {
  await auth.signoutCallback();
}
```

Native callbacks are completed by the system authentication session and do not
need application routing.

## 5. Sign in

```ts
await auth.signin();
```

On web, `signin()` uses redirect navigation by default. Set `signinMode: 'popup'`
in the web section to use a popup. On native platforms it uses the system
authentication UI. The portable method returns no user because a browser redirect
leaves the page; read the user after the callback or subscribe to events:

```ts
auth.events.addUserLoaded((user) => {
  console.log('Signed in as', user.profile.sub);
});

auth.events.addSilentRenewError((error) => {
  console.error('Token renewal failed', error);
});
```

## 6. Get a usable access token

```ts
const user = await auth.getValidUser(30);

if (user) {
  await fetch('https://api.example.com/profile', {
    headers: { Authorization: `Bearer ${user.access_token}` },
  });
}
```

`getValidUser(30)` returns the current user when its access token is valid for at
least 30 more seconds. Otherwise it performs one renewal. On native platforms,
concurrent renewal triggers share the same request. Native renewal requires a
refresh token and never falls back to an iframe; web renewal retains the normal
browser behavior, including independent concurrent calls.

## 7. Sign out and dispose

```ts
await auth.signout();
await auth.dispose();
```

Web sign-out uses redirects by default and supports `signoutMode: 'popup'`.
Native sign-out uses the system authentication UI. Use `removeUser()` when the
application intentionally needs local-only logout.

Call `dispose()` when the manager will no longer be used. It stops renewal and,
on native platforms, removes the app-state listener and cancels pending native
navigation.
