# ADR 0004: Use one manager across platforms

## Status

Accepted

## Context

The first package boundary was intentionally native-only. It kept the custom
code small by adapting `oidc-client-ts` only where Capacitor needed native system
authentication UI and secure storage. Browser methods were rejected, and the
documentation told applications to instantiate `oidc-client-ts` directly for
web.

That boundary moved platform selection into every consuming application. A
cross-platform app had to duplicate common settings, create two manager types,
branch for sign-in, callbacks, refresh, and logout, and depend directly on the
underlying library. The package abstracted native mechanics but did not provide
the originally intended application-level abstraction.

## Decision

`CapacitorUserManager` is the public manager for web, iOS, and Android.
Configuration is split into:

- required `common` public-client settings;
- optional `web` settings and redirect-or-popup interaction choices;
- optional `native` settings and native options;
- optional `ios` and `android` overrides of the native section.

Resolution is shallow and happens once:

```text
web:     common -> web
iOS:     common -> native -> ios
Android: common -> native -> android
```

Web uses the upstream browser navigators and configured browser stores. Native
uses `CapacitorNavigator`, secure stores, refresh-token-only renewal, and the app
resume listener. `signin()` and `signout()` return `Promise<void>` on all
platforms; applications read session state through events or user accessors.

All platforms remain public clients using code flow with PKCE. Web-only
capabilities stay in the web settings. Native does not accept custom stores,
DPoP, iframe callbacks, or browser session monitoring.

## Consequences

- Applications no longer branch between two manager implementations or import
  `oidc-client-ts` directly for normal use.
- Web callbacks remain explicit application routes through `signinCallback()`
  and `signoutCallback()`.
- Platform-specific provider values and interaction arguments can differ without
  duplicating common configuration.
- The pre-1.0 native factory signature is normalized into the new implementation
  as a deprecated migration path. The `Promise<void>` sign-in contract remains a
  return-type change for applications that previously used the returned user.
- The package still owns no OIDC protocol implementation or provider-specific
  behavior.
