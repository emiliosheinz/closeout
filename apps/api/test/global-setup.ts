import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DataSource } from "typeorm";

/**
 * Creates a throwaway database on the compose Postgres for this run and
 * applies the real migrations to it, so integration tests exercise the
 * production schema without touching development data. Returns the teardown
 * that drops it again.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const database = `closeout_test_${randomBytes(4).toString("hex")}`;
  await runOnServer(`CREATE DATABASE "${database}"`);

  process.env.POSTGRES_DB = database;
  const mediaDir = await mkdtemp(path.join(tmpdir(), "closeout-media-"));
  process.env.MEDIA_DIR = mediaDir;
  process.env.PUBLIC_BASE_URL = "http://storefront.test";
  process.env.INTERNAL_API_SECRET = "integration-test-secret-0123456789abcdef";

  const dataSource = new DataSource({
    type: "postgres",
    ...connection(database),
    migrations: [
      path.join(__dirname, "..", "src", "database", "migrations", "*.ts"),
    ],
    migrationsTableName: "migrations",
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();

  return async () => {
    await runOnServer(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await rm(mediaDir, { recursive: true, force: true });
  };
}

export function connection(database: string | undefined) {
  return {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database,
  };
}

/** Run one statement against the server's maintenance database. */
export async function runOnServer(sql: string): Promise<void> {
  const dataSource = new DataSource({
    type: "postgres",
    ...connection("postgres"),
  });
  await dataSource.initialize();
  try {
    await dataSource.query(sql);
  } finally {
    await dataSource.destroy();
  }
}
