import {
  bucket,
  database,
  defineRailway,
  github,
  ref,
  service,
} from "railway/iac";

const API_PORT = "8080";
const REGION = "us-east4-eqdc4a";

/**
 * `main` deploys to production. Secrets stay in Railway: shared variables and
 * references only.
 */
export default defineRailway((ctx, project) => {
  const source = github("emiliosheinz/closeout", {
    branch: "main",
    checkSuites: true,
  });

  // Railway creates the database from this template whatever is declared, so
  // any other image is a permanent diff that the data-store guard rejects.
  const postgres = database("postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:18",
    output: "DATABASE_URL",
    defaultMountPath: "/var/lib/postgresql/data",
    region: REGION,
  });

  const media = bucket("media-storage", { region: "iad" });

  // Zero downtime: traffic moves after /health passes, then the old
  // deployment overlaps and drains.
  const deploy = {
    healthcheckPath: "/health",
    healthcheckTimeout: 120,
    overlapSeconds: 30,
    drainingSeconds: 15,
  };

  const commonEnv = {
    PUBLIC_BASE_URL: `https://\${{web.RAILWAY_PUBLIC_DOMAIN}}`,
    INTERNAL_API_SECRET: ctx.shared.INTERNAL_API_SECRET,
    NODE_ENV: "production",
  };

  // Railway stores the region per replica set, not as a deploy field.
  const replicas = { [REGION]: 1 };

  const api = service("api", {
    source,
    replicas,
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    // Railway injects the OpenTelemetry endpoint and auth header on the next
    // deploy, so the service sets none of its own.
    tracing: { enabled: true },
    deploy: {
      ...deploy,
      preDeployCommand: ["node dist/database/migrate.js"],
      preDeployTimeoutSeconds: 600,
    },
    env: {
      ...commonEnv,
      PORT: API_PORT,
      HOST: "::",
      POSTGRES_HOST: postgres.env.PGHOST,
      POSTGRES_PORT: postgres.env.PGPORT,
      POSTGRES_DB: postgres.env.PGDATABASE,
      POSTGRES_USER: postgres.env.PGUSER,
      POSTGRES_PASSWORD: postgres.env.PGPASSWORD,
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
      PORT: "3000",
      HOSTNAME: "::",
      NEXT_TELEMETRY_DISABLED: "1",
      API_BASE_URL: `http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:${API_PORT}`,
    },
  });

  return project("closeout", { resources: [postgres, media, api, web] });
});
