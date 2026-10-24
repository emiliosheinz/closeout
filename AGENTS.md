# Project overview

closeout is a personal storefront for selling pre-owned items through WhatsApp. It is
a Docker-first pnpm/Turborepo monorepo with two apps and a shared config package. The
API (NestJS + TypeORM + PostgreSQL) owns all persistence, authentication, store
membership and roles, invites, the catalog and image storage. The web app (Next.js App
Router + React + Tailwind) renders every store's storefront at `/store/<slug>`, a
landing page at `/` and the admin UI and talks to the API over
HTTP: server-side with `API_BASE_URL`, from the browser through the `/api/v1/*` and
`/media/*` rewrites in `apps/web/src/proxy.ts`.

# Commands

All compute runs inside containers. Never run pnpm, jest, turbo or nest on the host.

```bash
./scripts/setup-env.sh && docker compose up -d --wait
bin/closeout pnpm check && bin/closeout pnpm typecheck  # must be clean
bin/closeout pnpm turbo check:fix                  # auto-fix formatting
bin/closeout pnpm test                             # unit tests
bin/closeout pnpm --filter api test:integration    # real Postgres, per-run database
bin/closeout e2e                                   # Playwright, isolated compose project
bin/closeout db migration:generate <Name>          # then re-run: must say "No changes"
bin/closeout cli admin:create --store <slug> --store-name <name> --email ... --name ... [--whatsapp "+55 ..."]
bin/closeout cli seed:demo --store <slug> --store-name <name>   # demo members and listings
```

Details: `docs/development.md`. Decisions: `docs/architecture/decisions/`.
Production on Railway (setup, operator CLI, rollback, rotation, limits): `docs/development.md` "Production on Railway".
CI (the `Pull request checks` workflow) runs on every ready PR into `main` and lints its commit messages (Conventional Commits); checks and local repro: `docs/development.md` "Continuous integration".

# Architecture map

```text
apps/api/src/
  auth/        scrypt passwords, opaque hashed sessions, SessionGuard, login rate limiter
  security/    Origin check for writes, internal-secret trust, security headers
  stores/      stores, memberships and roles (StoreMemberGuard, @Roles), team, categories, settings, /me
  invites/     single-use invite links: issue, regenerate, revoke, lookup and accept
  sellers/     seller contact profiles and WhatsApp number normalization
  catalog/     listings, photos, public catalog; listing-rules.ts holds the domain rules
  media/       image pipeline (sharp) behind the MediaStorage interface
  cli/         operator commands (admin:create, admin:password, seed:demo)
  database/    data source, entity list, migrations (generated)
apps/api/test/ integration suites (*.integration-spec.ts)
apps/web/src/
  app/         Next routing tree: route files only re-export from _pages / _app; robots, sitemap (proxy.ts sits beside it)
  _app/        admin panel layout and nav, root/store layouts and error pages, api route handlers (auth, revalidate, health)
  _pages/      one slice per page (admin-listings, admin-team, store-catalog, invite, ...) with its own ui/model
  widgets/     listing-view, the one block shared by the item page and the admin preview
  features/    user actions: listing-form, listing-actions, manage-photos, edit-store, member-actions, invite-actions, catalog-filter
  entities/    listing, member, invite, session: types, API reads, display pieces; index.server.ts holds server-only code
  shared/      api (http client, server fetcher), ui (shadcn primitives, dialogs), lib (format, money, site, whatsapp), config
apps/web/e2e-tests/   Playwright journeys
```

# Conventions

- Biome is the formatter and linter; run `check:fix` before committing.
- Only `apps/api` touches the database. The web app never imports from the API.
- Entities use `declare field: T`. Migrations are generated from the entity diff and
  reviewed; extensions are the only hand-written SQL.
- Every admin route lives under `/stores/:storeId/*` behind `SessionGuard` and
  `StoreMemberGuard`, and declares its roles with `@Roles` (undeclared handlers are
  refused). Sellers reach only listings they sell. Ids that arrive in a body must be
  checked against the store.
- Public payloads are built by allow-list mappers (`catalog/public-mappers.ts`); never
  serialize an entity.
- Domain rules (visibility, contactability, publishing) live in
  `catalog/listing-rules.ts`.
- All user-facing copy is Brazilian Portuguese; code, comments and docs are English.
  Labels and number formats live in `apps/web/src/shared/lib/format.ts`.
- Web code follows Feature-Sliced Design: layers import only downward
  (`_app` > `_pages` > `widgets` > `features` > `entities` > `shared`), slices never import
  each other within a layer, and a slice is imported through its `index.ts` (or
  `index.server.ts` for server-only code). `shared` and `_app` have no slices, so their
  modules are imported directly; `app/` route files are not checked. Enforced by
  `apps/web/scripts/check-fsd-imports.sh`, which `pnpm check` runs.
- An API response-shape change and the web change that consumes it ship in a separate PR
  each (or the new field stays optional on the web for one release). Both services deploy
  from one commit and the API waits on its migration, so for a moment the web runs against
  the old API. A new field ships API first; a new enum value ships web first.
- Use `Logger` in the API and `console.error` on the web side for diagnostics.
- Tests assert behavior: API integration tests hit a real database, no mocks of the
  app's own collaborators.
- Conventional Commits; no AI co-author trailers.

# Ask first

- Adding any dependency.
- Schema changes to existing tables with data.
- Changing an ADR-backed decision (write a superseding ADR).
