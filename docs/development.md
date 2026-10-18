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

## Production on Railway

The `prod` targets of `apps/api/Dockerfile` and `apps/web/Dockerfile` build
standalone images. Production runs them on Railway, with the infrastructure
declared in `.railway/railway.ts`. Any other host needs the same pieces:
Postgres, an S3-compatible bucket for media, `NODE_ENV=production` (Secure
cookies, HSTS), `PUBLIC_BASE_URL` set to the HTTPS origin, an
`INTERNAL_API_SECRET` of at least 32 random characters, only the web app exposed,
and migrations applied before the API starts (`node dist/database/migrate.js` in
the API image). Production sets no `MEDIA_DIR`; the API stores media in the bucket
(see `docs/architecture/decisions/`).

Put a reverse proxy (nginx, Caddy, a platform load balancer) in front of the web app
and have it set `X-Real-IP` to the real client address, overwriting any value the
client sent (`proxy_set_header X-Real-IP $remote_addr;` in nginx; Railway's edge does
this already). The login rate limiter keys on that header: 10 failures per email and
IP, 30 per email and 30 per IP in 15 minutes. Without a proxy a client can forge it
and only the per-email limit protects an account. If every request arrives with the
same address (a proxy that does not set the header), the per-IP limit becomes
shared: 30 failed logins from anyone block all logins for 15 minutes.

The web app caches the store, listing pages and the first page of the unfiltered
catalog for up to 5 minutes; searches, filters and later pages always read live
data. Saves in the admin expire that cache at once. Changes made elsewhere (the
operator CLI, SQL) show on the storefront within 5 minutes. The cache lives in each
web instance, so running several instances needs a shared Next.js cache handler.

### Overview

One Railway project, "Closeout", with two environments:

- `production` deploys the `main` branch.
- `verification` deploys the `verification` branch. It exists to probe changes
  against real Railway before the first release and is deleted after launch
  (see "Tearing down verification").

Each environment has four resources: `web` (public, port 3000), `api` (private,
reachable only over Railway's private network), Postgres 18 and a private bucket
for media. Region is `us-east4-eqdc4a` for services and Postgres, `iad` for the
bucket (a bucket's region cannot change). There are no backups: the data-store
guard exists so that no plan can touch the database or the bucket.

A release:

1. A push to `main` (or `verification`) creates one deployment per service.
   Railway holds them (Wait for CI) until every check suite on the commit has
   finished.
2. The Infrastructure workflow plans `.railway/railway.ts` against the
   environment, runs the data-store guard on the plan and applies it. Pull requests
   only plan; the plan is in the run summary.
3. When the checks pass, the held deployments build. The api pre-deploy command
   (`node dist/database/migrate.js`) applies pending migrations in one
   transaction under a Postgres advisory lock. A failing migration fails the api
   deployment and the previous one keeps serving.
4. Each new deployment must answer its health check (`/health`, 120 s) before
   traffic moves. The old deployment overlaps for 30 s and drains for 15 s.

Because the infrastructure apply lands before any deploy of the same commit,
a commit can change both `railway.ts` and the code that needs it.

### First-time setup

Run these on an empty Railway project, `verification` first and `production` after
it. Replace `<env>` with the environment name and `<branch>` with its branch. Edits
made in the Railway dashboard are staged: nothing is live until you click
**Deploy Changes**.

1. GitHub Environments (Settings > Environments, or `gh api`):
   - `production`, deployment branches limited to `main`.
   - `verification`, limited to `verification`.
   - `production-plan` and `verification-plan`, no branch restriction (pull request
     plan runs use `refs/pull/*`).
2. Railway GitHub App: on GitHub (Settings > Applications > Installed GitHub Apps >
   Railway > Configure), accept any pending permission request and include this
   repository in its access. Without that the service source panel shows "Auto
   deploy unavailable" and Wait for CI switches itself off.
3. Usage limits (Workspace > Usage > Set limits): see "Usage limits".
4. Create the project (New > Empty Project) and name it "Closeout". Its default
   environment is called `production`; rename it to the environment you are setting
   up (Settings > Environments). For the production round, create a new environment
   named `production` instead.
5. Shared variables (Settings > Shared Variables, scoped to the environment):
   - `STORE_SLUG`, the store's slug.
   - `INTERNAL_API_SECRET`, from `openssl rand -hex 32`. Seal it (irreversible; the
     value is never shown again).
6. Project token (Settings > Tokens), scoped to the environment. Store it as the
   secret `RAILWAY_TOKEN` in both `<env>` and `<env>-plan` GitHub Environments
   (`gh secret set RAILWAY_TOKEN --env <env>`, value on stdin).
7. Push `<branch>` to GitHub. The first Infrastructure run fails if the token is
   not stored yet; that is harmless.
8. First apply, locally, because `workflow_dispatch` only exists once the workflow
   is on the default branch. Use the pinned CLI (the version in
   `.github/workflows/infrastructure.yml`) and `--setup` on the guard, which alone
   may let a plan create the database and the bucket:

   ```bash
   export RAILWAY_TOKEN=...   # the environment token from step 6
   npx -y @railway/cli@5.70.0 config plan --out plan.json
   node scripts/railway-plan-guard.ts plan.json --cli-version 5.70.0 --setup
   npx -y @railway/cli@5.70.0 config apply --plan plan.json --yes
   ```

   The plan creates `api`, `web`, Postgres and the bucket. Railway creates the
   Postgres volume itself; it is not a plan entry.
9. Generate the web domain at once (web > Settings > Networking > Generate Domain,
   port 3000). `PUBLIC_BASE_URL` references it; without it the variable resolves to
   `https://`, the api crashes at boot with `Invalid URL`, web `/health` returns 503
   and both deployments stay Failed. If that happens, generate the domain, then
   `railway redeploy --service api --yes` and the same for `web`.
10. Click **Deploy Changes** for the staged shared variables and sealing, so the
    services boot with them.
11. On both `api` and `web` (Settings > Source), enable auto deploy and turn on
    Wait for CI. Apply does not set either; Wait for CI is what makes deploys wait
    for the Infrastructure run. Click Deploy Changes, then redeploy both services.
12. Verify: `config plan --out plan.json` must report no changes, and
    `https://<web domain>/health` and `/api/v1/health` must answer 200. Create the
    first admin (next section).
13. Protect `<branch>` on GitHub with the same rules as `main`
    ("Required check on `main`" above).

### Operator CLI

The CLI (`admin:create`, `admin:password`) runs inside the api service, where it
reaches the production database. Two ways:

- Dashboard: api service > Console.
- Terminal: `railway ssh --service api -- node dist/cli/main.js admin:create --email <email> --name <name>`.

`admin:password --email <email>` rotates a password and signs the user out
everywhere. Passwords are typed at the prompt only. Never put one on the command
line or in `CLOSEOUT_PASSWORD` here; both can leak into shell history or logs.
`seed:demo` is never run in production.

To check the database version without a client:

```bash
railway ssh --service api -- node -e "const {AppDataSource}=require('./dist/database/connection.js');AppDataSource.initialize().then(d=>d.query('select version()')).then(r=>{console.log(r);process.exit(0)})"
```

Postgres > Data in the dashboard runs the same query.

### Changing infrastructure

Edit `.railway/railway.ts` in a pull request. The Infrastructure workflow plans
against the target branch's environment and shows the plan in the run summary;
merging applies it. The guard fails the run, and applies nothing, if a plan would
delete, replace or reconfigure the database, the bucket or the volume, or if it
contains anything it does not recognise. The workflow never passes
`--confirm-destructive`, so it cannot delete anything either.

- Removing a variable: delete it in Railway (or run a local apply with
  `--confirm-destructive` after reading the plan), then remove it from the file. A
  push that only removes it from the file fails the apply, and that commit's
  deploys are skipped.
- Never cancel an Infrastructure run. A cancelled or failed run skips that commit's
  deploys for good; re-running it does not revive them, and `railway redeploy`
  deploys the last active commit, not the skipped one. Recover by pushing a new
  commit.
- A force-push to `main` or `verification` may not trigger the workflow, which
  leaves drift. Run `config plan` afterwards and apply if it shows changes.
- A failed Warm caches run on `main` also fails the check suite and skips the
  deploy. Re-run it rather than leaving it.
- Railway skips deployments whose checks have not finished after 2 hours. Redeploy
  from the dashboard.
- `railway variable set` and `railway variable delete` change nothing running: they
  take effect on the next deploy. Follow them with `railway redeploy`. Prefer the
  file, so the change is reviewed.

### Rollback

Dashboard: service > Deployments > a previous deployment > menu > Rollback. It
restores that deployment's image and variables without rebuilding (about 16 s
observed). The CLI has no rollback. Only deployments Railway has already removed
from service offer it, and only within the plan's retention window (72 hours on
Hobby).

Rollback does not revert migrations. After a release that migrated the schema,
roll back only if the previous code works with the new schema; otherwise roll
forward with a fix. Keep migrations backward compatible so rollback stays safe: add
before you remove, and drop in a later release.

### Secret rotation

Edit the shared variable `INTERNAL_API_SECRET` (Settings > Shared Variables, with
a new `openssl rand -hex 32`). It stays sealed. Click Deploy Changes; `web` and
`api` redeploy together. Existing admin sessions kept working in the rotation
probe.

### Usage limits

Set in Workspace > Usage > Set limits: an email alert at $10 and a hard limit at
$100. Both are workspace-wide and cover every project in the workspace, not just
this one. At the hard limit Railway takes all workloads offline, including the
store. To recover, raise the limit; Railway then tries to redeploy, and if the
services stay down, redeploy them manually.

### Tearing down verification

After launch, remove the probe environment: delete the `verification` environment
in Railway (Settings > Environments), revoke its project token, delete the GitHub
Environments `verification` and `verification-plan`, then delete the `verification`
branch. Deleting the environment deletes its database and bucket.

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
