# Angular example

This runnable standalone Angular application demonstrates one root
`CapacitorUserManager`, web callback handling, signal-based session state,
renewal, and provider sign-out.

See the [Angular integration guide](../../docs/frameworks/ANGULAR.md) for the
relevant application and provider setup.

From the repository root:

```sh
npm ci
npm run build
npm run e2e:keycloak:up
npm --prefix examples/angular install
npm --prefix examples/angular run dev
```

Sign in with the disposable `demo` / `demo` account. Stop the local realm with
`npm run e2e:keycloak:down` when finished.

The bundled localhost authority is for browser development. Replace
`environment.authority` with a device-reachable HTTPS authority before creating
a native build.

Use `npm run build` for the same Angular production build run in CI.
