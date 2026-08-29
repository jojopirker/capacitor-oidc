# React example

This runnable React application demonstrates one `CapacitorUserManager`, web
callback handling, session restoration, renewal, and provider sign-out.

See the [React integration guide](../../docs/frameworks/REACT.md) for the
relevant application and provider setup.

From the repository root:

```sh
npm ci
npm run build
npm --prefix examples/react install
npm --prefix examples/react run dev
```

Use `npm run build` for the same type-check and production build run in CI.
