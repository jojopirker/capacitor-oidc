# Troubleshooting

## Login fails before system UI opens

- Confirm `crypto.subtle` and `crypto.getRandomValues` exist in the packaged
  Capacitor WebView.
- Confirm the authorization endpoint uses HTTPS.
- Confirm discovery succeeds, or provide complete static `metadata`.
- Inspect the error `code`; `BROWSER_UNAVAILABLE` and `UNSUPPORTED_RUNTIME`
  identify adapter failures.

## The provider reports a redirect mismatch

The authorization request's `redirect_uri` must exactly match a callback
registered for the provider client. Check scheme, host, port, path, case, and
trailing slashes. Wildcard callback hosts are commonly unsupported.

## Web login returns without a user

Make the configured web callback route call `signinCallback()`. A logout callback
route must call `signoutCallback()` instead. Both routes must use exactly the URI
registered with the provider.

## Android does not return to the app

- Keep `MainActivity` in `singleTask` launch mode.
- Put the callback intent filter inside the existing `MainActivity` declaration.
- Match the `<data android:scheme>` value to `redirect_uri`.
- If using HTTPS, verify the App Link and Digital Asset Links association.

See [Android setup](PLATFORM_SETUP.md#android).

## iOS does not show the expected sheet or consent dialog

`ASWebAuthenticationSession` controls both presentation and the provider-consent
dialog. The operating system decides when consent is required and can remember a
previous decision. Verify that the Capacitor view controller has an active window
and that the callback scheme is registered in the target.

## Token, UserInfo, refresh, or revocation fails with a network error

These requests use the runtime's normal `fetch`. Configure the provider endpoint
to allow both web application and Capacitor origins through CORS. Static discovery
metadata does not remove CORS requirements from token, UserInfo, refresh, or
revocation calls.

## No refresh token is available

- Request the provider's offline-access scope when required.
- Enable the refresh-token grant for the public client.
- Check provider-specific consent and rotation settings.

On native platforms, an expired user without a refresh token is removed and
`getValidUser()` returns `null`. Web behavior follows the configured upstream
silent-renew settings and may use an iframe.

## Startup renewal fails

On native platforms, `CapacitorUserManager.create()` restores secure local state
but does not wait for token renewal. When `automaticSilentRenew` is enabled, a
required startup renewal runs asynchronously and reports failures through
`silentRenewError`. Temporary token-endpoint failures preserve the stored
session; a terminal `invalid_grant` removes it. Web automatic renewal follows
`oidc-client-ts` behavior.

## Logout does not return to the app

Register the post-logout URI at the provider, add the browser callback route, and
register native schemes in each native application. Some providers use
non-standard parameters. Amazon Cognito uses `logout_uri`; see [Provider
configuration](PROVIDERS.md#amazon-cognito).

## `USER_CANCELLED` appears but Android UI remains visible

Android does not provide an API for forcibly closing an already-open Auth Tab or
Custom Tab. `cancel()` rejects the pending JavaScript operation and clears plugin
state; the user may still need to close the browser UI.
