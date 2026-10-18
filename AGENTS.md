# Project overview

closeout is a personal storefront for selling pre-owned items through WhatsApp. It is
a Docker-first pnpm/Turborepo monorepo with two apps and a shared config package. The
API (NestJS + TypeORM + PostgreSQL) owns all persistence, authentication, store
membership, the catalog and image storage. The web app (Next.js App Router + React +
Tailwind) renders the public storefront and the admin UI and talks to the API over
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
bin/closeout cli admin:create --email ... --name ... [--whatsapp "+55 ..."]
```

Details: `docs/development.md`. Decisions: `docs/architecture/decisions/`.
CI (the `Checks` workflow) runs on every ready PR into `main` and lints its commit messages (Conventional Commits); checks and local repro: `docs/development.md` "Continuous integration".

# Architecture map

```text
apps/api/src/
  auth/        scrypt passwords, opaque hashed sessions, SessionGuard, login rate limiter
  security/    Origin check for writes, internal-secret trust, security headers
  stores/      stores, memberships (StoreMemberGuard), categories, settings, /me
  sellers/     seller contact profiles and WhatsApp number normalization
  catalog/     listings, photos, public catalog; listing-rules.ts holds the domain rules
  media/       image pipeline (sharp) behind the MediaStorage interface
  cli/         operator commands (admin:create, admin:password, seed:demo)
  database/    data source, entity list, migrations (generated)
apps/api/test/ integration suites (*.integration-spec.ts)
apps/web/src/
  app/(storefront)/   public catalog and item pages
  app/admin/          admin UI; (panel) layout requires a session
  app/api/auth/       login/logout route handlers (own the session cookie)
  components/         storefront/, admin/, ui/ (shadcn-style primitives)
  lib/                catalog/ (URL state, API client), admin/, format.ts, whatsapp.ts
apps/web/e2e-tests/   Playwright journeys
```

# Conventions

- Biome is the formatter and linter; run `check:fix` before committing.
- Only `apps/api` touches the database. The web app never imports from the API.
- Entities use `declare field: T`. Migrations are generated from the entity diff and
  reviewed; extensions are the only hand-written SQL.
- Every admin route lives under `/stores/:storeId/*` behind `SessionGuard` and
  `StoreMemberGuard`. Ids that arrive in a body must be checked against the store.
- Public payloads are built by allow-list mappers (`catalog/public-mappers.ts`); never
  serialize an entity.
- Domain rules (visibility, contactability, publishing) live in
  `catalog/listing-rules.ts`.
- All user-facing copy is Brazilian Portuguese; code, comments and docs are English.
  Labels and number formats live in `apps/web/src/lib/format.ts`.
- Use `Logger` in the API and `console.error` on the web side for diagnostics.
- Tests assert behavior: API integration tests hit a real database, no mocks of the
  app's own collaborators.
- Conventional Commits; no AI co-author trailers.

# Ask first

- Adding any dependency.
- Schema changes to existing tables with data.
- Changing an ADR-backed decision (write a superseding ADR).
