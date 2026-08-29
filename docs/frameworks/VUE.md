# Vue integration

The [Vue example](/examples/vue/) is a small Capacitor application with one
OIDC manager for the application lifetime. It restores the stored user when
Vue mounts, completes browser callbacks, and exposes sign-in, renewal, and
sign-out actions.

## Install

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

## Create the manager once

Keep manager creation outside Vue components so route changes cannot create a
second manager:

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
    options: { storageNamespace: 'vue-example' },
  },
});

export function getUserManager() {
  return manager;
}
```

The runnable example supplies local Keycloak defaults as a convenience and
keeps automatic renewal off so its 30-second test tokens can be renewed with
the example's button. For a normal provider, enable automatic renewal and keep
its expiry-notification threshold below the provider's access-token lifetime.
Use environment variables for your provider in an application.

## Restore state and handle callbacks

Initialize authentication from the root component. Browser callback routes
must be handled before rendering the restored user:

```ts
const auth = await getUserManager();

if (window.location.pathname === '/callback') {
  await auth.signinCallback();
  window.history.replaceState({}, '', '/');
} else if (window.location.pathname === '/logout-callback') {
  await auth.signoutCallback();
  window.history.replaceState({}, '', '/');
}

user.value = await auth.getUser();

auth.events.addUserLoaded((loadedUser) => {
  user.value = loadedUser;
});

auth.events.addUserUnloaded(() => {
  user.value = null;
});
```

Native callbacks are completed by the plugin and do not need Vue Router
routes.

## Bind actions

```ts
await auth.signin();
user.value = await auth.getValidUser(60);
await auth.signout();
```

Call `dispose()` only when the application is shutting down, not whenever a
route component unmounts.

## Run the example

Start the repository's local Keycloak realm, then start the Vue app:

```sh
npm ci
npm run build
npm run e2e:keycloak:up
npm --prefix examples/vue install
npm --prefix examples/vue run dev
```

Sign in with the disposable `demo` / `demo` account. Stop the local realm with
`npm run e2e:keycloak:down` when finished.

This local realm workflow is for the browser example. Android resolves
`localhost` inside the device or emulator, and native platforms should not use
the example's cleartext HTTP authority. Before building for iOS or Android, set
`VITE_OIDC_AUTHORITY` to an HTTPS authority reachable from that device and
register the configured native callback scheme at the provider. See
[iOS and Android setup](../PLATFORM_SETUP.md).
