import { expect, test } from "@playwright/test";
import { findInAdmin, signIn } from "./helpers";

test("the catalog shows a data-derived count and filters through the URL", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("store-counts")).toContainText(
    /\d+ itens disponíveis/,
  );
  await page.getByRole("link", { name: /^Móveis/ }).click();
  await expect(page).toHaveURL(/categoria=moveis/);
  const count = await page.getByTestId("results-count").textContent();
  await page.goto("/?categoria=moveis&ordem=menor-preco");
  await expect(page.getByTestId("results-count")).toHaveText(count ?? "");
  await expect(page.getByRole("link", { name: /^Móveis/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("an unmatched search offers a way back to every item", async ({
  page,
}) => {
  await page.goto("/?q=helicoptero-de-brinquedo");
  await expect(page.getByText("Nada por aqui com esses filtros")).toBeVisible();
  await page.getByRole("link", { name: "Ver todos os itens" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("a page number past the end returns to the first page", async ({
  page,
}) => {
  await page.goto("/?categoria=moveis&pagina=999");
  await expect(page).toHaveURL(/\/\?categoria=moveis$/);
  await expect(page.getByTestId("results-count")).toBeVisible();
});

test("search, category and sort combine and show in the controls", async ({
  page,
}) => {
  await page.goto("/?q=mesa&categoria=moveis&ordem=menor-preco");
  await expect(
    page.getByRole("searchbox", { name: "Buscar itens" }),
  ).toHaveValue("mesa");
  await expect(page.getByRole("link", { name: /^Móveis/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page
      .getByRole("complementary", { name: "Filtros" })
      .getByRole("radio", { name: "Menor preço" }),
  ).toBeChecked();
});

test("an unauthenticated preview link sends the visitor to sign in", async ({
  page,
}) => {
  await page.goto(
    "/admin/anuncios/00000000-0000-0000-0000-000000000000/previa",
  );
  await expect(page).toHaveURL(/\/admin\/entrar$/);
});

test("broken catalog URLs fall back to defaults instead of failing", async ({
  page,
}) => {
  const response = await page.goto(
    "/?pagina=abc&ordem=xyz&min=-3&estado=quebrado",
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("results-count")).toBeVisible();
});

test("drafts stay private: no page, no sitemap entry", async ({ page }) => {
  await signIn(page);
  await findInAdmin(page, "Cadeira de escritório");
  const preview = page.getByRole("link", {
    name: "Pré-visualizar Cadeira de escritório",
  });
  const previewHref = await preview.getAttribute("href");
  await page.goto(previewHref ?? "");
  await expect(page.getByText("Pré-visualização: é assim")).toBeVisible();
  // The draft has no photos yet: a designed placeholder, never a broken image.
  await expect(page.getByTestId("photo-placeholder")).toBeVisible();

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
  expect(sitemap).toContain("/itens/");

  const missing = await page.request.get("/itens/cadeira-de-escritorio-aaaaaa");
  expect(missing.status()).toBe(404);
});

test("robots keeps the admin out of search engines", async ({ page }) => {
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap: http://web:3001/sitemap.xml");
});

test("pages carry the security headers", async ({ page }) => {
  const response = await page.request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("the image optimizer endpoint is disabled", async ({ page }) => {
  const response = await page.request.get(
    "/_next/image?url=%2Fmedia%2Fx.webp&w=64&q=75",
  );
  expect(response.status()).toBe(404);
});

test("fails on purpose", async () => {
  expect(1).toBe(2);
});
