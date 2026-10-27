import { cliScope, databaseScope, migrateScope, serverScope } from "./config";
import { parseEnv, type Scope } from "./report";

const DATABASE = {
  POSTGRES_HOST: "db.internal",
  POSTGRES_PORT: "6543",
  POSTGRES_DB: "store",
  POSTGRES_USER: "owner",
  POSTGRES_PASSWORD: "hunter2",
};
const BUCKET = {
  S3_ENDPOINT: "https://storage.example",
  S3_REGION: "iad",
  S3_BUCKET: "media",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "bucket-secret",
};
const SERVER_ENV = {
  ...DATABASE,
  PORT: "3000",
  HOST: "0.0.0.0",
  PUBLIC_BASE_URL: "https://loja.example",
  INTERNAL_API_SECRET: "s".repeat(32),
  MEDIA_DIR: "/data/media",
};
const CLI_ENV = {
  ...DATABASE,
  PUBLIC_BASE_URL: "https://loja.example",
  MEDIA_DIR: "/data/media",
};

type Env = Record<string, string | undefined>;

const SCOPES = {
  server: { scope: serverScope, valid: SERVER_ENV },
  cli: { scope: cliScope, valid: CLI_ENV },
  migrate: { scope: migrateScope, valid: DATABASE },
  "TypeORM CLI": { scope: databaseScope, valid: DATABASE },
} satisfies Record<string, { scope: Scope; valid: Env }>;
type ScopeName = keyof typeof SCOPES;
const ALL = Object.keys(SCOPES) as ScopeName[];

function problems(scope: Scope, env: Env): string[] {
  const parsed = parseEnv(scope, env);
  return parsed.ok ? [] : parsed.problems;
}

function config(scope: Scope, env: Env): Record<string, unknown> {
  const parsed = parseEnv(scope, env);
  if (!parsed.ok) throw new Error(parsed.problems.join("\n"));
  return parsed.config;
}

/** [case, env changes, variables that must be named, scopes that check it] */
const RULES: [string, Env, string[], ScopeName[]][] = [
  ["PORT not an integer", { PORT: "x" }, ["PORT"], ["server"]],
  ["PORT 0", { PORT: "0" }, ["PORT"], ["server"]],
  ["PORT 65536", { PORT: "65536" }, ["PORT"], ["server"]],
  ["PORT unset", { PORT: undefined }, ["PORT"], ["server"]],
  ["HOST empty", { HOST: "" }, ["HOST"], ["server"]],
  [
    "PUBLIC_BASE_URL relative",
    { PUBLIC_BASE_URL: "/store" },
    ["PUBLIC_BASE_URL"],
    ["server", "cli"],
  ],
  [
    "PUBLIC_BASE_URL not http(s)",
    { PUBLIC_BASE_URL: "ftp://loja.example" },
    ["PUBLIC_BASE_URL"],
    ["server", "cli"],
  ],
  [
    "PUBLIC_BASE_URL without a host",
    { PUBLIC_BASE_URL: "https://" },
    ["PUBLIC_BASE_URL"],
    ["server", "cli"],
  ],
  [
    "INTERNAL_API_SECRET of 31 characters",
    { INTERNAL_API_SECRET: "s".repeat(31) },
    ["INTERNAL_API_SECRET"],
    ["server"],
  ],
  [
    "INTERNAL_API_SECRET unset",
    { INTERNAL_API_SECRET: undefined },
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
  [
    "POSTGRES_PASSWORD unset",
    { POSTGRES_PASSWORD: undefined },
    ["POSTGRES_PASSWORD"],
    ALL,
  ],
  [
    "POSTGRES_PORT not an integer",
    { POSTGRES_PORT: "x" },
    ["POSTGRES_PORT"],
    ALL,
  ],
  ["POSTGRES_PORT 0", { POSTGRES_PORT: "0" }, ["POSTGRES_PORT"], ALL],
  ["POSTGRES_PORT 65536", { POSTGRES_PORT: "65536" }, ["POSTGRES_PORT"], ALL],
  ["POSTGRES_SSL yes", { POSTGRES_SSL: "yes" }, ["POSTGRES_SSL"], ALL],
  [
    "1 of 5 S3_* set",
    { S3_BUCKET: "media" },
    ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    ["server", "cli"],
  ],
  [
    "2 of 5 S3_* set",
    { S3_ENDPOINT: "https://storage.example", S3_REGION: "iad" },
    ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    ["server", "cli"],
  ],
  [
    "3 of 5 S3_* set",
    { ...BUCKET, S3_ACCESS_KEY_ID: undefined, S3_SECRET_ACCESS_KEY: undefined },
    ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    ["server", "cli"],
  ],
  [
    "4 of 5 S3_* set",
    { ...BUCKET, S3_SECRET_ACCESS_KEY: "" },
    ["S3_SECRET_ACCESS_KEY"],
    ["server", "cli"],
  ],
  [
    "MEDIA_DIR empty with no S3_*",
    { MEDIA_DIR: "" },
    ["MEDIA_DIR"],
    ["server", "cli"],
  ],
  [
    "LOG_LEVEL outside the set",
    { LOG_LEVEL: "verbose" },
    ["LOG_LEVEL"],
    ["server", "migrate"],
  ],
];

describe("environment rules", () => {
  const cases = RULES.flatMap(([rule, changes, named, scopes]) =>
    ALL.map(
      (scope) => [scope, rule, changes, named, scopes.includes(scope)] as const,
    ),
  );

  it.each(cases)("%s scope, %s", (scope, _rule, changes, named, checked) => {
    const { scope: schema, valid } = SCOPES[scope];
    const found = problems(schema, { ...valid, ...changes });
    if (!checked) {
      expect(found).toEqual([]);
      return;
    }
    expect(found.map((line) => line.split(" ")[0]).sort()).toEqual(
      [...named].sort(),
    );
  });

  it.each(ALL)("%s scope accepts its valid environment", (scope) => {
    const { scope: schema, valid } = SCOPES[scope];
    expect(problems(schema, valid)).toEqual([]);
  });

  it("accepts an internal secret of exactly 32 characters", () => {
    expect(
      problems(serverScope, {
        ...SERVER_ENV,
        INTERNAL_API_SECRET: "s".repeat(32),
      }),
    ).toEqual([]);
  });

  it("accepts the edge ports 1 and 65535", () => {
    expect(
      problems(serverScope, {
        ...SERVER_ENV,
        PORT: "1",
        POSTGRES_PORT: "65535",
      }),
    ).toEqual([]);
  });
});

describe("problem report", () => {
  const SENTINELS = {
    PORT: "sentinel-port",
    PUBLIC_BASE_URL: "sentinel-url",
    INTERNAL_API_SECRET: "sentinel-short-secret",
    POSTGRES_SSL: "sentinel-ssl",
    LOG_LEVEL: "sentinel-level",
    S3_BUCKET: "sentinel-bucket",
  };

  it("names every offending variable once, with its rule, and no value", () => {
    const report = problems(serverScope, {
      ...SERVER_ENV,
      ...SENTINELS,
      HOST: "",
    });
    expect(report).toEqual([
      "PORT must be an integer from 1 to 65535",
      "HOST must be set",
      "PUBLIC_BASE_URL must be an absolute http(s) URL with a host",
      "INTERNAL_API_SECRET must be at least 32 characters",
      "POSTGRES_SSL must be true or false when set",
      "S3_ENDPOINT must be set: the S3_* variables are set all together or not at all",
      "S3_REGION must be set: the S3_* variables are set all together or not at all",
      "S3_ACCESS_KEY_ID must be set: the S3_* variables are set all together or not at all",
      "S3_SECRET_ACCESS_KEY must be set: the S3_* variables are set all together or not at all",
      "LOG_LEVEL must be one of fatal, error, warn, info, debug, trace when set",
    ]);
    expect(report.join("\n")).not.toContain("sentinel");
  });

  it.each([
    "POSTGRES_HOST",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
  ])("refuses %s when empty or unset, saying it must be set", (variable) => {
    for (const value of ["", undefined]) {
      expect(
        problems(databaseScope, { ...DATABASE, [variable]: value }),
      ).toEqual([`${variable} must be set`]);
    }
  });

  it("names a variable missing with no S3_* set", () => {
    expect(problems(cliScope, { ...CLI_ENV, MEDIA_DIR: undefined })).toEqual([
      "MEDIA_DIR must be set when no S3_* variable is set",
    ]);
  });
});

describe("parsed configuration", () => {
  it("reads the server environment into typed sections", () => {
    const parsed = config(serverScope, { ...SERVER_ENV, POSTGRES_SSL: "true" });
    expect(JSON.parse(JSON.stringify(parsed))).toEqual({
      http: {
        port: 3000,
        host: "0.0.0.0",
        publicBaseUrl: "https://loja.example",
        internalSecret: "[Redacted]",
      },
      database: {
        host: "db.internal",
        port: 6543,
        name: "store",
        user: "owner",
        password: "[Redacted]",
        ssl: true,
      },
      media: { kind: "disk", dir: "/data/media" },
      logging: { level: "info" },
    });
  });

  it("turns SSL off when POSTGRES_SSL is unset, empty or false", () => {
    for (const ssl of [undefined, "", "false"]) {
      const parsed = config(databaseScope, { ...DATABASE, POSTGRES_SSL: ssl });
      expect(parsed.database).toMatchObject({ ssl: false });
    }
  });

  it("logs at info when LOG_LEVEL is unset", () => {
    expect(config(migrateScope, DATABASE).logging).toEqual({ level: "info" });
  });

  it("stores media on disk at MEDIA_DIR when no S3_* is set", () => {
    expect(config(cliScope, CLI_ENV).media).toEqual({
      kind: "disk",
      dir: "/data/media",
    });
  });

  it("uses the bucket when all five S3_* are set, even with MEDIA_DIR", () => {
    const { media } = config(serverScope, { ...SERVER_ENV, ...BUCKET });
    expect(JSON.parse(JSON.stringify(media))).toEqual({
      kind: "bucket",
      endpoint: "https://storage.example",
      region: "iad",
      bucket: "media",
      accessKeyId: "key",
      secretAccessKey: "[Redacted]",
    });
  });

  it("keeps secrets readable only through reveal", () => {
    const parsed = config(cliScope, {
      ...CLI_ENV,
      CLOSEOUT_PASSWORD: "operator-password",
    }) as {
      database: { password: { reveal(): string } };
      cli: { password: { reveal(): string } };
    };
    expect(parsed.database.password.reveal()).toBe("hunter2");
    expect(parsed.cli.password.reveal()).toBe("operator-password");
  });

  it("leaves the CLI password unset when CLOSEOUT_PASSWORD is", () => {
    expect(config(cliScope, CLI_ENV).cli).toEqual({ password: undefined });
  });
});
