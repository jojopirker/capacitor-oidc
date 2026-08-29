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
    automaticSilentRenew: false,
  },
  web: {
    settings: {
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: `${window.location.origin}/logout-callback`,
    },
  },
  native: {
    settings: {
      redirect_uri: 'capacitor-oidc-example:/callback',
      post_logout_redirect_uri: 'capacitor-oidc-example:/logout-callback',
    },
    options: { storageNamespace: 'react-example' },
  },
});

export function getUserManager() {
  return manager;
}

let callback: Promise<void> | undefined;

export function completeWebCallback(auth: CapacitorUserManager) {
  callback ??= (async () => {
    if (window.location.pathname === '/callback') {
      await auth.signinCallback();
      window.history.replaceState({}, '', '/');
    } else if (window.location.pathname === '/logout-callback') {
      await auth.signoutCallback();
      window.history.replaceState({}, '', '/');
    }
  })();

  return callback;
}
```

The runnable example supplies local Keycloak defaults and keeps automatic
renewal off so its 30-second test tokens can be renewed with the example's
button. For a normal provider, enable automatic renewal and keep its
expiry-notification threshold below the provider's access-token lifetime. Set
the two Vite environment variables for your provider.

## Initialize from the application root

Complete browser callbacks, subscribe to user events, and restore the stored
user from the root component:

```tsx
useEffect(() => {
  let active = true;
  let auth: CapacitorUserManager | undefined;
  const userLoaded = (user: User) => active && setUser(user);
  const userUnloaded = () => active && setUser(null);

  void getUserManager().then(async (manager) => {
    if (!active) return;
    auth = manager;
    manager.events.addUserLoaded(userLoaded);
    manager.events.addUserUnloaded(userUnloaded);
    await completeWebCallback(manager);
    const storedUser = await manager.getUser();
    if (active) setUser(storedUser);
  });

  return () => {
    active = false;
    auth?.events.removeUserLoaded(userLoaded);
    auth?.events.removeUserUnloaded(userUnloaded);
  };
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
npm ci
npm run build
npm run e2e:keycloak:up
npm --prefix examples/react install
npm --prefix examples/react run dev
```

This local realm workflow is for the browser example. Android resolves
`localhost` inside the device or emulator, and native platforms should not use
the example's cleartext HTTP authority. Before building for iOS or Android, set
`VITE_OIDC_AUTHORITY` to an HTTPS authority reachable from that device and
register the configured native callback scheme at the provider. See
[iOS and Android setup](../PLATFORM_SETUP.md).
