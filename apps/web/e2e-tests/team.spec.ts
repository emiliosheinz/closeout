import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_WHATSAPP,
  BASE_URL,
  hydrated,
  STORE,
  samplePhoto,
  signIn,
} from "./helpers";

const RUN = Date.now();
const SELLER = {
  email: `convidada-${RUN}@e2e.test`,
  name: "Clara Convidada",
  password: "senha-da-clara",
};
const LEAVER = {
  email: `de-saida-${RUN}@e2e.test`,
  name: "Rui de Saída",
  password: "senha-do-rui",
};
const TITLE = `Abajur da convidada ${RUN}`;
const INVALID =
  "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";

/** Issue an invite from Equipe and return the link the dialog shows once. */
async function invite(
  page: Page,
  email: string,
  role: "Vendedor(a)" | "Admin",
): Promise<string> {
  await page.goto("/admin/equipe");
  await hydrated(page);
  await page.getByRole("button", { name: "Convidar pessoas" }).click();
  const form = page.getByRole("dialog", { name: "Convidar pessoas" });
  await form.getByLabel("E-mail da pessoa").fill(email);
  const radio = form
    .getByRole("radiogroup", { name: "Papel", exact: true })
    .getByRole("radio", { name: role, exact: true });
  // The radio is visually hidden; people click its card, the label.
  await radio.locator("xpath=ancestor::label").click();
  await expect(radio).toBeChecked();
  await form.getByRole("button", { name: "Criar convite" }).click();
  const dialog = page.getByRole("dialog", { name: `Convite para ${email}` });
  const link = await dialog.getByLabel("Link do convite").inputValue();
  expect(link).toMatch(new RegExp(`^${BASE_URL}/invite/[\\w-]+$`));
  // Plain http exposes no clipboard, so the dialog falls back to selecting it.
  await dialog.getByRole("button", { name: "Copiar link" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    /Link copiado|O link está selecionado/,
  );
  await dialog.getByRole("button", { name: "Pronto" }).click();
  await expect(dialog).toBeHidden();
  return link;
}

/** Accept an invite in a browser with no session; returns the signed-in page. */
async function accept(
  browser: Browser,
  link: string,
  person: { name: string; password: string },
): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Loja E2E");
  await page.getByLabel("Seu nome").fill(person.name);
  await page.getByLabel("Senha", { exact: true }).fill(person.password);
  await page.getByRole("button", { name: "Criar conta e entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Loja E2E" }),
  ).toBeVisible();
  return page;
}

function expiryDate(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(RUN + 7 * 24 * 60 * 60 * 1000));
}

test.describe
  .serial("a store team grows by invite", () => {
    let sellerLink = "";
    let leaverLink = "";

    test("a manager invites a seller and copies the link from the dialog", async ({
      page,
    }) => {
      await signIn(page);
      sellerLink = await invite(page, SELLER.email, "Vendedor(a)");
      await expect(
        page.getByRole("row").filter({ hasText: SELLER.email }),
      ).toContainText(`Vendedor(a), vale até ${expiryDate()}`);
    });

    test("the invitee accepts in a fresh browser and lands in the store's admin", async ({
      browser,
    }) => {
      const page = await accept(browser, sellerLink, SELLER);
      await expect(
        page.getByRole("heading", { name: "Anúncios", level: 1 }),
      ).toBeVisible();
      await page.context().close();
    });

    test("the new seller publishes a listing without choosing sellers, and the store shows and hides it", async ({
      page,
      browser,
    }) => {
      await signIn(page, SELLER.email, SELLER.password);
      await page.getByRole("link", { name: "Novo anúncio" }).click();
      await expect(page).toHaveURL(/\/admin\/anuncios\/novo$/);
      await hydrated(page);
      await expect(page.getByRole("group", { name: "Quem vende" })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("checkbox", { name: SELLER.name }),
      ).toHaveCount(0);
      await expect(page.getByText(SELLER.name, { exact: true })).toBeVisible();
      await page.getByLabel("Nome do item").fill(TITLE);
      await page.getByLabel("Preço (R$)").fill("80");
      const photo = await samplePhoto(page);
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Adicionar fotos" }).click();
      await (await chooser).setFiles([
        { name: "abajur.jpg", mimeType: "image/jpeg", buffer: photo },
      ]);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();
      await expect(
        page.getByText("Anúncio publicado. Já aparece na loja."),
      ).toBeVisible();

      const visitor = await browser.newPage();
      const search = `${STORE}?q=${encodeURIComponent(TITLE)}`;
      await visitor.goto(search);
      await expect(
        visitor.getByRole("link", { name: TITLE, exact: true }),
      ).toBeVisible();

      await hydrated(page);
      await page.getByRole("combobox", { name: "Publicação" }).click();
      await page.getByRole("option", { name: "Rascunho" }).click();
      await expect(
        page.getByRole("combobox", { name: "Publicação" }),
      ).toHaveText("Rascunho");
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByText("Alterações salvas.")).toBeVisible();
      await visitor.goto(search);
      await expect(
        visitor.getByRole("link", { name: TITLE, exact: true }),
      ).toHaveCount(0);
      await visitor.close();
    });

    test("a seller has no store settings, and the old sellers page is gone", async ({
      page,
    }) => {
      await signIn(page, SELLER.email, SELLER.password);
      const nav = page.getByRole("navigation", { name: "Administração" });
      await expect(
        nav.getByRole("link", { name: "Equipe", exact: true }),
      ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Loja", exact: true }),
      ).toHaveCount(0);
      await nav.getByRole("link", { name: "Equipe", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/equipe$/);
      const rows = page.locator("tbody").getByRole("row");
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(SELLER.name);
      await expect(
        page.getByRole("button", { name: "Convidar pessoas" }),
      ).toHaveCount(0);

      for (const path of ["/admin/loja", "/admin/vendedores"]) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(404);
        await expect(page.getByText("Página não encontrada")).toBeVisible();
      }
    });

    test("used and unknown invite links show the same message, leak no referrer and lead to a working sign-in", async ({
      browser,
    }) => {
      const page = await (await browser.newContext()).newPage();
      const texts: string[] = [];
      for (const link of [sellerLink, "/invite/convite-que-nao-existe"]) {
        const response = await page.goto(link);
        expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
        await expect(page.getByText(INVALID)).toBeVisible();
        texts.push(await page.getByRole("main").innerText());
      }
      expect(texts[0]).toBe(texts[1]);

      // Leaving the no-referrer invite page must not blank the login's Origin.
      await page.getByRole("link", { name: "Já tenho conta: entrar" }).click();
      await expect(page).toHaveURL(/\/admin\/entrar$/);
      await hydrated(page);
      await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
      await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(
        page.getByRole("heading", { name: "Anúncios", level: 1 }),
      ).toBeVisible();

      await page.context().close();
    });

    test("the team page lists every member, then the pending invites", async ({
      page,
    }) => {
      await signIn(page);
      leaverLink = await invite(page, LEAVER.email, "Admin");

      const members = page.getByRole("region", { name: "Membros" });
      const owner = members.getByRole("row").filter({ hasText: ADMIN_EMAIL });
      await expect(owner).toContainText("Ana Teste");
      await expect(owner).toContainText("Dono(a)");
      await expect(owner).toContainText(`+${ADMIN_WHATSAPP}`);
      const seller = members.getByRole("row").filter({ hasText: SELLER.email });
      await expect(seller).toContainText(SELLER.name);
      await expect(seller).toContainText("Vendedor(a)");
      await expect(seller).toContainText("Sem WhatsApp");

      const invites = page.getByRole("region", { name: /Convites pendentes/ });
      await expect(
        invites.getByRole("row").filter({ hasText: LEAVER.email }),
      ).toContainText(`Admin, vale até ${expiryDate()}`);
      const order = await page
        .getByRole("region")
        .evaluateAll((regions) => regions.map((r) => r.id || r.textContent));
      expect(
        order.findIndex((id) => id?.includes("Membros")) <
          order.findIndex((id) => id?.includes("Convites pendentes")),
      ).toBe(true);
    });

    test("a signed-in visitor of an invite link is asked to sign out instead of accepting", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto(leaverLink);
      await hydrated(page);
      await expect(page.getByRole("status").first()).toHaveText(
        `Você está conectado como ${ADMIN_EMAIL}. Saia para aceitar este convite.`,
      );
      await expect(
        page.getByRole("button", { name: "Criar conta e entrar" }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Sair" }).click();
      await expect(
        page.getByRole("button", { name: "Criar conta e entrar" }),
      ).toBeVisible();
    });

    test("removing a member ends their session at once", async ({
      page,
      browser,
    }) => {
      const leaver = await accept(browser, leaverLink, LEAVER);

      await signIn(page);
      await page.goto("/admin/equipe");
      await hydrated(page);
      const card = page.getByRole("row").filter({ hasText: LEAVER.email });
      await card
        .getByRole("button", { name: `Ações para ${LEAVER.name}` })
        .click();
      await page.getByRole("menuitem", { name: "Remover" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Remover da equipe" })
        .click();
      await expect(card).toHaveCount(0);

      await leaver.goto("/admin");
      await expect(leaver).toHaveURL(/\/admin\/entrar$/);
      await leaver.context().close();
    });
  });
