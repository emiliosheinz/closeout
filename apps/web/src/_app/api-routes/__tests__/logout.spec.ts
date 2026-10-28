/** @vitest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/_app/api-routes/logout";

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
});
