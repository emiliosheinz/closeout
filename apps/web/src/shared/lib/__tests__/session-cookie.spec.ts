import { clearSessionCookie, setSessionCookie } from "../session-cookie";

function recorder() {
  const calls: { name: string; value: string; options: unknown }[] = [];
  return {
    calls,
    jar: {
      set: (name: string, value: string, options?: unknown) => {
        calls.push({ name, value, options });
      },
    },
  };
}

describe("session cookie", () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: original });
  });

  it("is HttpOnly, SameSite=Lax, host-wide and expires with the session", () => {
    const { calls, jar } = recorder();
    const expires = new Date("2026-11-16T12:00:00Z");
    setSessionCookie(jar, "token-123", expires);
    expect(calls).toEqual([
      {
        name: "closeout_session",
        value: "token-123",
        options: {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          expires,
        },
      },
    ]);
  });

  it("is Secure in production", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    const { calls, jar } = recorder();
    setSessionCookie(jar, "t", new Date());
    expect(calls[0]?.options).toMatchObject({ secure: true });
  });

  it("expires immediately on clear", () => {
    const { calls, jar } = recorder();
    clearSessionCookie(jar);
    expect(calls[0]).toMatchObject({
      name: "closeout_session",
      value: "",
      options: { maxAge: 0, path: "/" },
    });
  });
});
