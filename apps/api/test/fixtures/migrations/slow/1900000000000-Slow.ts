import type { MigrationInterface, QueryRunner } from "typeorm";

/** Holds the migration lock longer than the DDL lock timeout. */
export class Slow1900000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SELECT pg_sleep(11)");
  }

  async down(): Promise<void> {}
}
