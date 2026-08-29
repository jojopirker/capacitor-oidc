# Vue example

This runnable Vue application demonstrates one `CapacitorUserManager`, browser
callback handling, session restoration, renewal, and provider sign-out.

See the [Vue integration guide](../../docs/frameworks/VUE.md) for the relevant
application and provider setup.

From the repository root:

```sh
npm ci
npm run build
npm --prefix examples/vue install
npm --prefix examples/vue run dev
```

The bundled localhost authority is for browser development. Set
`VITE_OIDC_AUTHORITY` to a device-reachable HTTPS authority before creating a
native build.

Use `npm run build` for the same type-check and production build run in CI.
