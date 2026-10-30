# closeout

A personal storefront to sell the things you no longer need to people you know.

Visitors open a store's link, browse photos, prices and conditions, and message the
right seller on WhatsApp with a prefilled note. There is no cart, checkout or buyer
account. One deployment serves every store at `/store/<slug>`; each store's team
manages its catalog from an admin area.

## Quick start

Requirements: Docker with Compose. Nothing else is needed on the host.

```bash
./scripts/setup-env.sh          # creates .env with a random internal secret
docker compose up -d --wait     # postgres, migrations, api, web, workspace
```

Create a store and its owner. The password is prompted for; the store is created
when the slug is new:

```bash
bin/closeout cli admin:create --store nosso-desapego --store-name "Nosso Desapego" \
  --email you@example.com --name "Seu nome" --whatsapp "+55 11 99999-8888"
```

Everyone else joins by invite: the owner opens **Equipe**, creates an invite link
and sends it. Members are owners and admins, who manage the store, its team and
every listing, or sellers, who manage only their own listings. Each member has a
seller profile that buyers contact.

| URL | What |
| --- | --- |
| http://localhost:3001 | Landing page |
| http://localhost:3001/store/nosso-desapego | Public storefront |
| http://localhost:3001/admin | Admin area |

Optional demo content for a fresh local store: demo owner (unless the store has
one), admin and seller accounts (`owner@<slug>.test`, `admin@<slug>.test`,
`seller@<slug>.test`, password `demo-password`) and clearly marked listings with
abstract placeholder art. The command does nothing when the store already has
listings:

```bash
bin/closeout cli seed:demo --store nosso-desapego --store-name "Nosso Desapego"
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
and what multiple storefronts still need) is in [docs/development.md](docs/development.md).
Architecture decisions are recorded in [docs/architecture/decisions](docs/architecture/decisions).

## Structure

```text
apps/
  api/          NestJS + TypeORM API, the only database owner: auth, stores, catalog, media
  web/          Next.js App Router: public storefront and admin, talks to the API over HTTP
packages/
  config/       Shared Biome and TypeScript configuration
docker/         Development tooling image
bin/closeout    Docker wrapper for every command
scripts/        setup-env.sh
docs/           Development guide and architecture decision records
```
