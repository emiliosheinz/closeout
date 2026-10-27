import {
  type BuiltProcess,
  type BuiltServer,
  freePort,
  runBuilt,
  startBuiltServer,
} from "./child-process";

const PRODUCTION = { NODE_ENV: "production" };

/** Every line the process wrote, stdout and stderr, parsed as JSON. */
function lines(run: BuiltProcess): Record<string, unknown>[] {
  return `${run.stdout()}\n${run.stderr()}`
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Not a JSON line: ${line}`);
      }
    });
}

function expectStructured(written: Record<string, unknown>[]): void {
  for (const line of written) {
    expect(line).toEqual(
      expect.objectContaining({
        level: expect.any(Number),
        time: expect.any(Number),
        msg: expect.any(String),
      }),
    );
  }
}

describe("production log format", () => {
  let server: BuiltServer | undefined;
  afterEach(() => {
    if (server && server.child.exitCode === null) server.child.kill("SIGKILL");
    server = undefined;
  });

  it("writes only JSON lines from the server, boot through shutdown", async () => {
    server = await startBuiltServer(PRODUCTION);
    await fetch(`${server.url}/health`);
    await fetch(`${server.url}/nope`);
    server.child.kill("SIGTERM");
    expect(await server.exit).toEqual({ code: 0, signal: null });

    const written = lines(server);
    expect(written).toContainEqual(
      expect.objectContaining({
        msg: "API listening",
        host: "127.0.0.1",
        port: Number(new URL(server.url).port),
      }),
    );
    expect(written).toContainEqual(
      expect.objectContaining({ msg: "request completed" }),
    );
    expectStructured(written);
  });

  it("writes only JSON lines from a server that cannot reach the database", async () => {
    const run = runBuilt("main.js", {
      ...PRODUCTION,
      PORT: String(await freePort()),
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: String(await freePort()),
    });
    expect(await run.exit).not.toEqual({ code: 0, signal: null });

    const written = lines(run);
    expect(written).toContainEqual(
      expect.objectContaining({ level: 50, err: expect.any(Object) }),
    );
    expectStructured(written);
  });

  it("writes only JSON lines from a migrate run that applies nothing", async () => {
    const run = runBuilt("database/migrate.js", PRODUCTION);
    expect(await run.exit).toEqual({ code: 0, signal: null });

    const written = lines(run);
    expect(written).toContainEqual(
      expect.objectContaining({ msg: "No pending migrations" }),
    );
    expectStructured(written);
  });

  it("writes JSON lines, without the dev-only pretty-printer, when NODE_ENV is unset", async () => {
    const run = runBuilt("database/migrate.js", { NODE_ENV: undefined });
    expect(await run.exit).toEqual({ code: 0, signal: null });

    const written = lines(run);
    expect(written).toContainEqual(
      expect.objectContaining({ msg: "No pending migrations" }),
    );
    expectStructured(written);
  });

  it("writes only JSON lines from a failing migrate run", async () => {
    const run = runBuilt("database/migrate.js", {
      ...PRODUCTION,
      POSTGRES_DB: "closeout_no_such_database",
    });
    expect(await run.exit).toEqual({ code: 1, signal: null });

    const written = lines(run);
    expect(written).toContainEqual(
      expect.objectContaining({ msg: "Migration failed" }),
    );
    expectStructured(written);
  });
});
