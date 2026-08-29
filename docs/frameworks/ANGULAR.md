# Angular integration

The [Angular example](/examples/angular/) keeps one OIDC manager in a root
service. The service completes browser callbacks, restores the current user,
and exposes signals for templates.

## Install

```sh
npm install capacitor-oidc @capacitor/app
npx cap sync
```

## Configure the provider

Keep deploy-specific values in an Angular environment file:

```ts
// src/environments/environment.ts
export const environment = {
  authority: 'https://identity.example.com',
  clientId: 'public-app',
};
```

## Create a root service

`providedIn: 'root'` gives the application one manager, independent of route
and component lifetimes:

```ts
@Injectable({ providedIn: 'root' })
export class OidcService {
  readonly user = signal<User | null>(null);

  private readonly manager = CapacitorUserManager.create({
    common: {
      authority: environment.authority,
      client_id: environment.clientId,
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
      options: { storageNamespace: 'angular-example' },
    },
  });
}
```

The runnable example keeps automatic renewal off so the bundled realm's
30-second test tokens can be renewed with the example's button. For a normal
provider, enable automatic renewal and keep its expiry-notification threshold
below the provider's access-token lifetime.

## Initialize from the root component

The service handles browser callbacks before exposing the restored user:

```ts
async initialize() {
  const auth = await this.manager;

  auth.events.addUserLoaded((user) => this.user.set(user));
  auth.events.addUserUnloaded(() => this.user.set(null));

  if (window.location.pathname === '/callback') {
    await auth.signinCallback();
    window.history.replaceState({}, '', '/');
  } else if (window.location.pathname === '/logout-callback') {
    await auth.signoutCallback();
    window.history.replaceState({}, '', '/');
  }

  this.user.set(await auth.getUser());
}
```

Call it once from the root component:

```ts
export class AppComponent implements OnInit {
  readonly oidc = inject(OidcService);

  ngOnInit() {
    void this.oidc.initialize();
  }
}
```

Native callbacks finish inside the plugin and do not need Angular Router
routes.

## Bind actions

The root service can expose `signin()`, `getValidUser(60)`, and `signout()` as
methods. Components read the current `user` signal and do not hold their own
manager.

Call `dispose()` only when the Angular application is shutting down.

## Run the example

```sh
npm ci
npm run build
npm run e2e:keycloak:up
npm --prefix examples/angular install
npm --prefix examples/angular run dev
```

This local realm workflow is for the browser example. Android resolves
`localhost` inside the device or emulator, and native platforms should not use
the example's cleartext HTTP authority. Before building for iOS or Android,
replace `environment.authority` with an HTTPS authority reachable from that
device and register the configured native callback scheme at the provider. See
[iOS and Android setup](../PLATFORM_SETUP.md).
