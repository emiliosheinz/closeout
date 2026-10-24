# 3. Email and password login with opaque server-side sessions

Date: 2026-10-17

## Status

Accepted. Account creation and store access superseded by [8. Invite links and enforced store roles](0008-invite-links-and-enforced-store-roles.md).

## Context

Two administrators need to sign in. Fortuna uses Google sign-in, which would require
an OAuth client before the app can be used at all. Visitors never sign in.

## Decision

- Administrators sign in with email and password. Passwords are stored as salted
  scrypt hashes with their parameters encoded in the stored string.
- Sessions are opaque random tokens; only their SHA-256 hash is stored (Fortuna
  ADR-0008), with a fixed 30-day lifetime and revocation on logout and password reset.
- The web app's login route handler calls the API with an internal secret, receives
  the token and sets the cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
- Writes require the storefront's own `Origin` (or the internal secret); failed
  logins are rate limited per email+IP and per email, in memory.
- Accounts are created only by the operator CLI; there is no registration endpoint.

## Consequences

- Works offline and on first boot with no third-party setup.
- The in-memory limiter resets on restart and is per instance; it must move to a
  shared store before running more than one API instance.
- No password reset by email; the operator resets passwords with the CLI.
