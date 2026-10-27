import path from "node:path";
import type { DataSourceOptions } from "typeorm";
import type { DatabaseConfig } from "@/config/config";
import { ENTITIES } from "./entities";

/**
 * Connection options for the Nest app and the operator CLI, with pool guards
 * against runaway queries and abandoned transactions.
 */
export function dataSourceOptions(database: DatabaseConfig): DataSourceOptions {
  return {
    ...migrationDataSourceOptions(database),
    extra: {
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 30_000,
      connectionTimeoutMillis: 5_000,
    },
  };
}

/** For migrations: no statement_timeout, migrations can run long. */
export function migrationDataSourceOptions(
  database: DatabaseConfig,
): DataSourceOptions {
  return {
    type: "postgres",
    host: database.host,
    port: database.port,
    database: database.name,
    username: database.user,
    password: database.password.reveal(),
    ssl: database.ssl,
    entities: ENTITIES,
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
    migrationsTableName: "migrations",
    synchronize: false,
  };
}
