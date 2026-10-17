import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";
import { ENTITIES } from "./entities";

/**
 * Connection options for the Nest app and the operator CLI, with pool guards
 * against runaway queries and abandoned transactions.
 */
export function dataSourceOptions(): DataSourceOptions {
  return {
    ...baseOptions(),
    extra: {
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 30_000,
      connectionTimeoutMillis: 5_000,
    },
  };
}

function baseOptions(): DataSourceOptions {
  return {
    type: "postgres",
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true",
    entities: ENTITIES,
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
    migrationsTableName: "migrations",
    synchronize: false,
  };
}

// Used by the migration CLI: no statement_timeout, migrations can run long.
export const AppDataSource = new DataSource(baseOptions());
