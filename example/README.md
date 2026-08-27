# Example application

This Capacitor 8 application exercises the packaged plugin against the local
Keycloak realm in [`test/e2e/keycloak`](../test/e2e/keycloak). Its iOS and
Android UI tests sign in with Authorization Code Flow and PKCE, force a
refresh-token renewal, and sign out at the provider.

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

For Android, build the example with its loopback-only authority, forward the
emulator port to the host, and run the instrumented test:

```sh
VITE_OIDC_AUTHORITY=http://localhost:8080/realms/capacitor-oidc-e2e \
  npm --prefix example run sync:android
adb reverse tcp:8080 tcp:8080
cd example/android
./gradlew connectedDebugAndroidTest
```

Stop Keycloak afterward:

```sh
npm run e2e:keycloak:down
```

The test realm contains only the disposable `demo` / `demo` account. The iOS
app uses trusted local HTTPS at `localhost:8443`; the Simulator reaches Keycloak
through the Mac's loopback interface. Its local-network ATS exception is scoped
to this example app. The Android test uses cleartext HTTP only for `localhost`;
the example app's network security configuration does not permit other
cleartext hosts.
