import "reflect-metadata";
import { DataSource, MigrationExecutor } from "typeorm";
import { migrateScope } from "@/config/config";
import { parseOrExit } from "@/config/report";
import { createLogger } from "@/logging/logger";
import { migrationDataSourceOptions } from "./connection";

/** Arbitrary but fixed: every release must contend for the same lock. */
const MIGRATION_LOCK_KEY = 7_260_418_001;

/**
 * Applies pending migrations in one transaction, serialised across releases
 * by a session advisory lock. `lock_timeout` is set after the lock: waiting
 * for another release is expected, while DDL stuck behind live traffic
 * should fail fast.
 *
 * @returns the names of the migrations applied
 */
export async function migrate(dataSource: DataSource): Promise<string[]> {
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    await queryRunner.query("SELECT pg_advisory_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    await queryRunner.query("SET lock_timeout = '10s'");
    const applied = await new MigrationExecutor(
      dataSource,
      queryRunner,
    ).executePendingMigrations();
    return applied.map((migration) => migration.name);
  } finally {
    // Closing the session drops the advisory lock.
    await queryRunner.release();
    await dataSource.destroy();
  }
}

if (require.main === module) {
  const { database, logging } = parseOrExit(migrateScope);
  const logger = createLogger(logging);
  migrate(new DataSource(migrationDataSourceOptions(database))).then(
    (applied) => {
      logger.info(
        applied.length
          ? `Applied migrations: ${applied.join(", ")}`
          : "No pending migrations",
      );
    },
    (err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    },
  );
}
