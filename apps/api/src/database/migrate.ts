import "reflect-metadata";
import { type DataSource, MigrationExecutor } from "typeorm";
import { AppDataSource } from "./connection";

/** Arbitrary but fixed: every release must contend for the same lock. */
const MIGRATION_LOCK_KEY = 7_260_418_001;

/**
 * Applies pending migrations for a production release. Overlapping releases
 * serialise on a session advisory lock held by one dedicated connection for
 * the whole run, and the pending set runs in a single transaction, so a
 * failure leaves the schema as it was.
 *
 * The lock is taken before `lock_timeout` is set: waiting for another
 * release is expected and bounded by the platform's pre-deploy timeout,
 * while DDL stuck behind live traffic should fail fast instead of queueing
 * storefront queries behind it.
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
    await queryRunner.query("SELECT pg_advisory_unlock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    return applied.map((migration) => migration.name);
  } finally {
    // Closing the session also drops the lock if the run failed.
    await queryRunner.release();
    await dataSource.destroy();
  }
}

if (require.main === module) {
  migrate(AppDataSource).then(
    (applied) => {
      console.log(
        applied.length
          ? `Applied migrations: ${applied.join(", ")}`
          : "No pending migrations",
      );
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
