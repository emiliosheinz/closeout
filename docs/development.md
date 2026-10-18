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

Postgres runs major 18, the same as production. A `db-data` volume created under 17
will not start on 18: while still on 17, dump what you need (`docker compose exec
postgres pg_dumpall -U closeout > dump.sql`), then remove the volume (`docker compose down` and `docker
volume rm closeout_db-data`), start again, and restore with `psql` if you need the data.

## Administrators

```bash
bin/closeout cli admin:create --email <email> --name <name> [--whatsapp "+55 ..."]
bin/closeout cli admin:password --email <email>   # also signs the user out everywhere
```

Passwords need at least 10 characters. For non-interactive use set
`CLOSEOUT_PASSWORD` in the environment of the `bin/closeout` call. There is no
self-registration endpoint; these commands are the only way to create users.

Seller contact numbers are edited in the admin under **Vendedores** and must include
the country code (`+55 ...`). A listing can have several sellers; buyers pick whom to
message when more than one has a number. A listing none of whose sellers has a number
shows "contato indisponível" instead of a WhatsApp button.

## Tests

| Command | What runs |
| --- | --- |
| `bin/closeout pnpm test` | Unit tests (Jest) for api and web |
| `bin/closeout pnpm --filter api test:integration` | API integration suites. Each run creates a throwaway `closeout_test_*` database on the compose Postgres, applies the real migrations and drops it at the end. |
| `bin/closeout e2e` | Playwright against an isolated `closeout-e2e` Compose project with its own database, media and fixture admin; torn down afterwards. |
| `bin/closeout pnpm check && bin/closeout pnpm typecheck` | Biome lint + format over the whole repo (warnings fail) and `tsc --noEmit` per package |
| `bin/closeout db migration:check` | Fails when entities differ from the migrated schema |

`bin/closeout e2e <compose args>` passes arguments to the e2e project, e.g.
`bin/closeout e2e logs web`.

## Continuous integration

`.github/workflows/checks.yml` ("Checks") runs on every non-draft pull request into
`main`, and again on each new commit (a newer push cancels the older run). Drafts and
PRs into other branches run nothing; marking a draft ready for review starts the run. A
draft shows its checks as skipped, matrix checks under an unexpanded name; that is
expected. Retargeting an open PR to `main` starts no run until its next push. A PR with
merge conflicts against `main` gets no run at all: resolve the conflict to get checks.

Each check reports its own status, shown on the PR as `Checks / <name>`. A final
`Ready to merge` check passes only when every check below passed, so it is the one
status to require on `main`: **renaming it silently drops it from the required checks,
and a new job must be added to its `needs` list or it will not block merging.** The
commands below are exactly what CI runs.

| Check | Reproduce locally |
| --- | --- |
| `Lint and format` | `bin/closeout pnpm check` (Biome lint rules, import order and formatting, whole repo; warnings fail too) |
| `Type check` | `bin/closeout pnpm typecheck` |
| `Unit tests` | `bin/closeout pnpm test` |
| `Integration tests` | `bin/closeout pnpm --filter api test:integration` |
| `Migration drift` | `bin/closeout db migration:run && bin/closeout db migration:check` (fails and prints the SQL when entities and migrations disagree) |
| `Commit messages` | `git log -1 --format=%B <sha> \| bin/closeout pnpm --silent commitlint`, per commit. CI lints every non-merge commit in the PR |
| `Workflow files` | `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` |
| `Build API image` | `docker build -f apps/api/Dockerfile --target prod .` |
| `Build web image` | `docker build -f apps/web/Dockerfile --target prod .` |
| `End-to-end tests` | `bin/closeout e2e`. On failure or cancellation CI uploads `e2e-diagnostics` (HTML report, traces, every service log) for 7 days |

`.github/workflows/warm-caches.yml` ("Warm caches") runs on every push to `main` and
refreshes the dependency and image-layer caches that pull requests restore. It is the
only workflow that saves caches and reports none of the names above.

### Required check on `main`

The "Protect main" ruleset (Settings → Rules → Rulesets) requires `Ready to merge`, from
GitHub Actions, on every update to `main`, so pull requests merge only when it passes.
Check with `gh api repos/{owner}/{repo}/rules/branches/main`.

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

The web app caches the store, listing pages and the first page of the unfiltered
catalog for up to 5 minutes; searches, filters and later pages always read live data. Saves in the admin
expire that cache at once. Changes made elsewhere (`bin/closeout cli`, SQL) show on
the storefront within 5 minutes. The cache lives in each web instance, so running
several instances needs a shared Next.js cache handler.

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
