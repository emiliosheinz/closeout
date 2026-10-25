import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  BASE_URL,
  hydrated,
  OTHER_OWNER_EMAIL,
  OTHER_STORE,
  STORE,
  samplePhoto,
  signIn,
} from "./helpers";

const OTHER_TITLE = `Vitrola da outra loja ${Date.now()}`;

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/** Slug of the first catalog card linking to an item of `store`. */
async function firstItemPath(page: Page, store: string): Promise<string> {
  await page.goto(store);
  const href = await page
    .locator(`a[href^="${store}/items/"]`)
    .first()
    .getAttribute("href");
  if (!href) throw new Error(`No item link on ${store}`);
  return href;
}

test.describe
  .serial("one deployment, many stores", () => {
    let otherItemPath = "";

    test("the owner of a second store publishes a listing there", async ({
      page,
    }) => {
      await signIn(page, OTHER_OWNER_EMAIL, ADMIN_PASSWORD);
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Outra Loja" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Novo anúncio" }).click();
      await expect(page).toHaveURL(/\/admin\/anuncios\/novo$/);
      await hydrated(page);
      await page.getByLabel("Nome do item").fill(OTHER_TITLE);
      await page.getByLabel("Preço (R$)").fill("300");
      const photo = await samplePhoto(page);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Adicionar fotos" }).click();
      await (await chooser).setFiles([
        { name: "vitrola.jpg", mimeType: "image/jpeg", buffer: photo },
      ]);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();
      await expect(
        page.getByText("Anúncio publicado. Já aparece na loja."),
      ).toBeVisible();

      await page.goto(OTHER_STORE);
      await page.getByRole("link", { name: OTHER_TITLE, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: OTHER_TITLE, level: 1 }),
      ).toBeVisible();
      otherItemPath = new URL(page.url()).pathname;
      expect(otherItemPath).toMatch(/^\/store\/outra-loja\/items\//);
    });

    test("each store shows only its own name, listings and sellers", async ({
      page,
    }) => {
      const storeItemPath = await firstItemPath(page, STORE);

      await page.goto(OTHER_STORE);
      await expect(page).toHaveTitle("Outra Loja");
      const other = await bodyText(page);
      expect(other).toContain(OTHER_TITLE);
      for (const foreign of [
        "Loja E2E",
        "Bicicleta aro 29",
        "Sofá retrátil",
        "Estamos de mudança",
      ]) {
        expect(other).not.toContain(foreign);
      }

      await page.goto(otherItemPath);
      const otherItem = await bodyText(page);
      expect(otherItem).toContain("Otávio Outra");
      for (const foreign of [
        "Loja E2E",
        "Ana Teste",
        "Admin de exemplo",
        "Vendedora de exemplo",
      ]) {
        expect(otherItem).not.toContain(foreign);
      }

      await page.goto(STORE);
      await expect(page).toHaveTitle("Loja E2E");
      const own = await bodyText(page);
      for (const foreign of ["Outra Loja", OTHER_TITLE, "Otávio Outra"]) {
        expect(own).not.toContain(foreign);
      }
      await page.goto(`${STORE}?q=${encodeURIComponent(OTHER_TITLE)}`);
      await expect(
        page.getByText("Nada por aqui com esses filtros"),
      ).toBeVisible();

      const itemSlug = otherItemPath.split("/").pop() ?? "";
      expect(
        (await page.request.get(`${STORE}/items/${itemSlug}`)).status(),
      ).toBe(404);
      const storeItemSlug = storeItemPath.split("/").pop() ?? "";
      expect(
        (
          await page.request.get(`${OTHER_STORE}/items/${storeItemSlug}`)
        ).status(),
      ).toBe(404);
      expect(
        (await page.request.get("/store/loja-que-nao-existe")).status(),
      ).toBe(404);
    });

    test("the sitemap lists both stores and their published items", async ({
      page,
    }) => {
      const storeItemPath = await firstItemPath(page, STORE);
      const sitemap = await (await page.request.get("/sitemap.xml")).text();
      for (const path of [STORE, OTHER_STORE, storeItemPath, otherItemPath]) {
        expect(sitemap).toContain(`<loc>${BASE_URL}${path}</loc>`);
      }
    });

    test("catalog and item pages link to their exact absolute store URL", async ({
      page,
    }) => {
      await page.goto(OTHER_STORE);
      for (const selector of [
        'link[rel="canonical"]',
        'meta[property="og:url"]',
      ]) {
        const attribute = selector.startsWith("link") ? "href" : "content";
        await expect(page.locator(selector)).toHaveAttribute(
          attribute,
          `${BASE_URL}${OTHER_STORE}`,
        );
      }

      await page.goto(otherItemPath);
      const itemUrl = `${BASE_URL}${otherItemPath}`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        itemUrl,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        itemUrl,
      );
      const href = await page
        .getByTestId("whatsapp-contact")
        .first()
        .getAttribute("href");
      expect(new URL(href ?? "").searchParams.get("text")).toContain(itemUrl);
    });
  });

test("the site root is a landing page that lists no stores", async ({
  page,
}) => {
  for (const path of ["/", "/?q=x"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "closeout", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Entrar para gerenciar sua loja" }),
    ).toHaveAttribute("href", "/admin/entrar");
    await expect(page.locator('a[href*="/store/"]')).toHaveCount(0);
    const text = await bodyText(page);
    expect(text).not.toContain("Loja E2E");
    expect(text).not.toContain("Outra Loja");
  }
});

test("not-found pages lead back to the site root or to the store", async ({
  page,
}) => {
  const outside = await page.goto("/pagina-que-nao-existe");
  expect(outside?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Ir para o início" }),
  ).toHaveAttribute("href", "/");

  const inside = await page.goto(`${STORE}/items/item-que-nao-existe`);
  expect(inside?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Ver o catálogo" }),
  ).toHaveAttribute("href", STORE);

  const legacy = await page.goto("/itens/x");
  expect(legacy?.status()).toBe(404);
});
