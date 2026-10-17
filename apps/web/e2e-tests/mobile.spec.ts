import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("the WhatsApp action is visible without scrolling on a phone", async ({
  page,
}) => {
  await page.goto("/?q=bicicleta");
  await page.getByRole("link", { name: "Bicicleta aro 29" }).click();
  await expect(page.getByTestId("whatsapp-contact").last()).toBeInViewport();
});

test("filters open in a bottom sheet and apply through the URL", async ({
  page,
}) => {
  await page.goto("/");
  await hydrated(page);
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrar itens" });
  await expect(sheet).toBeVisible();
  await sheet.getByText("Como novo").click();
  await sheet.getByText("Menor preço").click();
  await sheet.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/estado=como-novo/);
  await expect(page).toHaveURL(/ordem=menor-preco/);
  await expect(page.getByRole("button", { name: /^Filtros/ })).toContainText(
    "1",
  );
});

test("the catalog never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("sharing without a share sheet or clipboard offers the link to copy", async ({
  page,
}) => {
  // The e2e origin is plain http, where browsers expose no clipboard: the
  // button must fall back to showing the link.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await page.goto("/?q=bicicleta");
  await page.getByRole("link", { name: "Bicicleta aro 29" }).click();
  await hydrated(page);
  // window.prompt blocks the page, so answer it from a handler registered
  // before the click.
  const shown = new Promise<{ message: string; value: string }>((resolve) => {
    page.once("dialog", async (dialog) => {
      resolve({ message: dialog.message(), value: dialog.defaultValue() });
      await dialog.dismiss();
    });
  });
  await page.getByRole("button", { name: "Compartilhar" }).click();
  expect(await shown).toEqual({
    message: "Copie o link do item:",
    value: page.url(),
  });
});
