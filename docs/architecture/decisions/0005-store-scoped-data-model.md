# 5. Every record belongs to a store

Date: 2026-10-17

## Status

Accepted

## Context

The first deployment is one store run by a couple, but the product may host other
people's stores later. Retrofitting tenancy onto a schema is expensive.

## Decision

- `stores` is the tenant root. Listings, images, sellers and categories carry
  `store_id`; administrators reach stores through `store_members` (role owner/admin).
- Admin routes are `/stores/:storeId/*` and pass a membership guard that answers 404
  for stores the user does not belong to. Ids in request bodies are checked against
  the store.
- Public routes take the store slug; the web app serves the store named by
  `STORE_SLUG` at its root.
- Categories are per store, created from a default set.

## Consequences

- Serving several stores needs routing (subdomain or path) and onboarding, not a
  schema migration.
- Every admin query is scoped, and cross-store access is covered by integration tests.
