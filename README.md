# closeout

A personal storefront to sell the things you no longer need to people you know.

Visitors open one shared link, browse photos, prices and conditions, and message the
right seller on WhatsApp with a prefilled note. There is no cart, checkout or buyer
account. Sellers manage one shared catalog from an admin area.

## Quick start

Requirements: Docker with Compose. Nothing else is needed on the host.

```bash
./scripts/setup-env.sh          # creates .env with a random internal secret
docker compose up -d --wait     # postgres, migrations, api, web, workspace
```

Create the administrators, one per seller. The password is prompted for:

```bash
bin/closeout cli admin:create --email you@example.com --name "Seu nome" --whatsapp "+55 11 99999-8888"
bin/closeout cli admin:create --email partner@example.com --name "Nome dela" --whatsapp "+55 11 98888-7777"
```

The first admin becomes the store owner, and each admin gets a seller profile that
buyers contact. The store (`STORE_SLUG` and `STORE_NAME` in `.env`) is created by the
first `admin:create`.

| URL | What |
| --- | --- |
| http://localhost:3001 | Public storefront |
| http://localhost:3001/admin | Admin area |

Optional demo content for a fresh local store. The example listings are clearly
marked and use abstract placeholder art; the command does nothing when the store
already has listings:

```bash
bin/closeout cli seed:demo
```

To publish a real item: sign in, open **Novo anúncio**, fill in the name, price and
photos, and press **Salvar e publicar**. Copy the store link from **Loja**.

## Everyday commands

Every command runs inside a container through `bin/closeout`.

```bash
bin/closeout pnpm turbo check typecheck            # Biome lint + format check, TypeScript
bin/closeout pnpm turbo test                       # unit tests (api + web)
bin/closeout pnpm --filter api test:integration    # API against a throwaway database
bin/closeout e2e                                   # Playwright journeys in an isolated stack
bin/closeout db migration:show                     # migration status
bin/closeout cli admin:password --email you@example.com
docker compose logs -f api web
```

The full guide (environment, database, tests, resets, troubleshooting, production
and the path to multiple storefronts) is in [docs/development.md](docs/development.md), which also holds the Railway
production runbook.
Architecture decisions are recorded in [docs/architecture/decisions](docs/architecture/decisions).

## Structure

```text
apps/
  api/          NestJS + TypeORM API, the only database owner: auth, stores, catalog, media
  web/          Next.js App Router: public storefront and admin, talks to the API over HTTP
packages/
  config/       Shared Biome, TypeScript and Jest configuration
docker/         Development tooling image
bin/closeout    Docker wrapper for every command
scripts/        setup-env.sh
docs/           Development guide and architecture decision records
```
