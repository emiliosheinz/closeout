import { type BuiltServer, startBuiltServer } from "./child-process";

describe("production build", () => {
  let server: BuiltServer | undefined;
  afterEach(() => {
    if (server && server.child.exitCode === null) server.child.kill("SIGKILL");
    server = undefined;
  });

  it("serves health from the built server", async () => {
    server = await startBuiltServer();
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("exits 0 within 15 s of SIGTERM", async () => {
    server = await startBuiltServer();
    const sent = Date.now();
    server.child.kill("SIGTERM");
    const exit = await server.exit;
    expect(exit).toEqual({ code: 0, signal: null });
    expect(Date.now() - sent).toBeLessThan(15_000);
  });
});
