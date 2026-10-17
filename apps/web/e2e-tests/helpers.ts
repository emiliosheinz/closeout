import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
/** Seller provisioned for the admin account in docker-compose.e2e.yaml. */
export const ADMIN_WHATSAPP = "5511988887777";

/**
 * Wait until client components are interactive. In the e2e stack pages
 * compile on first visit, so a fast test can otherwise act on server HTML
 * before React has attached its handlers.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

export async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/entrar");
  await hydrated(page);
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Anúncios", level: 1 }),
  ).toBeVisible();
  await hydrated(page);
}

/** Search the admin listing table and wait for the filtered, interactive page. */
export async function findInAdmin(page: Page, title: string): Promise<void> {
  await page
    .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
    .fill(title);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\?q=/);
  await hydrated(page);
}

/** A real JPEG to upload: the demo seed's link-preview variant of a cover. */
export async function samplePhoto(page: Page): Promise<Buffer> {
  const html = await (await page.request.get("/")).text();
  const match = html.match(/\/media\/[0-9a-f-]{36}-sm\.webp/);
  if (!match) throw new Error("No seeded photo found on the storefront");
  const response = await page.request.get(
    match[0].replace("-sm.webp", "-og.jpg"),
  );
  return response.body();
}
