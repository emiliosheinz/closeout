# Development guide

## Environment

`./scripts/setup-env.sh` copies `.env.example` to `.env` and fills
`INTERNAL_API_SECRET`. Every variable has a working development default:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Origin visitors use. Drives canonical URLs, link previews, WhatsApp messages and the Origin check on writes. Set it to the public HTTPS origin in production. |
| `INTERNAL_API_SECRET` | Shared secret for web-to-api server calls (login, client IP forwarding). At least 32 characters; the API refuses to start otherwise. |
| `MEDIA_DIR` | Where the API stores image files (a Docker volume in development). |
| `LOG_LEVEL` | API log level: `fatal`, `error`, `warn`, `info` (default), `debug` or `trace`. Anything else stops the API at boot. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | API tracing. Unset (the default), the API exports nothing. Set to an `http(s)` URL, it exports traces there. On Railway the platform sets it. |
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

### Logs, health and tracing

The API writes one JSON line per event to stdout. With `NODE_ENV=development` (the
Compose setup) lines are pretty-printed instead; production never is. Every request
gets an id, taken from a valid incoming `x-request-id` or generated, echoed on the
response and carried as `reqId` on each line logged while handling it, so one request
is found with `docker compose logs api | grep <id>`. One line is written when a
request completes, except for `/health`. Lines inside a traced request also carry
`trace_id`. Passwords, tokens, invite links and the internal secret never reach a
line, and driver errors are reduced to their SQLSTATE code and object names because
their messages echo bound values.

`GET /health` on the API runs `SELECT 1` and returns 200 `{"status":"ok"}` with the
database check, or 503 when Postgres does not answer within 3 seconds. It checks the
database only: it is the Compose and Railway readiness probe, and a failure logs only
its outcome. The web `GET /health` returns 200, or 503 naming the required variables
that are missing or unusable (never their values).

Tracing is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Then the API exports HTTP,
Postgres and S3 spans over OTLP, keeping an allow-list of attributes: no query strings,
client addresses, user agents, request data, span events or error messages.

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

## Stores and members

One deployment serves every store: the storefront of store `<slug>` is at
`/store/<slug>` (items at `/store/<slug>/items/<item>`), and `/` is a landing page that
lists no stores. The admin at `/admin` shows the signed-in user's store; a user
belongs to one store.

```bash
bin/closeout cli admin:create --store <slug> --store-name <name> --email <email> --name <name> [--whatsapp "+55 ..."]
bin/closeout cli seed:demo --store <slug> --store-name <name> [--whatsapp "+55 ..."]
bin/closeout cli admin:password --email <email>   # also signs the user out everywhere
```

`admin:create` creates the store (with the default categories) when the slug is new,
then the user, an owner membership (admin when the store already has an owner) and a
contact profile. `--store-name` is required for a new store and ignored otherwise.
`seed:demo` adds demo members (`owner@<slug>.test` unless the store has an owner,
`admin@<slug>.test`, `seller@<slug>.test`, password `demo-password`) and demo listings;
it does nothing when the store already has listings.

Passwords need at least 10 characters. For non-interactive use set
`CLOSEOUT_PASSWORD` in the environment of the `bin/closeout` call. There is no
self-registration: everyone after the first owner joins through an invite.

Roles: owners and admins manage the store settings (**Loja**), the team and every
listing; sellers manage only the listings they sell and their own contact profile.
Owners and admins invite people from **Equipe**: the invite link is shown once, is
single-use and expires after 7 days; it can be regenerated or revoked while pending.

Seller contact numbers are edited in the admin under **Equipe** and must include
the country code (`+55 ...`). A listing can have several sellers; buyers pick whom to
message when more than one has a number. A listing none of whose sellers has a number
shows "contato indisponível" instead of a WhatsApp button.

## Tests

| Command | What runs |
| --- | --- |
| `bin/closeout pnpm test` | Unit tests for api and web (both Vitest) |
| `bin/closeout pnpm turbo test:integration --filter=api` | API integration suites. Each run creates a throwaway `closeout_test_*` database on the compose Postgres, applies the real migrations and drops it at the end. |
| `bin/closeout e2e` | Playwright against an isolated `closeout-e2e` Compose project with its own database, media and two fixture stores with their members; torn down afterwards. |
| `bin/closeout pnpm check && bin/closeout pnpm typecheck` | Biome lint + format over the whole repo (warnings fail) and `tsc --noEmit` per package |
| `bin/closeout db migration:check` | Fails when entities differ from the migrated schema |

`bin/closeout e2e <compose args>` passes arguments to the e2e project, e.g.
`bin/closeout e2e logs web`.

## Continuous integration

`.github/workflows/pull-request-checks.yml` ("Pull request checks") runs on every
non-draft pull request into `main`, and again on each new commit (a newer push cancels
the older run). Drafts and PRs into other branches run nothing; marking a draft ready
for review starts the run. A draft shows its checks as skipped, matrix checks under an
unexpanded name; that is expected. Retargeting an open PR to `main` starts no run until
its next push. A PR with merge conflicts against `main` gets no run at all: resolve the
conflict to get checks.

Each check reports its own status, shown on the PR as `Pull request checks / <name>`. A
final `Ready to merge` check passes only when every check below passed, so it is the
one status to require on `main`: **renaming it silently drops it from the required
checks, and a new job must be added to its `needs` list or it will not block merging.**
The commands below are exactly what CI runs.

| Check | Reproduce locally |
| --- | --- |
| `Lint and format` | `bin/closeout pnpm check` (Biome lint rules, import order and formatting, whole repo; warnings fail too) |
| `Type check` | `bin/closeout pnpm typecheck` |
| `Unit tests` | `bin/closeout pnpm test` |
| `Integration tests` | `bin/closeout pnpm turbo test:integration --filter=api` |
| `Migration drift` | `bin/closeout db migration:run && bin/closeout db migration:check` (fails and prints the SQL when entities and migrations disagree) |
| `Commit messages` | `git log -1 --format=%B <sha> \| bin/closeout pnpm --silent commitlint`, per commit. CI lints every non-merge commit in the PR |
| `Workflow files` | `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` |
| `Build API image` | `docker build -f apps/api/Dockerfile --target prod .` |
| `Build web image` | `docker build -f apps/web/Dockerfile --target prod .` |
| `End-to-end tests` | `bin/closeout e2e`. On failure or cancellation CI uploads `e2e-diagnostics` (HTML report, traces, every service log) for 7 days |

`.github/workflows/warm-main-caches.yml` ("Warm main caches") runs on every push to
`main` and refreshes the dependency and image-layer caches that pull requests restore.
It is the only workflow that saves caches and reports none of the names above.

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

## Production on Railway

Production runs the `prod` images on Railway, declared in `.railway/railway.ts`.

The web app must sit behind a proxy that sets `X-Real-IP` to the client address and
overwrites any value the client sent (Railway's edge does; in nginx,
`proxy_set_header X-Real-IP $remote_addr;`). The login rate limiter keys on it: 10
failures per email and IP, 30 per email, 30 per IP in 15 minutes. Without such a
proxy a client can forge it; if every request arrives with the same address, 30
failed logins from anyone block all logins for 15 minutes.

The web app caches the store, listing pages and the first unfiltered catalog page
for up to 5 minutes; admin saves expire that cache, other changes (CLI, SQL) show
within 5 minutes. The cache is per instance.

### Overview

One environment, `production`, in the Railway project "Closeout", deploying `main`:
`web` (public), `api` (private network only), Postgres 18 and a private media
bucket. There are no backups, which is why the data-store guard
refuses any plan that touches the database, the bucket or their volume.

A push creates one deployment per service, held by Railway (Wait for CI) until the
commit's checks finish. The Deploy infrastructure workflow plans `railway.ts`, runs the
guard and applies. Then the deployments build; the api pre-deploy step runs pending
migrations in one transaction under a Postgres advisory lock, and traffic moves only
after `/health` passes. A failed migration, build or health check leaves the
previous deployment serving.

### First-time setup

Dashboard edits are staged: nothing is live until you click **Deploy Changes**.

1. GitHub Environments: `production` limited to `main`, and `production-plan`
   unrestricted (pull request plans run on `refs/pull/*`).
2. On GitHub (Settings > Applications > Railway > Configure), accept any pending
   permission request for the Railway app and give it this repository. Without it
   the source panel says "Auto deploy unavailable" and Wait for CI switches itself
   off.
3. Usage limits: see "Usage limits".
4. Railway project "Closeout" (New > Empty Project), its environment named
   `production`.
5. Shared variable: `INTERNAL_API_SECRET` from `openssl rand -hex 32`, sealed.
6. A project token scoped to `production` (Settings > Tokens), stored as
   `RAILWAY_TOKEN` in both the `production` and `production-plan` GitHub
   Environments (`gh secret set RAILWAY_TOKEN --env <env>`, value on stdin).
7. First apply: run the Deploy infrastructure workflow manually on `main` with
   **first-time-setup** checked; the guard then also allows creating the database
   and the bucket. If the bucket shows on the canvas for a moment and then
   disappears, the project has had a bucket of that name before (even a deleted
   one): rename it in `railway.ts` and run first-time setup again.
8. Generate the web domain at once (web > Settings > Networking, port 3000).
   `PUBLIC_BASE_URL` references it; without it the api fails at boot with `Invalid
   URL` and web `/health` returns 503.
9. On `api` and `web` (Settings > Source), check that auto deploy and Wait for CI
   are on. The push that brought `railway.ts` to `main` failed the guard, so its
   deploys were skipped: on each service, open the newest skipped deployment and
   choose **Deploy commit** (redeploy would rebuild an older commit).
10. Check: a plan reports no changes, `/health` and `/api/v1/health` answer 200.
    Create the first store and its owner with `admin:create`.

### Tracing

The `api` service has Railway tracing enabled in `railway.ts`, and it sets no
`OTEL_*` variable of its own: on the next deploy Railway injects the OTLP endpoint
and auth header. Tracing is a Railway preview feature and must be turned on for the
account first (the `TRACING` beta feature) by an operator, before the first plan
that includes it; the apply does not do it. Traces show on the service's Traces
page. Railway accepts 1,000 spans per 10 seconds per replica and rejects the rest.
The Railway auto-instrumentation stays off, because it would bypass the attribute
allow-list.

### Operator CLI

Run it inside the api service, from the dashboard (api > Console) or with
`railway ssh --service api -- node dist/cli/main.js admin:create --store <slug>
--store-name <name> --email <email> --name <name>`. `admin:password --email <email>` rotates a password and signs the
user out everywhere. Type passwords at the prompt only, never on the command line
or in `CLOSEOUT_PASSWORD`. Never run `seed:demo` in production.

### Changing infrastructure

Edit `.railway/railway.ts` in a pull request; the plan shows in the run summary and
merging applies it. The guard fails the run on any change to the database, the
bucket or the volume, and on anything it does not recognise. Everything else
applies with `--confirm-destructive`, so removing a variable or a service from the
file deletes it in Railway on merge: read the plan before merging.

- Never cancel a Deploy infrastructure run. A cancelled or failed run skips that
  commit's deploys for good; re-running does not revive them and `railway redeploy`
  redeploys the last active commit. Push a new commit instead. The same applies to a
  failed Warm main caches run on `main` and to deploys whose checks are still
  unfinished after 2 hours.
- A force-push may not trigger the workflow: run a plan afterwards.
- `railway variable set/delete` takes effect on the next deploy only.

### Rollback

Dashboard: service > Deployments > a removed deployment > menu > Rollback. It
restores that image and its variables without a build (seconds), within the plan's
retention window. It does not revert migrations: keep migrations backward compatible
(add first, drop in a later release), or roll forward.

### Secret rotation

Edit the shared `INTERNAL_API_SECRET` (stays sealed) and Deploy Changes; web and api
redeploy together. Admin sessions survive.

### Usage limits

Workspace > Usage > Set limits: email alert at $10, hard limit at $100. Both cover
every project in the workspace. At the hard limit every workload goes offline;
raise the limit, then redeploy anything Railway does not restart.

## Towards multiple storefronts

One deployment already serves every store at `/store/<slug>`, every tenant-owned row
carries `store_id`, admin routes are scoped to `/stores/:storeId/*` behind a
membership guard with per-route roles, and people join a store by invite. What is
still missing:

1. Multi-store membership (issue #12): a user belongs to one store, and the admin
   picks the store from that single membership. Belonging to several needs a store
   switcher (the `/me` response already lists memberships).
2. Self-service store creation in place of the `admin:create` CLI.
3. Move the login and invite rate limiters from memory to Postgres or Redis before
   running more than one API instance.
