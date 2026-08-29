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
        redirect_uri: 'com.example.oidc.angular:/callback',
        post_logout_redirect_uri: 'com.example.oidc.angular:/logout-callback',
      },
      options: { storageNamespace: 'angular-example' },
    },
  });
}
```

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
npm run e2e:keycloak:up
npm --prefix examples/angular install
npm --prefix examples/angular run dev
```

The example environment targets the bundled Keycloak realm and its web
callbacks on `http://localhost:5173`. Add the `com.example.oidc.angular` scheme
before running on iOS or Android. See
[iOS and Android setup](../PLATFORM_SETUP.md).
