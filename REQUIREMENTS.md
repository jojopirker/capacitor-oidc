# Requirements and acceptance criteria

## Security

- [ ] Production uses Authorization Code Flow with PKCE.
- [ ] The package never accepts or stores a client secret.
- [ ] Authorization and logout use external system authentication UI, never a
      WebView.
- [ ] State and nonce mismatch responses are rejected.
- [ ] The selected OIDC engine validates required ID-token claims.
- [ ] Tokens, authorization state, nonce, and PKCE verifier are encrypted at rest.
- [ ] Logs and errors never include tokens, authorization codes, or PKCE values.
- [ ] Logout revokes before clearing when revocation is requested.
- [ ] Local state is cleared after terminal `invalid_grant`.
- [ ] No global `fetch` patch is installed.

## iOS

- [ ] Login uses `ASWebAuthenticationSession` with a presentation context.
- [ ] iOS presents its system provider-consent UI when required by the operating
      system.
- [ ] Login and logout appear in system-controlled modal authentication UI.
- [ ] User cancellation rejects with `USER_CANCELLED`.
- [ ] Shared and ephemeral browser sessions are selectable.
- [ ] Keychain entries are device-only and non-synchronizing.
- [ ] A configured Keychain/App Group allows a widget extension to read the
      session.

## Android

- [ ] Login uses a system Custom Tab.
- [ ] No authorization page is displayed in WebView.
- [ ] User cancellation rejects with `USER_CANCELLED`.
- [ ] Custom schemes and verified App Links return the callback to the existing
      `singleTask` host activity.
- [ ] The encryption key is held by Android Keystore.
- [ ] An app widget in the same package can read the session.

## OIDC behavior

- [ ] Discovery works with a conforming provider.
- [ ] Explicit metadata can replace discovery.
- [ ] Code exchange succeeds with a public client.
- [ ] UserInfo can be loaded through the upstream setting.
- [ ] Access and refresh tokens can be revoked.
- [ ] `signout()` opens the provider end-session endpoint and handles its callback.
- [ ] Provider-specific logout parameters can be supplied through upstream extra
      query parameters.
- [ ] All OIDC HTTP calls use normal `fetch` and document their CORS requirement.

## Session lifecycle

- [ ] Foreground automatic renewal uses a refresh token.
- [ ] Renewal never falls back to an iframe on native platforms.
- [ ] Concurrent renewal triggers share one request.
- [ ] Returning to the foreground refreshes an expired or nearly expired token.
- [ ] `getValidUser()` returns a sufficiently valid user or performs one refresh.
- [ ] Refresh-token rotation is persisted atomically in the canonical user record.
- [ ] Temporary network failure retains the stored session.
- [ ] Logout stops renewal and removes local state.

## API

- [ ] The package is published as `capacitor-oidc`.
- [ ] `CapacitorUserManager` exposes upstream settings, events, user data, UserInfo,
      refresh, and revocation behavior where applicable to native clients.
- [ ] Recommended interactive methods are `signin()` and `signout()`.
- [ ] The adapter adds only `signin()`, `signout()`, `getValidUser()`, `cancel()`,
      and `dispose()`.
- [ ] Unsupported browser-only methods fail clearly or are excluded by type.

## Verification matrix

- [ ] Packaged iOS simulator build.
- [ ] Packaged physical iOS build.
- [ ] Packaged Android emulator build.
- [ ] Packaged physical Android build.
- [ ] Login, cancel, code exchange, app restart, and logout.
- [ ] Refresh before expiry and refresh after resume beyond expiry.
- [ ] Refresh-token rotation and concurrent refresh trigger.
- [ ] Revocation and UserInfo.
- [ ] Invalid state, invalid nonce, and invalid callback.
- [ ] Provider without a refresh token.
- [ ] Provider CORS rejection produces a clear network error without fallback.
- [ ] iOS widget target reads the shared session.
- [ ] Android app widget reads the shared session.
- [ ] At least two OIDC providers, including a local configurable provider.

## Explicitly deferred

- DPoP.
- Biometric-gated token access.
- Autonomous widget refresh.
- Exact background refresh scheduling.
- Browser iframe session monitoring.
- Compatibility with the legacy `generic-oauth2` API.
