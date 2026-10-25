/** @vitest-environment node */
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "../proxy";

const API = "http://api:3001";

function run(path: string, headers: Record<string, string> = {}) {
  process.env.API_BASE_URL = `${API}/`;
  const res = proxy(new NextRequest(`http://web:3000${path}`, { headers }));
  return {
    rewrite: res.headers.get("x-middleware-rewrite"),
    res,
  };
}

describe("proxy", () => {
  it("strips trusted headers and keeps the rest", () => {
    const { res } = run("/api/v1/stores/x", {
      "x-internal-secret": "s",
      "x-client-ip": "1.2.3.4",
      cookie: "a=b",
      origin: "http://web:3000",
    });
    const kept = res.headers.get("x-middleware-override-headers") ?? "";
    expect(kept).not.toMatch(/x-internal-secret|x-client-ip/);
    expect(
      res.headers.get("x-middleware-request-x-internal-secret"),
    ).toBeNull();
    expect(res.headers.get("x-middleware-request-x-client-ip")).toBeNull();
    expect(res.headers.get("x-middleware-request-cookie")).toBe("a=b");
    expect(res.headers.get("x-middleware-request-origin")).toBe(
      "http://web:3000",
    );
  });

  it("sends a catalog URL that is not in its clean form to the clean one", () => {
    const { res } = run("/store/loja?min=&estado=bom");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://web:3000/store/loja?estado=bom",
    );
  });

  it("lets a clean catalog URL through", () => {
    const { res } = run("/store/loja?estado=bom");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("maps api and media paths to the API", () => {
    expect(run("/api/v1/stores/x?a=1").rewrite).toBe(`${API}/stores/x?a=1`);
    expect(run("/media/a.webp").rewrite).toBe(`${API}/media/a.webp`);
  });

  it("keeps protocol-relative paths on the API host", () => {
    expect(new URL(run("/api/v1//evil.example/x").rewrite ?? "").host).toBe(
      "api:3001",
    );
    expect(new URL(run("/media//evil.example/x").rewrite ?? "").host).toBe(
      "api:3001",
    );
  });
});

describe("proxy matcher", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, url });

  it("runs for the API, media and store catalog paths", () => {
    expect(matches("/api/v1/stores/x")).toBe(true);
    expect(matches("/media/a.webp")).toBe(true);
    expect(matches("/store/loja?min=")).toBe(true);
  });

  it("leaves item pages and other paths alone", () => {
    expect(matches("/store/loja/items/mesa")).toBe(false);
    expect(matches("/admin")).toBe(false);
    expect(matches("/")).toBe(false);
  });
});
