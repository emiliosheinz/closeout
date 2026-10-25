import { expect, test } from "@playwright/test";
import { findInAdmin, STORE, signIn } from "./helpers";

test("drafts stay private: no page, no sitemap entry", async ({ page }) => {
  await signIn(page);
  await findInAdmin(page, "Cadeira de escritório");
  const preview = page.getByRole("link", {
    name: "Pré-visualizar Cadeira de escritório",
  });
  const previewHref = await preview.getAttribute("href");
  await page.goto(previewHref ?? "");
  await expect(page.getByText("Pré-visualização: é assim")).toBeVisible();

  const listings = await page.request.get(
    "/api/v1/public/stores/loja-e2e/listings?availability=all&pageSize=100",
  );
  const slugs: string[] = (await listings.json()).items.map(
    (i: { slug: string }) => i.slug,
  );
  expect(slugs.some((slug) => slug.startsWith("cadeira-de-escritorio"))).toBe(
    false,
  );

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("cadeira-de-escritorio");
  expect(sitemap).toContain(`${STORE}/items/`);

  const missing = await page.request.get(
    `${STORE}/items/cadeira-de-escritorio-aaaaaa`,
  );
  expect(missing.status()).toBe(404);
});

test("the running app serves robots rules, security headers and real 404s, and no image optimizer", async ({
  page,
}) => {
  await test.step("robots keeps the admin, the API and invite links out of search engines", async () => {
    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /invite/");
    expect(robots).toContain("Sitemap: http://web:3001/sitemap.xml");
  });

  await test.step("pages carry the security headers", async () => {
    const headers = (await page.request.get(STORE)).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  await test.step("the image optimizer endpoint is disabled", async () => {
    const response = await page.request.get(
      "/_next/image?url=%2Fmedia%2Fx.webp&w=64&q=75",
    );
    expect(response.status()).toBe(404);
  });

  await test.step("unknown, store-item and legacy paths return 404", async () => {
    for (const path of [
      "/pagina-que-nao-existe",
      `${STORE}/items/item-que-nao-existe`,
      "/itens/x",
    ]) {
      expect((await page.request.get(path)).status(), path).toBe(404);
    }
  });
});
