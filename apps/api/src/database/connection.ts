import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";
import { ENTITIES } from "./entities";

/** Connection options shared by the Nest app, the CLI and migrations. */
export function dataSourceOptions(): DataSourceOptions {
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

export const AppDataSource = new DataSource(dataSourceOptions());
