# ADR 0003: Make session storage widget-readable

Status: accepted

## Decision

Implement the token vault as a reusable native component and store a versioned,
platform-neutral session record.

On iOS, sharing is opt-in through a Keychain/App Group. On Android, widgets in the
same application package use the same vault.

## Consequences

- Adding a widget later does not require migrating out of app-only storage.
- A widget can read the current session in v1.
- The canonical OIDC user record and native widget snapshot are separate writes.
  The snapshot is an eventually consistent cache, so widgets must tolerate an
  absent or temporarily stale value.
- Native widget refresh is explicitly deferred.
