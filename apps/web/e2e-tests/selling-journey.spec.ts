import { expect, test } from "@playwright/test";
import {
  ADMIN_WHATSAPP,
  findInAdmin,
  hydrated,
  STORE,
  samplePhoto,
  signIn,
} from "./helpers";

const TITLE = `Luminária de teste ${Date.now()}`;

test.describe
  .serial("from listing to WhatsApp and back", () => {
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

    test("a visitor finds it by search and opens WhatsApp with the seller", async ({
      page,
    }) => {
      await page.goto(STORE);
      await page
        .getByRole("searchbox", { name: "Buscar itens" })
        .fill("luminaria de teste");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/q=luminaria\+de\+teste/);
      await expect(page.getByTestId("results-count")).toHaveText("1 item");

      await page.getByRole("link", { name: TITLE, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: TITLE, level: 1 }),
      ).toBeVisible();
      await expect(page.getByText("R$ 1.234,50").first()).toBeVisible();

      const contact = page.getByTestId("whatsapp-contact").first();
      const href = new URL((await contact.getAttribute("href")) ?? "");
      expect(href.host).toBe("wa.me");
      expect(href.pathname).toBe(`/${ADMIN_WHATSAPP}`);
      const text = href.searchParams.get("text") ?? "";
      expect(text).toContain(`"${TITLE}"`);
      expect(text).toContain(page.url());
      expect(await contact.getAttribute("target")).toBe("_blank");
    });

    test("the item page carries link-preview metadata", async ({ page }) => {
      await page.goto(`${STORE}?q=${encodeURIComponent(TITLE)}`);
      await page.getByRole("link", { name: TITLE, exact: true }).click();
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        TITLE,
      );
      const image = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(image).toMatch(
        /^http:\/\/web:3001\/media\/[0-9a-f-]{36}-og\.jpg$/,
      );
      expect(
        (await page.request.get(image ?? "")).headers()["content-type"],
      ).toBe("image/jpeg");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        page.url(),
      );
    });

    test("an item sold by two people asks the buyer whom to message", async ({
      page,
      browser,
    }) => {
      const partner = "Vendedora de exemplo";
      await signIn(page);
      await page.goto("/admin/equipe");
      await hydrated(page);
      const card = page
        .getByRole("row")
        .filter({ hasText: "seller@loja-e2e.test" });
      await card.getByRole("button", { name: /^Ações para / }).click();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog");
      await editDialog.getByLabel("WhatsApp").fill("+55 21 97777-0000");
      await editDialog
        .getByRole("button", { name: "Salvar alterações" })
        .click();
      await expect(editDialog).toBeHidden();
      await expect(card).toContainText("+5521977770000");

      await page.goto("/admin");
      await findInAdmin(page, TITLE);
      await page
        .getByTestId("admin-listing-row")
        .filter({ hasText: TITLE })
        .getByRole("link", { name: `Editar ${TITLE}` })
        .click();
      await hydrated(page);
      await page.getByRole("checkbox", { name: partner }).check();
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByText("Alterações salvas.")).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto(`${STORE}?q=${encodeURIComponent(TITLE)}`);
      await visitor.getByRole("link", { name: TITLE, exact: true }).click();
      await hydrated(visitor);
      await visitor
        .getByRole("button", { name: "Chamar no WhatsApp" })
        .last()
        .click();
      const dialog = visitor.getByRole("dialog", {
        name: "Com quem você quer falar?",
      });
      const numbers = await dialog
        .getByRole("link")
        .evaluateAll((links) =>
          links.map(
            (link) => new URL(link.getAttribute("href") ?? "").pathname,
          ),
        );
      expect(numbers.sort()).toEqual([`/${ADMIN_WHATSAPP}`, "/5521977770000"]);
      await visitor.close();
    });

    test("marking it reserved and then sold shows on the storefront", async ({
      page,
      browser,
    }) => {
      await signIn(page);
      await findInAdmin(page, TITLE);
      const row = page
        .getByTestId("admin-listing-row")
        .filter({ hasText: TITLE });
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
  });
