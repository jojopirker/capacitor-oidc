# Sessions, secure storage, and widgets

## Canonical session storage

The canonical `oidc-client-ts` user and authorization transaction state are
stored in separate native-secure namespaces. Values are never written to
`localStorage`.

- iOS stores generic-password items in Keychain with synchronization disabled.
- Android encrypts values with AES-GCM using a non-exportable Android Keystore
  key and writes ciphertext to app-private no-backup storage.

The default iOS accessibility is `AfterFirstUnlockThisDeviceOnly`. Biometric
gating is not enabled because unattended foreground renewal must remain possible.

## Renewal lifecycle

When `automaticSilentRenew` is enabled, `oidc-client-ts` schedules renewal while
the JavaScript runtime is active. The adapter also checks the current user after
manager creation and when the application resumes. These adapter checks do not
run when automatic silent renewal is disabled.

Native silent renewal requires a refresh token and never falls back to an iframe.
Concurrent renewal requests share one operation so a rotating refresh token is
not used twice. A terminal `invalid_grant` removes the local user; a temporary
network failure preserves it and is reported through `silentRenewError`. Renewal
does not block manager creation.

The operating system can suspend or terminate the process. The package therefore
does not guarantee exact background refresh timing.

## Widget snapshot

Each successful canonical user write also updates a versioned `StoredSessionV1`
snapshot containing:

- issuer and client ID;
- access token and expiration;
- refresh token when issued;
- ID token when issued;
- token type and scope.

The refresh and ID tokens are intentionally retained so a future coordinated
native widget-refresh implementation does not require a storage-format migration.
This makes the widget extension part of the same credential trust boundary as
the host application.

The current plugin does **not** perform autonomous widget refresh. Widgets can use
a valid access token from the snapshot, but they must tolerate an expired, absent,
or temporarily stale snapshot. Independently rotating a refresh token in widget
code can invalidate the canonical application session and is not currently a
supported workflow.

The snapshot is an eventually consistent cache: the canonical OIDC user and the
snapshot are separate writes.

## iOS widget access

Configure the same Keychain Sharing entitlement on the application and WidgetKit
extension. Both targets normally declare
`$(AppIdentifierPrefix)group.com.example.app`; the JavaScript option uses the
expanded `TEAMID.group.com.example.app` value.

```swift
let vault = TokenVault(accessGroup: "TEAMID.group.com.example.app")
let session = try vault.loadSession(namespace: "primary")
```

Configuring `keychainAccessGroup` places the plugin's canonical session,
transaction state, and widget snapshot in that shared access group. Do not grant
the entitlement to an extension you do not trust with the complete OIDC session.

## Android widget access

An Android app widget in the same application package and UID can use the public
native vault:

```java
TokenVault vault = new TokenVault(context);
StoredSessionV1 session = vault.loadSession("primary");
```

Before using `session.accessToken`, compare `session.expiresAt` with the current
time and leave enough margin for the widget request to complete.
