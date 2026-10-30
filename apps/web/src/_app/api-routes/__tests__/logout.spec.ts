/** @vitest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/_app/api-routes/logout";
import { expectProblem } from "@/test/fixtures";

describe("logout route", () => {
  it("sends the browser to the login page and drops the cookie", async () => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
    const res = await POST(
      new NextRequest("http://web:3000/api/auth/logout", {
        method: "POST",
        headers: { origin: "http://web:3000" },
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://web:3000/admin/entrar");
    expect(res.headers.get("set-cookie")).toContain("closeout_session=;");
  });

  it("refuses a sign-out posted from another site and keeps the session", async () => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
    const upstream = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      new NextRequest("http://web:3000/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "http://evil.test",
          cookie: "closeout_session=abc",
        },
      }),
    );
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
    await expectProblem(res, 403, "Origem não permitida.");
  });
});
