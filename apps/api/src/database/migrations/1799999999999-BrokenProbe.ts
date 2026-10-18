import type { MigrationInterface, QueryRunner } from "typeorm";

export class BrokenProbe1799999999999 implements MigrationInterface {
  name = "BrokenProbe1799999999999";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE no_such_table ADD probe text");
  }

  public async down(): Promise<void> {}
}
