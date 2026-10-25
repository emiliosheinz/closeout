import { expect, test } from "@playwright/test";
import {
  ADMIN_WHATSAPP,
  findInAdmin,
  hydrated,
  listingRows,
  STORE,
  samplePhoto,
  signIn,
} from "./helpers";

const TITLE = `Luminária de teste ${Date.now()}`;

test.describe
  .serial("from listing to WhatsApp and back", () => {
    let publicPath = "";

    test("an admin creates a listing with photos and publishes it", async ({
      page,
    }) => {
      await signIn(page);
      await page.getByRole("link", { name: "Novo anúncio" }).click();
      await expect(page).toHaveURL(/\/admin\/anuncios\/novo$/);
      await hydrated(page);
      await page.getByLabel("Nome do item").fill(TITLE);
      await page.getByLabel("Preço (R$)").fill("1.234,50");
      await page.getByRole("combobox", { name: "Categoria" }).click();
      await page.getByRole("option", { name: "Casa e decoração" }).click();
      await expect(
        page.getByRole("combobox", { name: "Categoria" }),
      ).toHaveText("Casa e decoração");
      await page.getByLabel("Descrição").fill("Luz quente, cúpula de linho.");
      const photo = await samplePhoto(page);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Adicionar fotos" }).click();
      await (await chooser).setFiles([
        { name: "frente.jpg", mimeType: "image/jpeg", buffer: photo },
        { name: "lado.jpg", mimeType: "image/jpeg", buffer: photo },
      ]);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();

      await expect(
        page.getByText("Anúncio publicado. Já aparece na loja."),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: /Fotos/ })).toContainText(
        "2 de 20",
      );
    });

    test("a visitor finds it by category and search and opens WhatsApp with the seller", async ({
      page,
    }) => {
      await test.step("the category chip lists it", async () => {
        await page.goto(STORE);
        await page.getByRole("link", { name: /^Casa e decoração/ }).click();
        await expect(page).toHaveURL(/categoria=casa-e-decoracao/);
        await expect(
          page.getByRole("link", { name: TITLE, exact: true }),
        ).toBeVisible();
      });

      await test.step("the search finds it", async () => {
        await page
          .getByRole("searchbox", { name: "Buscar itens" })
          .fill("luminaria de teste");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/q=luminaria\+de\+teste/);
        await expect(page.getByTestId("results-count")).toHaveText("1 item");
      });

      await page.getByRole("link", { name: TITLE, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: TITLE, level: 1 }),
      ).toBeVisible();
      publicPath = new URL(page.url()).pathname;
      await expect(page.getByText("R$ 1.234,50").first()).toBeVisible();
      const image = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(
        (await page.request.get(image ?? "")).headers()["content-type"],
      ).toBe("image/jpeg");

      const contact = page.getByTestId("whatsapp-contact").first();
      const href = new URL((await contact.getAttribute("href")) ?? "");
      expect(href.host).toBe("wa.me");
      expect(href.pathname).toBe(`/${ADMIN_WHATSAPP}`);
      const text = href.searchParams.get("text") ?? "";
      expect(text).toContain(`"${TITLE}"`);
      expect(text).toContain(page.url());
      expect(await contact.getAttribute("target")).toBe("_blank");
    });

    test("marking it reserved and then sold shows on the storefront", async ({
      page,
      browser,
    }) => {
      await signIn(page);
      await findInAdmin(page, TITLE);
      const row = listingRows(page).filter({ hasText: TITLE });
      const availability = row.getByRole("combobox", {
        name: `Disponibilidade de ${TITLE}`,
      });
      await availability.click();
      await page.getByRole("option", { name: "Reservado" }).click();
      await expect(availability).toHaveText("Reservado");
      await expect(
        page.getByText(`"${TITLE}" marcado como reservado.`),
      ).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto(`${STORE}?disponibilidade=reservado`);
      await expect(
        visitor.getByRole("article").filter({ hasText: TITLE }),
      ).toContainText("Reservado");

      await availability.click();
      await page.getByRole("option", { name: "Vendido" }).click();
      await expect(availability).toHaveText("Vendido");
      await expect(
        page.getByText(`"${TITLE}" marcado como vendido.`),
      ).toBeVisible();

      await visitor.goto(STORE);
      await expect(
        visitor.getByRole("link", { name: TITLE, exact: true }),
      ).toHaveCount(0);
      await visitor.goto(`${STORE}?disponibilidade=vendido`);
      await visitor.getByRole("link", { name: TITLE, exact: true }).click();
      await expect(
        visitor.getByText("Este item já foi vendido.").first(),
      ).toBeVisible();
      await expect(visitor.getByTestId("whatsapp-contact")).toHaveCount(0);
      await expect(
        visitor.getByRole("heading", {
          name: "Esse já foi, mas ainda temos estes",
        }),
      ).toBeVisible();
      await visitor.close();
    });

    test("a copy is made as a draft, and deleting the listing takes it off its public URL", async ({
      page,
    }) => {
      await signIn(page);

      await test.step("duplicating opens a draft copy", async () => {
        await findInAdmin(page, TITLE);
        await page.getByRole("button", { name: `Duplicar ${TITLE}` }).click();
        await page.getByRole("button", { name: "Duplicar anúncio" }).click();
        await expect(page).toHaveURL(/copiado=1/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          `${TITLE} (cópia)`,
        );
        await expect(
          page.getByRole("combobox", { name: "Publicação" }),
        ).toHaveText("Rascunho");
      });

      await test.step("deleting asks first and the public URL returns 404", async () => {
        await page.goto("/admin");
        await findInAdmin(page, TITLE);
        const rows = listingRows(page);
        await expect(rows).toHaveCount(2);

        await page
          .getByRole("button", { name: `Excluir ${TITLE}`, exact: true })
          .click();
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toContainText(
          "o link compartilhado deixa de funcionar",
        );
        await dialog.getByRole("button", { name: "Excluir anúncio" }).click();
        await expect(rows).toHaveCount(1);

        const response = await page.request.get(publicPath);
        expect(response.status()).toBe(404);
      });
    });
  });
