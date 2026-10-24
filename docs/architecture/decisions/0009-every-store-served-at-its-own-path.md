# 9. Every store served at its own path

Date: 2026-10-23

## Status

Accepted

Supersedes [5. Every record belongs to a store](0005-store-scoped-data-model.md)
for how stores are served and selected. The store-scoped data model, the
membership guard and per-store categories are unchanged.

## Context

The web app served the one store named by `STORE_SLUG` at its root, so each new
store needed its own deployment and configuration. The data model was already
multi-store; only routing and store selection were not.

## Decision

- One web deployment serves every store at `/store/<slug>`, with items at
  `/store/<slug>/items/<item>`. The site root is a landing page that lists no
  stores. Canonical URLs, link previews, WhatsApp messages, the sitemap and admin
  links all use the store path.
- `STORE_SLUG` and `STORE_NAME` are retired. The CLI takes the store from
  `--store <slug>` (and `--store-name` when creating it).
- The admin resolves the store from the signed-in user's membership. A user
  belongs to exactly one store until multi-store membership lands (issue #12).

## Consequences

- Adding a store is a CLI call, not a deployment.
- Old root and `/itens/<item>` links no longer resolve; they show not-found.
- The sitemap lists every store, so a store is discoverable by search engines once
  it has published listings.
- Belonging to two stores needs a store switcher in the admin before the
  one-membership rule can be lifted.
