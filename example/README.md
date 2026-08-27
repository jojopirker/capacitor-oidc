# Example application

This Capacitor 8 application exercises the packaged plugin against the local
Keycloak realm in [`test/e2e/keycloak`](../test/e2e/keycloak). Its iOS UI test
signs in with Authorization Code Flow and PKCE, forces a refresh-token renewal,
and signs out at the provider.

From the repository root:

```sh
npm ci
npm run build
npm --prefix example ci
npm --prefix example run sync:ios
npm run e2e:keycloak:up
```

Boot an iPhone Simulator, trust the generated test CA, then open
`example/ios/App/App.xcodeproj` in Xcode and run the `App` scheme's tests:

```sh
xcrun simctl keychain booted add-root-cert test/e2e/keycloak/.certificates/ca.crt
```

Stop Keycloak afterward:

```sh
npm run e2e:keycloak:down
```

The test realm contains only the disposable `demo` / `demo` account. The iOS
app uses trusted local HTTPS at `localhost:8443`; the Simulator reaches Keycloak
through the Mac's loopback interface. Its local-network ATS exception is scoped
to this example app.
