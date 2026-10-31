import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import { DataSource, type MigrationInterface, type QueryRunner } from "typeorm";
import { migrate } from "@/database/migrate";
import { InitialSchema1792251267804 } from "@/database/migrations/1792251267804-InitialSchema";
import { ImagePositionAndPublishedDate1792251747372 } from "@/database/migrations/1792251747372-ImagePositionAndPublishedDate";
import { MultipleSellersPerListing1792262257411 } from "@/database/migrations/1792262257411-MultipleSellersPerListing";
import { connection, runOnServer } from "./global-setup";

const MIGRATIONS = path.join(
  __dirname,
  "..",
  "src",
  "database",
  "migrations",
  "*.ts",
);

class Failing1900000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "half_done" ("id" integer)`);
    await queryRunner.query(`SELECT * FROM "no_such_table"`);
  }

  async down(): Promise<void> {}
}

/** Holds the migration lock longer than the DDL lock timeout. */
class Slow1900000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SELECT pg_sleep(11)");
  }

  async down(): Promise<void> {}
}

const SCHEMA_MIGRATIONS = [
  "InitialSchema1792251267804",
  "ImagePositionAndPublishedDate1792251747372",
  "MultipleSellersPerListing1792262257411",
  "MembersOwnContactProfiles1792802868935",
  "WaitlistSignups1793408283963",
];

/** The schema before contact profiles were tied to members. */
const BEFORE_MEMBER_PROFILES = [
  InitialSchema1792251267804,
  ImagePositionAndPublishedDate1792251747372,
  MultipleSellersPerListing1792262257411,
];

const id = (suffix: string) =>
  `00000000-0000-0000-0000-${suffix.padStart(12, "0")}`;
const STORE_A = id("a");
const STORE_B = id("b");
const OWNER = id("1");
const ADMIN_WITHOUT_PROFILE = id("2");
const OUTSIDER = id("3");
const OWNER_PROFILE = id("101");
const OWNER_DUPLICATE = id("102");
const LOGINLESS = id("103");
const OUTSIDER_IN_A = id("104");
const OUTSIDER_PROFILE = id("105");

describe("production migrator", () => {
  const databases: string[] = [];

  async function scratchDatabase(): Promise<string> {
    const database = `closeout_migrate_${randomBytes(4).toString("hex")}`;
    await runOnServer(`CREATE DATABASE "${database}"`);
    databases.push(database);
    return database;
  }

  function dataSource(
    database: string,
    extra: (new () => MigrationInterface)[] = [],
    migrations: (string | (new () => MigrationInterface))[] = [MIGRATIONS],
  ) {
    return new DataSource({
      type: "postgres",
      ...connection(database),
      migrations: [...migrations, ...extra],
      migrationsTableName: "migrations",
    });
  }

  async function query<T>(database: string, sql: string): Promise<T[]> {
    const ds = await new DataSource({
      type: "postgres",
      ...connection(database),
    }).initialize();
    try {
      return await ds.query(sql);
    } finally {
      await ds.destroy();
    }
  }

  const recorded = async (database: string) =>
    (
      await query<{ name: string }>(
        database,
        `SELECT "name" FROM "migrations" ORDER BY "id"`,
      )
    ).map((row) => row.name);

  afterAll(async () => {
    for (const database of databases) {
      await runOnServer(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    }
  });

  it("applies every migration to a fresh database, then nothing on a re-run", async () => {
    const database = await scratchDatabase();
    expect(await migrate(dataSource(database))).toEqual(SCHEMA_MIGRATIONS);
    expect(await migrate(dataSource(database))).toEqual([]);
    expect(await recorded(database)).toEqual(SCHEMA_MIGRATIONS);
  });

  it("applies nothing when one pending migration fails", async () => {
    const database = await scratchDatabase();
    await expect(
      migrate(dataSource(database, [Failing1900000000000])),
    ).rejects.toThrow('relation "no_such_table" does not exist');
    const tables = await query<{ table_name: string }>(
      database,
      `SELECT "table_name" FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('listings', 'half_done')`,
    );
    expect(tables).toEqual([]);
  });

  it("makes an overlapping release wait for the lock instead of timing out", async () => {
    const database = await scratchDatabase();
    const finished: string[] = [];
    const first = migrate(dataSource(database, [Slow1900000000000])).then(
      (applied) => {
        finished.push("first");
        return applied;
      },
    );
    await waitForAdvisoryLock(database);
    const second = migrate(dataSource(database, [Slow1900000000000])).then(
      (applied) => {
        finished.push("second");
        return applied;
      },
    );

    expect(await second).toEqual([]);
    expect(await first).toEqual([...SCHEMA_MIGRATIONS, "Slow1900000000000"]);
    expect(finished).toEqual(["first", "second"]);
  });

  async function waitForAdvisoryLock(database: string): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const held = await query<{ count: string }>(
        database,
        `SELECT count(*) FROM pg_locks l JOIN pg_database d ON d.oid = l.database
         WHERE l.locktype = 'advisory' AND l.granted AND d.datname = '${database}'`,
      );
      if (held[0]?.count !== "0") return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("the first run never took the migration lock");
  }

  describe("tying contact profiles to members", () => {
    async function atPreviousSchema(fixture: string): Promise<string> {
      const database = await scratchDatabase();
      await migrate(dataSource(database, [], BEFORE_MEMBER_PROFILES));
      await query(database, fixture);
      return database;
    }

    const twoStores = `
      INSERT INTO stores (id, slug, name) VALUES
        ('${STORE_A}', 'loja-a', 'Loja A'), ('${STORE_B}', 'loja-b', 'Loja B');
      INSERT INTO users (id, email, name, password_hash) VALUES
        ('${OWNER}', 'dona@example.com', 'Dona', 'x'),
        ('${ADMIN_WITHOUT_PROFILE}', 'admin@example.com', 'Admin Sem Perfil', 'x'),
        ('${OUTSIDER}', 'outra@example.com', 'Outra', 'x');
      INSERT INTO store_members (store_id, user_id, role) VALUES
        ('${STORE_A}', '${OWNER}', 'owner'),
        ('${STORE_A}', '${ADMIN_WITHOUT_PROFILE}', 'admin'),
        ('${STORE_B}', '${OUTSIDER}', 'owner');
      INSERT INTO categories (store_id, slug, name, position) VALUES
        ('${STORE_A}', 'moveis', 'Móveis', 0);`;

    const listing = (store: string, slug: string) =>
      `INSERT INTO listings (store_id, category_id, slug, title, condition)
       SELECT '${store}', id, '${slug}', '${slug}', 'good' FROM categories
        WHERE store_id = '${store}' AND slug = 'moveis';`;

    const assignments = (database: string) =>
      query<{ slug: string; seller_id: string }>(
        database,
        `SELECT l.slug, ls.seller_id FROM listings l
           LEFT JOIN listing_sellers ls ON ls.listing_id = l.id
          ORDER BY l.slug, ls.seller_id`,
      );

    it("keeps one profile per member, drops the rest and gives orphaned listings to the owner", async () => {
      const database = await atPreviousSchema(`
        ${twoStores}
        INSERT INTO sellers (id, store_id, user_id, display_name, whatsapp_number, created_at) VALUES
          ('${OWNER_PROFILE}', '${STORE_A}', '${OWNER}', 'Dona', '5511999998888', '2026-01-01'),
          ('${OWNER_DUPLICATE}', '${STORE_A}', '${OWNER}', 'Dona de novo', NULL, '2026-02-01'),
          ('${LOGINLESS}', '${STORE_A}', NULL, 'Sem login', '5511988887777', '2026-01-01'),
          ('${OUTSIDER_IN_A}', '${STORE_A}', '${OUTSIDER}', 'Outra em A', NULL, '2026-01-01'),
          ('${OUTSIDER_PROFILE}', '${STORE_B}', '${OUTSIDER}', 'Outra', NULL, '2026-01-01');
        ${listing(STORE_A, "orfao")}
        ${listing(STORE_A, "dividido")}
        ${listing(STORE_A, "duplicado")}
        ${listing(STORE_A, "de-fora")}
        INSERT INTO listing_sellers (listing_id, seller_id)
        SELECT l.id, s.id FROM listings l JOIN sellers s ON (l.slug, s.id) IN (
          ('orfao', '${LOGINLESS}'::uuid),
          ('dividido', '${LOGINLESS}'::uuid),
          ('dividido', '${OWNER_PROFILE}'::uuid),
          ('duplicado', '${OWNER_DUPLICATE}'::uuid),
          ('de-fora', '${OUTSIDER_IN_A}'::uuid));`);

      expect(await migrate(dataSource(database))).toEqual([
        "MembersOwnContactProfiles1792802868935",
        "WaitlistSignups1793408283963",
      ]);

      const profiles = await query(
        database,
        `SELECT s.store_id, s.user_id, s.display_name, s.whatsapp_number
           FROM sellers s ORDER BY s.store_id, s.display_name`,
      );
      expect(profiles).toEqual([
        {
          store_id: STORE_A,
          user_id: ADMIN_WITHOUT_PROFILE,
          display_name: "Admin Sem Perfil",
          whatsapp_number: null,
        },
        {
          store_id: STORE_A,
          user_id: OWNER,
          display_name: "Dona",
          whatsapp_number: "5511999998888",
        },
        {
          store_id: STORE_B,
          user_id: OUTSIDER,
          display_name: "Outra",
          whatsapp_number: null,
        },
      ]);
      expect(await assignments(database)).toEqual([
        { slug: "de-fora", seller_id: OWNER_PROFILE },
        { slug: "dividido", seller_id: OWNER_PROFILE },
        { slug: "duplicado", seller_id: OWNER_PROFILE },
        { slug: "orfao", seller_id: OWNER_PROFILE },
      ]);
    });

    async function expectUnchanged(database: string): Promise<void> {
      expect(await recorded(database)).toEqual(
        BEFORE_MEMBER_PROFILES.map((migration) => migration.name),
      );
      expect(
        await query(
          database,
          `SELECT COUNT(*)::int AS loginless FROM sellers WHERE user_id IS NULL`,
        ),
      ).toEqual([{ loginless: 1 }]);
      expect(await assignments(database)).toEqual([
        { slug: "orfao", seller_id: LOGINLESS },
      ]);
      const schema = await query(
        database,
        `SELECT
           (SELECT is_nullable FROM information_schema.columns
             WHERE table_name = 'sellers' AND column_name = 'user_id') AS user_id_nullable,
           to_regclass('public.store_invites') IS NULL AS no_invites_table`,
      );
      expect(schema).toEqual([
        { user_id_nullable: "YES", no_invites_table: true },
      ]);
    }

    it("refuses a store that has listings but no owner, naming it, and changes nothing", async () => {
      const database = await atPreviousSchema(`
        INSERT INTO stores (id, slug, name) VALUES ('${STORE_A}', 'sem-dona', 'Sem dona');
        INSERT INTO categories (store_id, slug, name, position) VALUES
          ('${STORE_A}', 'moveis', 'Móveis', 0);
        INSERT INTO sellers (id, store_id, display_name) VALUES
          ('${LOGINLESS}', '${STORE_A}', 'Sem login');
        ${listing(STORE_A, "orfao")}
        INSERT INTO listing_sellers (listing_id, seller_id)
        SELECT id, '${LOGINLESS}' FROM listings;`);

      await expect(migrate(dataSource(database))).rejects.toThrow(
        'store "sem-dona" has listings but no owner',
      );
      await expectUnchanged(database);
    });

    it("refuses a store with two owners, naming it, and changes nothing", async () => {
      const database = await atPreviousSchema(`
        ${twoStores}
        UPDATE store_members SET role = 'owner' WHERE user_id = '${ADMIN_WITHOUT_PROFILE}';
        INSERT INTO sellers (id, store_id, display_name) VALUES
          ('${LOGINLESS}', '${STORE_A}', 'Sem login');
        ${listing(STORE_A, "orfao")}
        INSERT INTO listing_sellers (listing_id, seller_id)
        SELECT id, '${LOGINLESS}' FROM listings;`);

      await expect(migrate(dataSource(database))).rejects.toThrow(
        'store "loja-a" has more than one owner',
      );
      await expectUnchanged(database);
    });

    it("lets the schema enforce one owner, the three roles and one profile per member", async () => {
      const database = await scratchDatabase();
      await migrate(dataSource(database));
      await query(database, twoStores);
      const insertProfile = (userId: string | null) =>
        query(
          database,
          `INSERT INTO sellers (store_id, user_id, display_name)
           VALUES ('${STORE_A}', ${userId ? `'${userId}'` : "NULL"}, 'x')`,
        );

      await insertProfile(OWNER);
      await expect(insertProfile(OWNER)).rejects.toThrow(
        "sellers_store_user_uq",
      );
      await expect(insertProfile(null)).rejects.toThrow(
        'null value in column "user_id"',
      );
      await query(
        database,
        `UPDATE store_members SET role = 'seller' WHERE user_id = '${ADMIN_WITHOUT_PROFILE}'`,
      );
      await expect(
        query(
          database,
          `UPDATE store_members SET role = 'manager' WHERE user_id = '${ADMIN_WITHOUT_PROFILE}'`,
        ),
      ).rejects.toThrow("store_members_role_valid");
      await expect(
        query(
          database,
          `UPDATE store_members SET role = 'owner' WHERE user_id = '${ADMIN_WITHOUT_PROFILE}'`,
        ),
      ).rejects.toThrow("store_members_one_owner_uq");

      await query(database, `DELETE FROM users WHERE id = '${OWNER}'`);
      expect(
        await query(
          database,
          `SELECT COUNT(*)::int AS remaining FROM sellers WHERE user_id = '${OWNER}'`,
        ),
      ).toEqual([{ remaining: 0 }]);
    });
  });

  describe("as a command", () => {
    const run = (database: string) =>
      promisify(execFile)("pnpm", ["exec", "tsx", "src/database/migrate.ts"], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, POSTGRES_DB: database },
        // A run that leaves connections open lingers until the pool's idle
        // timeout, which a pre-deploy step should not wait out.
        timeout: 5_000,
      });

    it("exits 0 after migrating", async () => {
      const database = await scratchDatabase();
      await expect(run(database)).resolves.toMatchObject({
        stdout: expect.stringContaining("Applied migrations:"),
      });
      expect(await recorded(database)).toEqual(SCHEMA_MIGRATIONS);
    });

    it("exits non-zero when the database cannot be migrated", async () => {
      await expect(run("closeout_no_such_database")).rejects.toMatchObject({
        code: 1,
      });
    });
  });
});
