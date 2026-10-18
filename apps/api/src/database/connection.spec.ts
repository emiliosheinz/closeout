import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

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

  beforeEach(() => {
    Object.assign(process.env, SETTINGS);
    // The module builds the migration data source on import, which needs
    // every setting present.
    ({ dataSourceOptions } = require("./connection"));
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it.each(
    Object.keys(SETTINGS),
  )("refuses to build options without %s", (name) => {
    delete process.env[name];
    expect(() => dataSourceOptions()).toThrow(`${name} must be set`);
  });

  it("refuses an empty setting", () => {
    process.env.POSTGRES_PASSWORD = "";
    expect(() => dataSourceOptions()).toThrow("POSTGRES_PASSWORD must be set");
  });

  it("connects with the configured settings", () => {
    const options = dataSourceOptions() as PostgresConnectionOptions;
    expect([
      options.host,
      options.port,
      options.database,
      options.username,
      options.password,
    ]).toEqual(["db.internal", 6543, "store", "owner", "hunter2"]);
  });
});
