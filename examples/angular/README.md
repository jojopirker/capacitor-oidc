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
npm --prefix examples/angular install
npm --prefix examples/angular run dev
```

Use `npm run build` for the same Angular production build run in CI.
