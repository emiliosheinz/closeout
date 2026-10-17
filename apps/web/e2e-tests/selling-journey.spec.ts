import { expect, test } from "@playwright/test";
import {
  ADMIN_WHATSAPP,
  findInAdmin,
  hydrated,
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
      await page
        .getByLabel("Categoria")
        .selectOption({ label: "Casa e decoração" });
      await page.getByLabel("Descrição").fill("Luz quente, cúpula de linho.");
      const photo = await samplePhoto(page);
      await page.locator("#photos").setInputFiles([
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
      await page.goto("/");
      await page
        .getByRole("searchbox", { name: "Buscar itens" })
        .fill("luminaria de teste");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/q=luminaria\+de\+teste/);
      await expect(page.getByTestId("results-count")).toHaveText("1 item");

      await page.getByRole("link", { name: TITLE }).click();
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
      await page.goto(`/?q=${encodeURIComponent(TITLE)}`);
      await page.getByRole("link", { name: TITLE }).click();
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

    test("marking it reserved and then sold shows on the storefront", async ({
      page,
      browser,
    }) => {
      await signIn(page);
      await findInAdmin(page, TITLE);
      const row = page
        .getByTestId("admin-listing-row")
        .filter({ hasText: TITLE });
      await row.getByLabel("Disponibilidade").selectOption("reserved");
      await expect(
        page.getByText(`"${TITLE}" marcado como reservado.`),
      ).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto("/?disponibilidade=reservado");
      await expect(
        visitor.getByRole("article").filter({ hasText: TITLE }),
      ).toContainText("Reservado");

      await row.getByLabel("Disponibilidade").selectOption("sold");
      await expect(
        page.getByText(`"${TITLE}" marcado como vendido.`),
      ).toBeVisible();

      await visitor.goto("/");
      await expect(visitor.getByRole("link", { name: TITLE })).toHaveCount(0);
      await visitor.goto("/?disponibilidade=vendido");
      await visitor.getByRole("link", { name: TITLE }).click();
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
