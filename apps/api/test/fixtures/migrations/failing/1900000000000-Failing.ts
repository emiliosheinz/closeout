import type { MigrationInterface, QueryRunner } from "typeorm";

export class Failing1900000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "half_done" ("id" integer)`);
    await queryRunner.query(`SELECT * FROM "no_such_table"`);
  }

  async down(): Promise<void> {}
}
