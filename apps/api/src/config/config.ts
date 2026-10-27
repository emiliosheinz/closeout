import { z } from "zod";
import type { ScopeConfig } from "./report";
import { Secret } from "./secret";

const MUST_BE_SET = "must be set";
const PORT_RULE = "must be an integer from 1 to 65535";
const URL_RULE = "must be an absolute http(s) URL with a host";
const MIN_INTERNAL_SECRET_LENGTH = 32;
const SECRET_RULE = `must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters`;
const SSL_RULE = "must be true or false when set";
const BUCKET_RULE =
  "must be set: the S3_* variables are set all together or not at all";
const MEDIA_DIR_RULE = "must be set when no S3_* variable is set";

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
const LOG_LEVEL_RULE = `must be one of ${LOG_LEVELS.join(", ")} when set`;

const BUCKET_VARIABLES = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export interface HttpConfig {
  port: number;
  host: string;
  publicBaseUrl: string;
  internalSecret: Secret;
}

export interface LoggingConfig {
  level: LogLevel;
  /** `pretty` only when NODE_ENV is development: the production image ships no pretty-printer. */
  format: "json" | "pretty";
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: Secret;
  ssl: boolean;
}

/**
 * Bucket storage when the `S3_*` variables are set, otherwise local disk. A
 * partial bucket configuration is refused, never read as disk: uploads would
 * vanish on the next deploy.
 */
export type MediaConfig =
  | {
      kind: "bucket";
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: Secret;
    }
  | { kind: "disk"; dir: string };

const nonEmpty = z.string({ error: MUST_BE_SET });

const port = z
  .string({ error: PORT_RULE })
  .regex(/^\d+$/, { error: PORT_RULE })
  .transform(Number)
  .refine((value) => value >= 1 && value <= 65_535, { error: PORT_RULE });

const httpUrl = z.url({
  protocol: /^https?$/,
  hostname: /.+/,
  error: URL_RULE,
});

const http = z
  .object({
    PORT: port,
    HOST: nonEmpty,
    PUBLIC_BASE_URL: httpUrl,
    INTERNAL_API_SECRET: z
      .string({ error: SECRET_RULE })
      .min(MIN_INTERNAL_SECRET_LENGTH, { error: SECRET_RULE }),
  })
  .transform(
    (env): HttpConfig => ({
      port: env.PORT,
      host: env.HOST,
      publicBaseUrl: env.PUBLIC_BASE_URL,
      internalSecret: new Secret(env.INTERNAL_API_SECRET),
    }),
  );

const publicUrl = z
  .object({ PUBLIC_BASE_URL: httpUrl })
  .transform((env) => ({ publicBaseUrl: env.PUBLIC_BASE_URL }));

const database = z
  .object({
    POSTGRES_HOST: nonEmpty,
    POSTGRES_PORT: port,
    POSTGRES_DB: nonEmpty,
    POSTGRES_USER: nonEmpty,
    POSTGRES_PASSWORD: nonEmpty,
    POSTGRES_SSL: z.enum(["true", "false"], { error: SSL_RULE }).optional(),
  })
  .transform(
    (env): DatabaseConfig => ({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      name: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: new Secret(env.POSTGRES_PASSWORD),
      ssl: env.POSTGRES_SSL === "true",
    }),
  );

const media = z
  .object({
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MEDIA_DIR: z.string().optional(),
  })
  .transform((env, ctx): MediaConfig => {
    const {
      S3_ENDPOINT: endpoint,
      S3_REGION: region,
      S3_BUCKET: bucket,
      S3_ACCESS_KEY_ID: accessKeyId,
      S3_SECRET_ACCESS_KEY: secretAccessKey,
    } = env;
    if (endpoint && region && bucket && accessKeyId && secretAccessKey) {
      return {
        kind: "bucket",
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey: new Secret(secretAccessKey),
      };
    }
    const missing = BUCKET_VARIABLES.filter((name) => !env[name]);
    if (missing.length < BUCKET_VARIABLES.length) {
      for (const name of missing) {
        ctx.addIssue({ code: "custom", path: [name], message: BUCKET_RULE });
      }
      return z.NEVER;
    }
    if (!env.MEDIA_DIR) {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_DIR"],
        message: MEDIA_DIR_RULE,
      });
      return z.NEVER;
    }
    return { kind: "disk", dir: env.MEDIA_DIR };
  });

const logging = z
  .object({
    LOG_LEVEL: z.enum(LOG_LEVELS, { error: LOG_LEVEL_RULE }).default("info"),
    NODE_ENV: z.string().optional(),
  })
  .transform(
    (env): LoggingConfig => ({
      level: env.LOG_LEVEL,
      format: env.NODE_ENV === "development" ? "pretty" : "json",
    }),
  );

const cli = z
  .object({ CLOSEOUT_PASSWORD: z.string().optional() })
  .transform((env) => ({
    password:
      env.CLOSEOUT_PASSWORD === undefined
        ? undefined
        : new Secret(env.CLOSEOUT_PASSWORD),
  }));

/** The HTTP server. */
export const serverScope = { http, database, media, logging };
/** The operator CLI: boots the app module but serves no requests. */
export const cliScope = { http: publicUrl, database, media, cli };
/** The pre-deploy migration command. */
export const migrateScope = { database, logging };
/** The TypeORM CLI (migration generate, check, show, run, revert). */
export const databaseScope = { database };

export type AppConfig = ScopeConfig<typeof serverScope>;
export type CliConfig = ScopeConfig<typeof cliScope>;
