import { expect, test } from "@playwright/test";
import { hydrated, STORE } from "./helpers";

test("a storefront visitor joins the waitlist from the catalog footer", async ({
  page,
}) => {
  await page.goto(STORE);
  await page.getByRole("link", { name: "Crie sua loja" }).click();
  await expect(page).toHaveURL(/\/waitlist\?ref=loja-e2e&src=catalog-footer$/);
  await hydrated(page);

  await page.getByLabel("Seu nome").fill("Visitante E2E");
  const email = page.getByRole("radio", { name: "E-mail" });
  // The radio is visually hidden; people click its segment, the label.
  await email.locator("xpath=ancestor::label").click();
  await expect(email).toBeChecked();
  await page.getByLabel("Seu e-mail").fill(`lista-${Date.now()}@e2e.test`);
  await page.getByRole("button", { name: "Entrar na lista" }).click();

  await expect(
    page.getByRole("heading", { name: "Pronto, você está na lista!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar para a loja" }),
  ).toHaveAttribute("href", STORE);
});
