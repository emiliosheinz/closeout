import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { DataSource } from "typeorm";

/**
 * Creates a throwaway database on the compose Postgres for this run and
 * applies the real migrations to it, so integration tests exercise the
 * production schema without touching development data.
 */
export default async function globalSetup(): Promise<void> {
  const database = `closeout_test_${randomBytes(4).toString("hex")}`;
  const admin = new Client(connection(process.env.POSTGRES_DB));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  await admin.end();

  process.env.POSTGRES_DB = database;
  process.env.CLOSEOUT_TEST_DATABASE = database;
  process.env.MEDIA_DIR = await mkdtemp(path.join(tmpdir(), "closeout-media-"));
  process.env.PUBLIC_BASE_URL = "http://storefront.test";
  process.env.INTERNAL_API_SECRET = "integration-test-secret";

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
}

export function connection(database: string | undefined) {
  return {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database,
  };
}
