import {
  bucket,
  database,
  defineRailway,
  github,
  ref,
  service,
} from "railway/iac";

const REPO = "emiliosheinz/closeout";
const API_PORT = "8080";
const WEB_PORT = "3000";

/** Deploy region for every service; the bucket's matching region is `iad`. */
const REGION = "us-east4-eqdc4a";

/** Both services cut over only after `/health` answers 200 within this window. */
const HEALTHCHECK_TIMEOUT_SECONDS = 120;

/**
 * The old deployment keeps serving for a while after the new one is healthy,
 * then gets SIGTERM and time to finish in-flight requests.
 */
const OVERLAP_SECONDS = 30;
const DRAINING_SECONDS = 15;

/**
 * Each Railway environment follows its own branch: `main` releases to
 * production, `verification` is the disposable environment where failure
 * probes run before production exists.
 *
 * Secrets never appear here. The internal secret and the store slug are shared
 * variables set once in the dashboard; database and bucket credentials are
 * references Railway resolves itself.
 */
export default defineRailway((ctx, project) => {
  const branch = ctx.isEnvironment("production") ? "main" : "verification";
  const source = github(REPO, { branch, checkSuites: true });

  // Railway creates the database from its own template whatever image is
  // declared here, so this states that template exactly; any other value is
  // a permanent diff the data-store guard rejects. Compose and CI run the
  // same major.
  const postgres = database("postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:18",
    output: "DATABASE_URL",
    defaultMountPath: "/var/lib/postgresql/data",
    region: REGION,
  });

  const media = bucket("media", { region: "iad" });

  const deploy = {
    healthcheckPath: "/health",
    healthcheckTimeout: HEALTHCHECK_TIMEOUT_SECONDS,
    overlapSeconds: OVERLAP_SECONDS,
    drainingSeconds: DRAINING_SECONDS,
  };

  const commonEnv = {
    PUBLIC_BASE_URL: `https://\${{web.RAILWAY_PUBLIC_DOMAIN}}`,
    INTERNAL_API_SECRET: ctx.shared.INTERNAL_API_SECRET,
    STORE_SLUG: ctx.shared.STORE_SLUG,
    NODE_ENV: "production",
  };

  // Railway stores the region per replica set, not as a deploy field.
  const replicas = { [REGION]: 1 };

  const api = service("api", {
    source,
    replicas,
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    deploy: {
      ...deploy,
      preDeployCommand: ["node dist/database/migrate.js"],
      preDeployTimeoutSeconds: 600,
    },
    env: {
      ...commonEnv,
      PORT: API_PORT,
      HOST: "::",
      STORE_NAME: "Nosso Desapego",
      POSTGRES_HOST: postgres.env.PGHOST,
      POSTGRES_PORT: postgres.env.PGPORT,
      POSTGRES_DB: postgres.env.PGDATABASE,
      POSTGRES_USER: postgres.env.PGUSER,
      POSTGRES_PASSWORD: postgres.env.PGPASSWORD,
      // The private network is already encrypted end to end.
      POSTGRES_SSL: "false",
      S3_ENDPOINT: ref(media, "ENDPOINT"),
      S3_REGION: ref(media, "REGION"),
      S3_BUCKET: ref(media, "BUCKET"),
      S3_ACCESS_KEY_ID: ref(media, "ACCESS_KEY_ID"),
      S3_SECRET_ACCESS_KEY: ref(media, "SECRET_ACCESS_KEY"),
    },
  });

  const web = service("web", {
    source,
    replicas,
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
    deploy,
    env: {
      ...commonEnv,
      PORT: WEB_PORT,
      HOSTNAME: "::",
      NEXT_TELEMETRY_DISABLED: "1",
      API_BASE_URL: `http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:${API_PORT}`,
    },
  });

  return project("closeout", { resources: [postgres, media, api, web] });
});
