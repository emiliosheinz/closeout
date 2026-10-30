import { once } from "node:events";
import { createServer, type Server } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import {
  accepts,
  type BuiltProcess,
  type BuiltServer,
  freePort,
  runBuilt,
  runInApi,
  startBuiltServer,
} from "./child-process";
import { type OtlpStub, startOtlpStub } from "./otlp-stub";

type Entry = "server" | "cli" | "migrate" | "TypeORM CLI";
type Env = Record<string, string | undefined>;

const ALL: Entry[] = ["server", "cli", "migrate", "TypeORM CLI"];
const MEDIA: Entry[] = ["server", "cli"];
const BUCKET = {
  S3_ENDPOINT: "https://storage.example",
  S3_REGION: "iad",
  S3_BUCKET: "media",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "bucket-secret",
};

/** [case, env changes, variables stderr must name, entries that check it] */
const CASES: [string, Env, string[], Entry[]][] = [
  ["PORT not an integer", { PORT: "x" }, ["PORT"], ["server"]],
  ["PORT 0", { PORT: "0" }, ["PORT"], ["server"]],
  ["PORT 65536", { PORT: "65536" }, ["PORT"], ["server"]],
  ["HOST empty", { HOST: "" }, ["HOST"], ["server"]],
  [
    "PUBLIC_BASE_URL relative",
    { PUBLIC_BASE_URL: "/store" },
    ["PUBLIC_BASE_URL"],
    MEDIA,
  ],
  [
    "PUBLIC_BASE_URL not http(s)",
    { PUBLIC_BASE_URL: "ftp://storefront.test" },
    ["PUBLIC_BASE_URL"],
    MEDIA,
  ],
  [
    "INTERNAL_API_SECRET of 31 characters",
    { INTERNAL_API_SECRET: "s".repeat(31) },
    ["INTERNAL_API_SECRET"],
    ["server"],
  ],
  ["POSTGRES_HOST empty", { POSTGRES_HOST: "" }, ["POSTGRES_HOST"], ALL],
  ["POSTGRES_DB empty", { POSTGRES_DB: "" }, ["POSTGRES_DB"], ALL],
  ["POSTGRES_USER empty", { POSTGRES_USER: "" }, ["POSTGRES_USER"], ALL],
  [
    "POSTGRES_PASSWORD empty",
    { POSTGRES_PASSWORD: "" },
    ["POSTGRES_PASSWORD"],
    ALL,
  ],
  ["POSTGRES_PORT invalid", { POSTGRES_PORT: "x" }, ["POSTGRES_PORT"], ALL],
  ["POSTGRES_SSL yes", { POSTGRES_SSL: "yes" }, ["POSTGRES_SSL"], ALL],
  [
    "1 of 5 S3_* set",
    { S3_BUCKET: "media" },
    ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    MEDIA,
  ],
  [
    "2 of 5 S3_* set",
    { S3_ENDPOINT: "https://storage.example", S3_REGION: "iad" },
    ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    MEDIA,
  ],
  [
    "3 of 5 S3_* set",
    { ...BUCKET, S3_ACCESS_KEY_ID: undefined, S3_SECRET_ACCESS_KEY: undefined },
    ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    MEDIA,
  ],
  [
    "4 of 5 S3_* set",
    { ...BUCKET, S3_SECRET_ACCESS_KEY: undefined },
    ["S3_SECRET_ACCESS_KEY"],
    MEDIA,
  ],
  ["MEDIA_DIR empty with no S3_*", { MEDIA_DIR: "" }, ["MEDIA_DIR"], MEDIA],
  [
    "LOG_LEVEL outside the set",
    { LOG_LEVEL: "verbose" },
    ["LOG_LEVEL"],
    ["server", "migrate"],
  ],
  [
    "OTEL_EXPORTER_OTLP_ENDPOINT without a scheme",
    { OTEL_EXPORTER_OTLP_ENDPOINT: "collector:4318" },
    ["OTEL_EXPORTER_OTLP_ENDPOINT"],
    ["server"],
  ],
  [
    "OTEL_EXPORTER_OTLP_ENDPOINT not http(s)",
    { OTEL_EXPORTER_OTLP_ENDPOINT: "grpc://collector:4317" },
    ["OTEL_EXPORTER_OTLP_ENDPOINT"],
    ["server"],
  ],
];

const SEVERAL: Record<Entry, Env> = {
  server: {
    PORT: "x",
    HOST: "",
    INTERNAL_API_SECRET: "short",
    POSTGRES_DB: "",
    LOG_LEVEL: "verbose",
    OTEL_EXPORTER_OTLP_ENDPOINT: "collector",
  },
  cli: {
    PUBLIC_BASE_URL: "/store",
    POSTGRES_USER: "",
    POSTGRES_SSL: "yes",
    MEDIA_DIR: "",
  },
  migrate: { POSTGRES_HOST: "", POSTGRES_PORT: "x", LOG_LEVEL: "verbose" },
  "TypeORM CLI": {
    POSTGRES_PASSWORD: "",
    POSTGRES_SSL: "yes",
    POSTGRES_DB: "",
  },
};

const SENTINEL = "zq9sentinel";
/** Every variable in the table carries the sentinel; the port makes boot fail. */
const SENTINEL_ENV: Env = {
  PORT: `${SENTINEL}-port`,
  HOST: `${SENTINEL}-host`,
  PUBLIC_BASE_URL: `${SENTINEL}-url`,
  INTERNAL_API_SECRET: `${SENTINEL}-secret`,
  POSTGRES_HOST: `${SENTINEL}-pg-host`,
  POSTGRES_PORT: `${SENTINEL}-pg-port`,
  POSTGRES_DB: `${SENTINEL}-pg-db`,
  POSTGRES_USER: `${SENTINEL}-pg-user`,
  POSTGRES_PASSWORD: `${SENTINEL}-pg-password`,
  POSTGRES_SSL: `${SENTINEL}-pg-ssl`,
  S3_ENDPOINT: `${SENTINEL}-s3-endpoint`,
  S3_REGION: `${SENTINEL}-s3-region`,
  S3_BUCKET: `${SENTINEL}-s3-bucket`,
  S3_ACCESS_KEY_ID: `${SENTINEL}-s3-key`,
  S3_SECRET_ACCESS_KEY: `${SENTINEL}-s3-secret`,
  MEDIA_DIR: `${SENTINEL}-media`,
  CLOSEOUT_PASSWORD: `${SENTINEL}-password`,
  LOG_LEVEL: `${SENTINEL}-level`,
  OTEL_EXPORTER_OTLP_ENDPOINT: `${SENTINEL}-otlp`,
};

/** Stands in for Postgres and counts every connection it accepts. */
let database: Server;
let databasePort: number;
let connections = 0;

beforeAll(async () => {
  database = createServer((socket) => {
    connections += 1;
    socket.destroy();
  }).listen(0, "127.0.0.1");
  await once(database, "listening");
  const address = database.address();
  if (!address || typeof address === "string") throw new Error("No address");
  databasePort = address.port;
});

afterAll(async () => {
  database.close();
  await once(database, "close");
});

interface Outcome {
  code: number | null;
  stdout: string;
  stderr: string;
  /** Whether the server's port accepted connections at any point before the exit. */
  listening: boolean;
  /** Connections the stand-in database accepted during the run. */
  connections: number;
}

async function launch(entry: Entry, changes: Env): Promise<Outcome> {
  const port = await freePort();
  const env: Env = {
    POSTGRES_HOST: "127.0.0.1",
    POSTGRES_PORT: String(databasePort),
    PORT: String(port),
    HOST: "127.0.0.1",
    ...changes,
  };
  const before = connections;
  const run = start(entry, env);
  const timer = setTimeout(() => run.child.kill("SIGKILL"), 30_000);
  let exited = false;
  void run.exit.then(() => {
    exited = true;
  });
  let listening = false;
  while (!exited) {
    if (await accepts(port)) listening = true;
    await sleep(25);
  }
  const { code } = await run.exit;
  clearTimeout(timer);
  // Let a connection made just before the exit reach the listener.
  await sleep(100);
  return {
    code,
    stdout: run.stdout(),
    stderr: run.stderr(),
    listening,
    connections: connections - before,
  };
}

function start(entry: Entry, env: Env): BuiltProcess {
  switch (entry) {
    case "server":
      return runBuilt("main.js", env);
    case "cli":
      return runBuilt("cli/main.js", env, [
        "admin:password",
        "--email",
        "operator@example.com",
      ]);
    case "migrate":
      return runBuilt("database/migrate.js", env);
    case "TypeORM CLI":
      return runInApi("pnpm", ["--silent", "run", "migration:show"], env);
  }
}

function names(stderr: string, variable: string): boolean {
  return new RegExp(`^\\s*${variable} `, "m").test(stderr);
}

describe("configuration at every entry point", () => {
  const cases = CASES.flatMap(([rule, changes, named, entries]) =>
    entries.map((entry) => [entry, rule, changes, named] as const),
  );

  it.each(
    cases,
  )("%s exits on %s before binding or connecting", async (entry, _rule, changes, named) => {
    const outcome = await launch(entry, changes);
    expect(outcome.code).not.toBe(0);
    expect(outcome.code).not.toBeNull();
    for (const variable of named) {
      expect(names(outcome.stderr, variable)).toBe(true);
    }
    expect(outcome.stdout).not.toContain("API listening");
    expect(outcome.listening).toBe(false);
    expect(outcome.connections).toBe(0);
  });

  it.each(ALL)("%s names every invalid variable at once", async (entry) => {
    const changes = SEVERAL[entry];
    const outcome = await launch(entry, changes);
    expect(outcome.code).not.toBe(0);
    for (const variable of Object.keys(changes)) {
      expect(names(outcome.stderr, variable)).toBe(true);
    }
    expect(outcome.connections).toBe(0);
  });

  it.each(
    ALL,
  )("%s prints no value when boot fails on config", async (entry) => {
    const outcome = await launch(entry, SENTINEL_ENV);
    expect(outcome.code).not.toBe(0);
    expect(names(outcome.stderr, "POSTGRES_PORT")).toBe(true);
    expect(outcome.stdout).not.toContain(SENTINEL);
    expect(outcome.stderr).not.toContain(SENTINEL);
  });

  it("reaches the database once the configuration is valid", async () => {
    const outcome = await launch("migrate", {});
    expect(outcome.code).not.toBe(0);
    expect(outcome.connections).toBeGreaterThan(0);
  });
});

describe("tracing endpoint", () => {
  let server: BuiltServer | undefined;
  let receiver: OtlpStub | undefined;
  afterEach(async () => {
    if (server && server.child.exitCode === null) server.child.kill("SIGKILL");
    server = undefined;
    await receiver?.close();
    receiver = undefined;
  });

  /** Serves one request that queries the database, then stops the server. */
  async function serveOneRequest(env: Env): Promise<BuiltServer> {
    server = await startBuiltServer(env);
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
    server.child.kill("SIGTERM");
    expect(await server.exit).toEqual({ code: 0, signal: null });
    return server;
  }

  it("exports nothing, not even to the default receiver, when unset", async () => {
    receiver = await startOtlpStub(4318);
    const run = await serveOneRequest({ OTEL_EXPORTER_OTLP_ENDPOINT: "" });

    expect(receiver.requests).toEqual([]);
    expect(`${run.stdout()}${run.stderr()}`).not.toMatch(/otlp|export/i);
  });

  it("exports traces to the configured receiver", async () => {
    receiver = await startOtlpStub(4318);
    await serveOneRequest({ OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url });

    expect(receiver.requests.map((request) => request.path)).toContain(
      "/v1/traces",
    );
  });
});
