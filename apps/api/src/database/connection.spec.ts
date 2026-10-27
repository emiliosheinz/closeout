import type { PostgresDataSourceOptions } from "typeorm/driver/postgres/PostgresDataSourceOptions";

const SETTINGS = {
  POSTGRES_HOST: "db.internal",
  POSTGRES_PORT: "6543",
  POSTGRES_DB: "store",
  POSTGRES_USER: "owner",
  POSTGRES_PASSWORD: "hunter2",
};

describe("dataSourceOptions", () => {
  const original = { ...process.env };
  let dataSourceOptions: typeof import("./connection").dataSourceOptions;

  beforeEach(async () => {
    Object.assign(process.env, SETTINGS);
    // The module builds the migration data source on import, which needs
    // every setting present.
    ({ dataSourceOptions } = await import("./connection.js"));
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("refuses to build options without a setting", () => {
    delete process.env.POSTGRES_HOST;
    expect(() => dataSourceOptions()).toThrow("POSTGRES_HOST must be set");
  });

  it("refuses an empty setting", () => {
    process.env.POSTGRES_PASSWORD = "";
    expect(() => dataSourceOptions()).toThrow("POSTGRES_PASSWORD must be set");
  });

  it("connects with the configured settings", () => {
    const options = dataSourceOptions() as PostgresDataSourceOptions;
    expect([
      options.host,
      options.port,
      options.database,
      options.username,
      options.password,
    ]).toEqual(["db.internal", 6543, "store", "owner", "hunter2"]);
  });
});
