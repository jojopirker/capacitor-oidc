# React integration

The [React example](/examples/react/) creates its OIDC manager outside the
component tree, restores the user when the application mounts, and keeps React
state aligned with the manager's user events.

## Install

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

## Create the manager outside React

A module-level promise prevents component renders from constructing multiple
managers:

```ts
// src/auth.ts
import { CapacitorUserManager } from 'capacitor-oidc';

const manager = CapacitorUserManager.create({
  common: {
    authority: import.meta.env.VITE_OIDC_AUTHORITY,
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
    scope: 'openid profile offline_access',
    automaticSilentRenew: true,
  },
  web: {
    settings: {
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: `${window.location.origin}/logout-callback`,
    },
  },
  native: {
    settings: {
      redirect_uri: 'com.example.oidc.react:/callback',
      post_logout_redirect_uri: 'com.example.oidc.react:/logout-callback',
    },
    options: { storageNamespace: 'react-example' },
  },
});

export function getUserManager() {
  return manager;
}
```

The runnable example supplies local Keycloak defaults. Set the two Vite
environment variables for your provider.

## Initialize from the application root

Complete browser callbacks, subscribe to user events, and restore the stored
user from the root component:

```tsx
useEffect(() => {
  void getUserManager().then(async (auth) => {
    auth.events.addUserLoaded(setUser);
    auth.events.addUserUnloaded(() => setUser(null));

    if (window.location.pathname === '/callback') {
      await auth.signinCallback();
      window.history.replaceState({}, '', '/');
    } else if (window.location.pathname === '/logout-callback') {
      await auth.signoutCallback();
      window.history.replaceState({}, '', '/');
    }

    setUser(await auth.getUser());
  });
}, []);
```

Native callbacks complete inside the plugin and do not require React Router
routes.

## Bind actions

```ts
await auth.signin();
setUser(await auth.getValidUser(60));
await auth.signout();
```

Retain the manager when React routes change. Call `dispose()` only when the
whole application is shutting down.

## Run the example

```sh
npm run e2e:keycloak:up
npm --prefix examples/react install
npm --prefix examples/react run dev
```

The bundled realm accepts web callbacks on `http://localhost:5173`. Add the
`com.example.oidc.react` scheme before running the example on iOS or Android.
See [iOS and Android setup](../PLATFORM_SETUP.md).
