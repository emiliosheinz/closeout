# Development guide

## Environment

`./scripts/setup-env.sh` copies `.env.example` to `.env` and fills
`INTERNAL_API_SECRET`. Every variable has a working development default:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Origin visitors use. Drives canonical URLs, link previews, WhatsApp messages and the Origin check on writes. Set it to the public HTTPS origin in production. |
| `STORE_SLUG`, `STORE_NAME` | Store served at the site root; created by the first `admin:create` or `seed:demo`. |
| `INTERNAL_API_SECRET` | Shared secret for web-to-api server calls (login, client IP forwarding). At least 32 characters; the API refuses to start otherwise. |
| `MEDIA_DIR` | Where the API stores image files (a Docker volume in development). |
| `POSTGRES_*` | Database connection. `POSTGRES_HOST_PORT` publishes Postgres on `127.0.0.1` for database tools. |

The API port is not published; the browser reaches it only through the web app's
`/api/v1/*` and `/media/*` rewrites.

## Running

```bash
docker compose up -d --wait   # start everything; waits for health checks
docker compose ps             # status
docker compose logs -f api    # follow API logs (also: web, migration, postgres)
docker compose down           # stop; data stays in the db-data and media-data volumes
```

Startup order is enforced by Compose: `setup` installs dependencies, `migration`
applies pending migrations once Postgres is healthy, then `api` starts, then `web`
once the API is healthy. Both apps hot-reload from the bind-mounted source.

`bin/closeout` with no arguments opens a shell in the `workspace` container; with
arguments it runs them there (`bin/closeout pnpm add -F web some-package`).

## Database

```bash
bin/closeout db migration:generate <Name>   # from the entity diff; read the SQL before committing
bin/closeout db migration:run
bin/closeout db migration:revert
bin/closeout db migration:show
```

After generating a migration, run `migration:generate` again and expect "No changes":
it proves the entities and the schema agree. Extensions (`uuid-ossp`, `citext`,
`unaccent`) are created by the initial migration.

## Administrators

```bash
bin/closeout cli admin:create --email <email> --name <name> [--whatsapp "+55 ..."]
bin/closeout cli admin:password --email <email>   # also signs the user out everywhere
```

Passwords need at least 10 characters. For non-interactive use set
`CLOSEOUT_PASSWORD` in the environment of the `bin/closeout` call. There is no
self-registration endpoint; these commands are the only way to create users.

Seller contact numbers are edited in the admin under **Vendedores** and must include
the country code (`+55 ...`). A seller without a number shows "contato indisponível"
instead of a WhatsApp button.

## Tests

| Command | What runs |
| --- | --- |
| `bin/closeout pnpm turbo test` | Unit tests (Jest) for api and web |
| `bin/closeout pnpm --filter api test:integration` | API integration suites. Each run creates a throwaway `closeout_test_*` database on the compose Postgres, applies the real migrations and drops it at the end. |
| `bin/closeout e2e` | Playwright against an isolated `closeout-e2e` Compose project with its own database, media and fixture admin; torn down afterwards. |
| `bin/closeout pnpm turbo check typecheck` | Biome lint + format check and `tsc --noEmit` |

`bin/closeout e2e <compose args>` passes arguments to the e2e project, e.g.
`bin/closeout e2e logs web`.

## Resetting local data

**This deletes every listing, account and uploaded photo in the local stack.**

```bash
docker compose down -v    # removes the db-data and media-data volumes
docker compose up -d --wait
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `required variable ... is missing` from Compose | Run `./scripts/setup-env.sh` (or `-f` to regenerate `.env`). |
| Postgres port already in use | Change `POSTGRES_HOST_PORT` in `.env`. |
| Port 3001 in use | Change `WEB_PORT` and the port in `PUBLIC_BASE_URL`. |
| `api` unhealthy | `docker compose logs api`; usually a compile error or a failed migration (`docker compose logs migration`). |
| Login always says "Muitas tentativas" | The limiter allows 10 failures per email and IP, 30 per email and 30 per IP in 15 minutes; restart the api container to clear it. |
| Uploaded photo rejected | Only JPEG, PNG and WebP up to 10 MB and 40 megapixels are accepted. iPhones convert HEIC to JPEG when uploading from Safari. |

## Production notes

The `prod` targets of `apps/api/Dockerfile` and `apps/web/Dockerfile` build
standalone images. A deployment needs Postgres, a persistent volume at `MEDIA_DIR`
for the API, `NODE_ENV=production` (Secure cookies, HSTS), `PUBLIC_BASE_URL` set to
the HTTPS origin, an `INTERNAL_API_SECRET` of at least 32 random characters, and only the web app exposed.
Apply migrations before starting the API. The production API image holds only the
compiled app, so run `pnpm turbo migration:run --filter=api` from a source checkout
or the tooling image (`docker/Dockerfile.cli`) with the production `POSTGRES_*`
variables. Put a reverse proxy (nginx, Caddy, a platform load balancer) in front of the web app
and have it set `X-Forwarded-For` to the real client address
(`proxy_set_header X-Forwarded-For $remote_addr;` in nginx). The login rate limiter
keys on the last hop of that header: 10 failures per email and IP, 30 per email and
30 per IP in 15 minutes. Without a proxy a client can forge it and only the per-email
limit protects an account. If every request arrives with the same address (a proxy
that does not set the header), the per-IP limit becomes shared: 30 failed logins from
anyone block all logins for 15 minutes.

### Moving media to object storage

Image files go through the `MediaStorage` interface
(`apps/api/src/media/media-storage.ts`). To use S3 or any S3-compatible service,
add an implementation of its three methods (`put`, `read`, `remove`) and bind it to
`MEDIA_STORAGE` in `media.module.ts`. File names stay the same, so existing rows need
no migration: copy the files from the volume to the bucket. Serving can stay behind
the API's `/media` route or move to a CDN by changing `mediaUrls()`.

## Towards multiple storefronts

Every tenant-owned row already carries `store_id`, admin routes are scoped to
`/stores/:storeId/*` behind a membership guard, and public routes take the store
slug. To serve more than one store:

1. Resolve the store per request (subdomain or `/s/:slug` path) instead of the
   `STORE_SLUG` setting in `apps/web/src/lib/site.ts`.
2. Add a store switcher to the admin (the `/me` response already lists memberships).
3. Add self-service onboarding (store creation + invitations) in place of the CLI.
4. Give `store_members.role` real permission differences when needed.
5. Move the login rate limiter from memory to Postgres or Redis before running more
   than one API instance.
