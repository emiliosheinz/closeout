import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_WHATSAPP,
  hydrated,
  STORE,
  samplePhoto,
  signIn,
} from "./helpers";

const NEW_NUMBER = "5521977771234";
/** A seeded published listing sold only by the admin. */
const ADMIN_LISTING = 'Smart TV 50" 4K';

test("a member's new WhatsApp number and photo reach their public listings", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation", { name: "Administração" })
    .getByRole("link", { name: "Equipe", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/team$/);
  await hydrated(page);
  const row = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
  const dialog = page.getByRole("dialog");
  const openEdit = async () => {
    await row.getByRole("button", { name: /^Ações para / }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
  };
  const saveNumber = async (value: string) => {
    await dialog.getByLabel("WhatsApp").fill(value);
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden();
  };

  const avatar =
    await test.step("the admin uploads a photo and saves a new number", async () => {
      await openEdit();
      await dialog.locator("input[type=file]").setInputFiles({
        name: "avatar.jpg",
        mimeType: "image/jpeg",
        buffer: await samplePhoto(page),
      });
      const image = dialog.locator("img");
      await expect(image).toBeVisible();
      const src = await image.getAttribute("src");
      if (!src) throw new Error("The uploaded photo has no URL");
      await saveNumber("+55 21 97777-1234");
      await expect(row).toContainText("+5521977771234");
      return new URL(src, page.url()).pathname;
    });

  await test.step("the public listing uses the new number and photo", async () => {
    await page.goto(`${STORE}?q=${encodeURIComponent("Smart TV")}`);
    await page.getByRole("link", { name: ADMIN_LISTING, exact: true }).click();
    const href = await page
      .getByTestId("whatsapp-contact")
      .first()
      .getAttribute("href");
    expect(new URL(href ?? "").pathname).toBe(`/${NEW_NUMBER}`);
    await expect(page.locator(`img[src$="${avatar}"]`).first()).toBeVisible();
  });

  await test.step("restore the fixture number the other journeys expect", async () => {
    await page.goto("/admin/team");
    await hydrated(page);
    await openEdit();
    await saveNumber("+55 11 98888-7777");
    await expect(row).toContainText(`+${ADMIN_WHATSAPP}`);
  });
});
