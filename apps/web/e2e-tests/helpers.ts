import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
/** Seller provisioned for the admin account in docker-compose.e2e.yaml. */
export const ADMIN_WHATSAPP = "5511988887777";

/** Absolute origin the app is configured with (PUBLIC_BASE_URL in the stack). */
export const BASE_URL = process.env.E2E_APP_BASE_URL ?? "http://web:3001";
/** The store the admin owns, seeded with demo members and listings. */
export const STORE = "/store/loja-e2e";
/** A second store with only its owner, for isolation checks. */
export const OTHER_STORE = "/store/outra-loja";
/** Its owner; every CLI-created account in the stack uses ADMIN_PASSWORD. */
export const OTHER_OWNER_EMAIL = "dono@outra-loja.test";

/**
 * Wait until client components are interactive. In the e2e stack pages
 * compile on first visit, so a fast test can otherwise act on server HTML
 * before React has attached its handlers.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

export async function signIn(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<void> {
  await page.goto("/admin/entrar");
  await hydrated(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Anúncios", level: 1 }),
  ).toBeVisible();
  await hydrated(page);
}

/**
 * The admin listing table's item rows. Hidden rows count too, because an open
 * modal dialog marks the table aria-hidden while it is still on screen.
 */
export function listingRows(page: Page) {
  return page.getByRole("row", { includeHidden: true }).filter({
    has: page.getByRole("combobox", {
      name: /^Publicação de /,
      includeHidden: true,
    }),
  });
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
  const html = await (await page.request.get(STORE)).text();
  const match = html.match(/\/media\/[0-9a-f-]{36}-sm\.webp/);
  if (!match) throw new Error("No seeded photo found on the storefront");
  const response = await page.request.get(
    match[0].replace("-sm.webp", "-og.jpg"),
  );
  return response.body();
}
