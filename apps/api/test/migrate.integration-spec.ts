import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import { DataSource } from "typeorm";
import { migrate } from "@/database/migrate";
import { connection, runOnServer } from "./global-setup";

const MIGRATIONS = path.join(
  __dirname,
  "..",
  "src",
  "database",
  "migrations",
  "*.ts",
);
const fixture = (name: string) =>
  path.join(__dirname, "fixtures", "migrations", name, "*.ts");

const SCHEMA_MIGRATIONS = [
  "InitialSchema1792251267804",
  "ImagePositionAndPublishedDate1792251747372",
  "MultipleSellersPerListing1792262257411",
];

describe("production migrator", () => {
  const databases: string[] = [];

  async function scratchDatabase(): Promise<string> {
    const database = `closeout_migrate_${randomBytes(4).toString("hex")}`;
    await runOnServer(`CREATE DATABASE "${database}"`);
    databases.push(database);
    return database;
  }

  function dataSource(database: string, extra: string[] = []) {
    return new DataSource({
      type: "postgres",
      ...connection(database),
      migrations: [MIGRATIONS, ...extra],
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
      migrate(dataSource(database, [fixture("failing")])),
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
    const first = migrate(dataSource(database, [fixture("slow")])).then(
      (applied) => {
        finished.push("first");
        return applied;
      },
    );
    await waitForAdvisoryLock(database);
    const second = migrate(dataSource(database, [fixture("slow")])).then(
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

  describe("as a command", () => {
    const run = (database: string) =>
      promisify(execFile)("pnpm", ["exec", "tsx", "src/database/migrate.ts"], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, POSTGRES_DB: database },
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
