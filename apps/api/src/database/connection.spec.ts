import type { PostgresDataSourceOptions } from "typeorm/driver/postgres/PostgresDataSourceOptions";
import { Secret } from "@/config/secret";
import { dataSourceOptions, migrationDataSourceOptions } from "./connection";

const DATABASE = {
  host: "db.internal",
  port: 6543,
  name: "store",
  user: "owner",
  password: new Secret("hunter2"),
  ssl: false,
};

describe("dataSourceOptions", () => {
  it("connects with the configured settings", () => {
    const options = dataSourceOptions(DATABASE) as PostgresDataSourceOptions;
    expect([
      options.host,
      options.port,
      options.database,
      options.username,
      options.password,
      options.ssl,
    ]).toEqual(["db.internal", 6543, "store", "owner", "hunter2", false]);
  });

  it("turns SSL on when configured", () => {
    const options = dataSourceOptions({
      ...DATABASE,
      ssl: true,
    }) as PostgresDataSourceOptions;
    expect(options.ssl).toBe(true);
  });

  it("bounds app queries but not migrations", () => {
    expect(dataSourceOptions(DATABASE).extra).toMatchObject({
      statement_timeout: 10_000,
    });
    expect(migrationDataSourceOptions(DATABASE).extra).toBeUndefined();
  });

  it("gives app connections back when the server or network hangs", () => {
    expect(dataSourceOptions(DATABASE).extra).toMatchObject({
      query_timeout: 15_000,
      keepAlive: true,
    });
  });
});
