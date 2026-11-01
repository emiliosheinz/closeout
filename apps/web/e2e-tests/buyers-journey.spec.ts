import { expect, type Page, test } from "@playwright/test";
import {
  findInAdmin,
  hydrated,
  listingMenu,
  listingRows,
  signIn,
} from "./helpers";

const RUN = Date.now();
const RITA = `Rita ${RUN}`;
const RITA_DOIS = `Rita Dois ${RUN}`;
const RITA_PHONE = "+55 11 98888-1111";

const buyerRow = (page: Page, name: string) =>
  page.getByRole("row").filter({ hasText: name });

/** Reserves the first available listing on the board for a new buyer and returns its title. */
async function reserveFirstAvailable(
  page: Page,
  buyer: string,
  agreedPrice: string,
  phone?: string,
): Promise<string> {
  await page.goto("/admin");
  await hydrated(page);
  const row = listingRows(page).filter({ hasText: "Disponível" }).first();
  const title = (await row.getByRole("link").first().textContent()) ?? "";
  await (await listingMenu(page, title))
    .getByRole("menuitemradio", { name: "Reservado" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do comprador").fill(buyer);
  if (phone) await dialog.getByLabel("WhatsApp (opcional)").fill(phone);
  await dialog.getByLabel("Valor combinado (R$)").fill(agreedPrice);
  await dialog.getByRole("button", { name: "Marcar como reservado" }).click();
  await expect(dialog).toBeHidden();
  return title;
}

async function openBuyers(page: Page) {
  await page
    .getByRole("navigation", { name: "Administração" })
    .getByRole("link", { name: "Compradores" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compradores", level: 1 }),
  ).toBeVisible();
  await hydrated(page);
}

test.describe
  .serial("from a reservation to what a buyer owes", () => {
    let firstTitle = "";
    let secondTitle = "";

    test("a reserved item shows on Compradores as owed, at the price agreed on the board", async ({
      page,
    }) => {
      await signIn(page);
      firstTitle = await reserveFirstAvailable(
        page,
        RITA,
        "100,00",
        RITA_PHONE,
      );

      await openBuyers(page);
      const row = buyerRow(page, RITA);
      await expect(
        row.getByRole("link", { name: `WhatsApp de ${RITA}:` }),
      ).toHaveAttribute("href", "https://wa.me/5511988881111");
      await expect(row).toContainText(firstTitle);
      await expect(row).toContainText("Não pago");
      await expect(row).toContainText("R$ 100,00");

      await page.goto("/admin");
      await findInAdmin(page, firstTitle);
      const board = listingRows(page).filter({ hasText: firstTitle });
      await (await listingMenu(page, firstTitle))
        .getByRole("menuitem", { name: "Dados da venda" })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Valor combinado (R$)").fill("60,00");
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(dialog).toBeHidden();
      await expect(board).toContainText("Reservado");

      await openBuyers(page);
      await expect(buyerRow(page, RITA)).toContainText("R$ 60,00");
    });

    test("merging a buyer moves their items to the other and removes them", async ({
      page,
    }) => {
      await signIn(page);
      secondTitle = await reserveFirstAvailable(page, RITA_DOIS, "40,00");

      await openBuyers(page);
      await expect(buyerRow(page, RITA_DOIS)).toContainText(secondTitle);
      await page
        .getByRole("button", { name: `Ações para ${RITA_DOIS}` })
        .click();
      await page.getByRole("menuitem", { name: "Juntar com..." }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("combobox", { name: "Juntar com" }).fill(RITA);
      await page.getByRole("option", { name: RITA, exact: true }).click();
      await expect(dialog).toContainText(
        `1 item de ${RITA_DOIS} passa para ${RITA}`,
      );
      await dialog.getByRole("button", { name: "Juntar compradores" }).click();
      await expect(dialog).toBeHidden();

      await expect(buyerRow(page, RITA_DOIS)).toHaveCount(0);
      const row = buyerRow(page, RITA);
      await expect(row).toContainText(firstTitle);
      await expect(row).toContainText(secondTitle);
      await expect(row).toContainText("R$ 100,00");
    });

    test("releasing the items lets the buyer be deleted", async ({ page }) => {
      await signIn(page);
      for (const title of [firstTitle, secondTitle]) {
        await findInAdmin(page, title);
        await (await listingMenu(page, title))
          .getByRole("menuitemradio", { name: "Disponível" })
          .click();
        await page
          .getByRole("button", { name: "Voltar para disponível" })
          .click();
        await expect(
          listingRows(page).filter({ hasText: title }),
        ).toContainText("Disponível");
      }

      await openBuyers(page);
      await page.getByRole("button", { name: `Ações para ${RITA}` }).click();
      await page.getByRole("menuitem", { name: "Excluir" }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Excluir" })
        .click();
      await expect(buyerRow(page, RITA)).toHaveCount(0);
    });
  });
