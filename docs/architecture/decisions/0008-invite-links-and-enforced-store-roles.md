# 8. Invite links and enforced store roles

Date: 2026-10-23

## Status

Accepted

Supersedes [3. Email and password login with opaque server-side sessions](0003-password-login-with-opaque-sessions.md)
for account creation and store access. Passwords, sessions, the cookie and the
login limiter are unchanged.

## Context

A store is now run by a team, not two operator-created administrators. Creating
every account with the CLI does not scale past the first owner, and the owner/admin
roles carried no permission difference, so anyone signed in could change anything
in the store.

## Decision

- Besides the operator CLI, accounts are created only by accepting an invite. Owners
  and admins issue invites from the admin for an email and a role (admin or seller).
- An invite link carries a random token; only its SHA-256 hash is stored. It is
  single-use, expires after 7 days, and can be regenerated (the old link stops
  working) or revoked while pending. The link is shown once, when issued.
- Lookup and acceptance are internal-only API endpoints (internal secret plus the
  visitor's IP), called by the web invite page and its route handler, which sets the
  session cookie on accept. Every invalid reason answers the same way. Invalid
  attempts are rate limited per client IP, in memory. The invite page sends no
  referrer.
- Roles are enforced: owner and admin manage the store, its team and every listing;
  a seller manages only the listings they sell and their own contact profile. Every
  store-scoped handler declares its allowed roles, and `StoreMemberGuard` refuses
  any handler that declares none. Listing reads and writes by a seller are checked
  per object.

## Consequences

- Owners grow their team without operator access; there is still no open
  registration and no password reset by email.
- A new store route must declare its roles or it is unreachable, so a forgotten
  declaration fails closed.
- The invite limiter shares the login limiter's constraint: per instance, reset on
  restart, and must move to a shared store before running more than one API
  instance.
- Removing a member deletes the account and its sessions at once.
