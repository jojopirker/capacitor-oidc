# ADR 0001: Use `oidc-client-ts` as the protocol and session engine

Status: provisional

## Decision

Use `oidc-client-ts` for OIDC protocol work and foreground session management.
Extend `UserManager` only to adapt native navigation, secure storage, and Capacitor
lifecycle behavior.

## Constraints

- The package must pass the secure-context and ID-token-validation gates recorded
  in `ARCHITECTURE.md` before production release.
- We do not fork `oidc-client-ts` or duplicate its protocol implementation to work
  around a failed gate. A failed gate reopens this decision.

## Consequences

- Consumers retain the familiar `UserManager`, `User`, settings, and event model.
- Browser-only iframe behavior is intentionally unavailable on native platforms.
- OIDC endpoints used by JavaScript must support the Capacitor origin through CORS.
