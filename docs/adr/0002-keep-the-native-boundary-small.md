# ADR 0002: Keep the native boundary small

Status: accepted

## Decision

Native code owns only system authentication presentation and secure storage.

Native code must not implement discovery, code exchange, refresh, UserInfo,
revocation, end-session construction, JWT processing, or provider-specific logic.

## Consequences

- The implementation remains reviewable and has a small attack surface.
- The package uses normal JavaScript `fetch` and requires provider CORS support.
- A future widget that refreshes autonomously requires a separate ADR.
