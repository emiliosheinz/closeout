import { DataSource } from "typeorm";
import { databaseScope } from "@/config/config";
import { parseOrExit } from "@/config/report";
import { migrationDataSourceOptions } from "./connection";

/**
 * The TypeORM CLI's data source. The CLI loads this module rather than
 * calling an entry point, so it parses the database settings on import.
 */
export const AppDataSource = new DataSource(
  migrationDataSourceOptions(parseOrExit(databaseScope).database),
);
