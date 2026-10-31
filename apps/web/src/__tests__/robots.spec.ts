/** @vitest-environment node */
import robots from "../app/robots";

describe("robots", () => {
  it("keeps crawlers out of admin, API and invite pages", () => {
    process.env.PUBLIC_BASE_URL = "https://closeout.example";
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/invite/"],
      },
      sitemap: "https://closeout.example/sitemap.xml",
    });
  });

  it("does not disallow the waitlist page", () => {
    const { disallow } = robots().rules as { disallow: string[] };
    expect(disallow.filter((rule) => "/waitlist".startsWith(rule))).toEqual([]);
  });
});
