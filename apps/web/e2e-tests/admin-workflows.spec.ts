import { expect, test } from "@playwright/test";
import { findInAdmin, hydrated, samplePhoto, signIn } from "./helpers";

const TITLE = `Estante de teste ${Date.now()}`;
const NEW_NUMBER = "5521977771234";

test.describe
  .serial("everyday admin work", () => {
    let editUrl = "";
    let publicPath = "";

    test("saving with only a name creates an available draft without a price", async ({
      page,
    }) => {
      await signIn(page);
      const drafts = Number(
        await page.getByTestId("count-draft").textContent(),
      );

      await page.getByRole("link", { name: "Novo anúncio" }).click();
      await expect(page).toHaveURL(/\/admin\/anuncios\/novo$/);
      await hydrated(page);
      await page.getByLabel("Nome do item").fill(TITLE);
      await page.getByRole("button", { name: "Salvar rascunho" }).click();

      await expect(page.getByText("Alterações salvas.")).toBeVisible();
      editUrl = page.url().split("?")[0] ?? "";
      await expect(page.getByLabel("Publicação")).toHaveValue("draft");
      await expect(page.getByLabel("Disponibilidade")).toHaveValue("available");
      await expect(page.getByLabel("Preço (R$)")).toHaveValue("");

      await page.goto("/admin");
      await expect(page.getByTestId("count-draft")).toHaveText(
        String(drafts + 1),
      );
    });

    test("publishing without photos is refused and the form keeps what was typed", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto(editUrl);
      await hydrated(page);
      await page.getByLabel("Nome do item").fill(`${TITLE} revisada`);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();
      await expect(
        page.getByText("Adicione ao menos uma foto antes de publicar."),
      ).toBeVisible();
      await expect(page.getByLabel("Nome do item")).toHaveValue(
        `${TITLE} revisada`,
      );
      // The refused publish saved nothing, the name included.
      await page.reload();
      await expect(page.getByLabel("Nome do item")).toHaveValue(TITLE);
    });

    test("photos can be added, made the cover and removed", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto(editUrl);
      await hydrated(page);
      const photo = await samplePhoto(page);
      await page.getByLabel("Adicionar fotos").setInputFiles([
        { name: "a.jpg", mimeType: "image/jpeg", buffer: photo },
        { name: "b.jpg", mimeType: "image/jpeg", buffer: photo },
      ]);
      await expect(page.getByText("2 fotos adicionadas.")).toBeVisible();
      const second = await page.getByAltText("Foto 2").getAttribute("src");

      await page.getByRole("button", { name: "Usar foto 2 como capa" }).click();
      await expect(page.getByText("Capa atualizada.")).toBeVisible();
      await expect(page.getByAltText("Foto 1")).toHaveAttribute(
        "src",
        second ?? "",
      );

      await page.getByRole("button", { name: "Remover foto 2" }).click();
      await expect(page.getByText("Foto removida.")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Fotos/ })).toContainText(
        "1 de 20",
      );

      await page.reload();
      await hydrated(page);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();
      await expect(
        page.getByText("Anúncio publicado. Já aparece na loja."),
      ).toBeVisible();
      publicPath = new URL(
        (await page
          .getByRole("link", { name: "Ver na loja" })
          .getAttribute("href")) ?? "",
        page.url(),
      ).pathname;
    });

    test("the admin table search shows only matching titles", async ({
      page,
    }) => {
      await signIn(page);
      await findInAdmin(page, "Bicicleta");
      const rows = page.getByTestId("admin-listing-row");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Bicicleta aro 29");
      await expect(page.getByText("Geladeira frost free 375 L")).toHaveCount(0);
    });

    test("a seller's new number is used by their public listings", async ({
      page,
    }) => {
      await signIn(page);
      await page
        .getByRole("navigation", { name: "Administração" })
        .getByRole("link", { name: "Vendedores", exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/vendedores$/);
      await hydrated(page);
      const number = page.getByLabel("WhatsApp").first();

      await number.fill("11 9999-0000");
      await page
        .getByRole("button", { name: "Salvar contato" })
        .first()
        .click();
      await expect(page.getByText(/código do país/).first()).toBeVisible();
      await expect(number).toHaveValue("11 9999-0000");

      await number.fill("+55 21 97777-1234");
      await page
        .getByRole("button", { name: "Salvar contato" })
        .first()
        .click();
      await expect(page.getByText("Contato salvo.").first()).toBeVisible();

      await page.goto(publicPath);
      const href = await page
        .getByTestId("whatsapp-contact")
        .first()
        .getAttribute("href");
      expect(new URL(href ?? "").pathname).toBe(`/${NEW_NUMBER}`);

      // Restore the fixture number the other journeys expect.
      await page.goto("/admin/vendedores");
      await hydrated(page);
      await page.getByLabel("WhatsApp").first().fill("+55 11 98888-7777");
      await page
        .getByRole("button", { name: "Salvar contato" })
        .first()
        .click();
      await expect(page.getByText("Contato salvo.").first()).toBeVisible();
    });

    test("duplicating opens a draft copy", async ({ page }) => {
      await signIn(page);
      await findInAdmin(page, TITLE);
      await page.getByRole("button", { name: `Duplicar ${TITLE}` }).click();
      await expect(page).toHaveURL(/copiado=1/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `${TITLE} (cópia)`,
      );
      await expect(page.getByText("Cópia criada como rascunho.")).toBeVisible();
    });

    test("deleting asks first and takes the listing off its public URL", async ({
      page,
    }) => {
      await signIn(page);
      await findInAdmin(page, TITLE);
      const rows = page.getByTestId("admin-listing-row");
      await expect(rows).toHaveCount(2);

      await page
        .getByRole("button", { name: `Excluir ${TITLE}`, exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(
        "o link compartilhado deixa de funcionar",
      );
      await dialog.getByRole("button", { name: "Excluir anúncio" }).click();
      await expect(page.getByText(`"${TITLE}" foi excluído.`)).toBeVisible();
      await expect(rows).toHaveCount(1);

      const response = await page.request.get(publicPath);
      expect(response.status()).toBe(404);
    });

    test("renaming the store changes the storefront header and title", async ({
      page,
    }) => {
      await signIn(page);
      await page
        .getByRole("navigation", { name: "Administração" })
        .getByRole("link", { name: "Loja", exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/loja$/);
      await hydrated(page);
      await page.getByLabel("Nome da loja").fill("Bazar da Mudança");
      await page.getByRole("button", { name: "Salvar loja" }).click();
      await expect(page.getByText("Loja atualizada.")).toBeVisible();

      await page.goto("/");
      await expect(page).toHaveTitle("Bazar da Mudança");
      await expect(page.locator("header").first()).toContainText(
        "Bazar da Mudança",
      );
    });
  });

test("sign-in and sign-out refuse requests from other sites without touching cookies", async ({
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" },
    data: { email: "admin@e2e.test", password: "x" },
  });
  expect(login.status()).toBe(403);
  expect(login.headers()["set-cookie"]).toBeUndefined();

  const logout = await request.post("/api/auth/logout", {
    headers: { Origin: "https://evil.example" },
  });
  expect(logout.status()).toBe(403);
  expect(logout.headers()["set-cookie"]).toBeUndefined();
});
