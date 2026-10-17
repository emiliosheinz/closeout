import { MigrationInterface, QueryRunner } from "typeorm";

export class Check1792251292953 implements MigrationInterface {
    name = 'Check1792251292953'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "listings" ALTER COLUMN "attributes" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "listings" ALTER COLUMN "attributes" SET DEFAULT '[]'`);
    }

}
