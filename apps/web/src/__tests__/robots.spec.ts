/** @jest-environment node */
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
});
