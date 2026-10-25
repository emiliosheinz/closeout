import {
  type Browser,
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from "@playwright/test";
import { hydrated, listingRows, samplePhoto, signIn } from "./helpers";

const RUN = Date.now();
const TITLE = `Luminária do feedback ${RUN}`;
const MEMBER = {
  email: `feedback-${RUN}@e2e.test`,
  name: "Fábio Feedback",
  password: "senha-do-fabio",
};
const REVOKED_EMAIL = `revogado-${RUN}@e2e.test`;
const GENERIC = "Não foi possível salvar. Tente de novo.";
const OFFLINE = "Sem conexão. Verifique a internet e tente de novo.";

const TOASTS = "[data-sonner-toast]";

function toast(page: Page, text: string): Locator {
  return page.locator(TOASTS).filter({ hasText: text });
}

/**
 * Wait for the toast and make sure no twin follows it. A modal dialog makes
 * the page outside it inert, so toasts shown over one cannot be clicked and
 * are left to hide on their own.
 */
async function expectOneToast(
  page: Page,
  text: string,
  { overDialog = false } = {},
): Promise<void> {
  const matching = toast(page, text);
  await expect(matching.first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(matching).toHaveCount(1);
  if (!overDialog) {
    await matching.getByRole("button", { name: "Fechar notificação" }).click();
  }
  await expect(matching).toHaveCount(0, { timeout: 9_000 });
}

async function expectNoToast(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  await expect(page.locator(TOASTS)).toHaveCount(0);
}

async function addPhotos(page: Page, count: number): Promise<void> {
  const photo = await samplePhoto(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Adicionar fotos" }).click();
  await (await chooser).setFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `foto-${i}.jpg`,
      mimeType: "image/jpeg",
      buffer: photo,
    })),
  );
}

/** Answer matching requests with a server error, letting everything else through. */
async function failWith500(
  page: Page,
  url: string,
  method: string,
): Promise<void> {
  await page.route(url, (route: Route) =>
    route.request().method() === method
      ? route.fulfill({ status: 500, body: "{}" })
      : route.fallback(),
  );
}

/** Best-effort cleanup after a serial chain that may have stopped midway. */
async function cleanUp(
  browser: Browser,
  steps: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await (await browser.newContext()).newPage();
  try {
    await signIn(page);
    await steps(page);
  } catch {
  } finally {
    await page.context().close();
  }
}

test.describe
  .serial("listing feedback", () => {
    let editUrl = "";

    test.afterAll(({ browser }) =>
      cleanUp(browser, async (page) => {
        await page
          .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
          .fill(TITLE);
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/admin\?q=/);
        await hydrated(page);
        const rows = listingRows(page);
        while ((await rows.count()) > 0) {
          await rows
            .first()
            .getByRole("button", { name: /^Excluir / })
            .click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Excluir anúncio" })
            .click();
          await expect(page.getByRole("alertdialog")).toBeHidden();
        }
      }),
    );

    test("saving a new draft toasts once on the edit page and the flash leaves the URL", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/admin/anuncios/novo");
      await hydrated(page);
      await page.getByLabel("Nome do item").fill(TITLE);
      await page.getByRole("button", { name: "Salvar rascunho" }).click();

      await expect(page).toHaveURL(/\/admin\/anuncios\/[0-9a-f-]{36}/);
      await expectOneToast(page, "Alterações salvas.");
      await expect(page).not.toHaveURL(/salvo=/);
      editUrl = page.url();

      await page.reload();
      await hydrated(page);
      await expectNoToast(page);
    });

    test("photos each toast once", async ({ page }) => {
      await signIn(page);
      await page.goto(editUrl);
      await hydrated(page);

      await addPhotos(page, 1);
      await expectOneToast(page, "Foto adicionada.");
      await addPhotos(page, 2);
      await expectOneToast(page, "2 fotos adicionadas.");

      await page
        .getByRole("button", { name: "Mover foto 1 para a direita" })
        .click();
      await expectOneToast(page, "Ordem atualizada.");
      await page.getByRole("button", { name: "Usar foto 2 como capa" }).click();
      await expectOneToast(page, "Capa atualizada.");
      await page.getByRole("button", { name: "Remover foto 3" }).click();
      await expectOneToast(page, "Foto removida.");
    });

    test("saving and publishing toasts once on the reloaded page and the flash leaves the URL", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto(editUrl);
      await hydrated(page);
      await page.getByRole("button", { name: "Salvar e publicar" }).click();

      await expectOneToast(page, "Anúncio publicado. Já aparece na loja.");
      await expect(page).not.toHaveURL(/salvo=/);
      await page.reload();
      await hydrated(page);
      await expectNoToast(page);
    });

    test("inline status changes toast once each", async ({ page }) => {
      await signIn(page);
      await page.goto("/admin");
      await hydrated(page);
      await page
        .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
        .fill(TITLE);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?q=/);
      await hydrated(page);

      await page
        .getByRole("combobox", { name: `Publicação de ${TITLE}` })
        .click();
      await page.getByRole("option", { name: "Rascunho" }).click();
      await expectOneToast(page, `"${TITLE}" agora está rascunho.`);

      await page
        .getByRole("combobox", { name: `Disponibilidade de ${TITLE}` })
        .click();
      await page.getByRole("option", { name: "Reservado" }).click();
      await expectOneToast(page, `"${TITLE}" marcado como reservado.`);
    });

    test("duplicating toasts once on the copy and the flash leaves the URL", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/admin");
      await hydrated(page);
      await page
        .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
        .fill(TITLE);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?q=/);
      await hydrated(page);
      await page.getByRole("button", { name: `Duplicar ${TITLE}` }).click();
      await page.getByRole("button", { name: "Duplicar anúncio" }).click();

      await expect(page).toHaveURL(/\/admin\/anuncios\/[0-9a-f-]{36}/);
      await expectOneToast(
        page,
        "Cópia criada como rascunho. Ajuste o que mudou e adicione as fotos.",
      );
      await expect(page).not.toHaveURL(/copiado=/);
      await page.reload();
      await hydrated(page);
      await expectNoToast(page);
    });

    test("a failed delete toasts one error and keeps the dialog open, then deleting moves focus to the heading", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/admin");
      await hydrated(page);
      await page
        .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
        .fill(TITLE);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/admin\?q=/);
      await hydrated(page);
      const rows = listingRows(page);
      await expect(rows).toHaveCount(2);

      await failWith500(page, "**/api/v1/stores/*/listings/*", "DELETE");
      await page
        .getByRole("button", { name: `Excluir ${TITLE}`, exact: true })
        .click();
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: "Excluir anúncio" }).click();
      await expectOneToast(page, GENERIC, { overDialog: true });
      await expect(dialog).toBeVisible();
      await expect(rows).toHaveCount(2);
      await page.unroute("**/api/v1/stores/*/listings/*");

      const url = page.url();
      await dialog.getByRole("button", { name: "Excluir anúncio" }).click();
      await expect(rows).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "Anúncios", level: 1 }),
      ).toBeFocused();
      await expectOneToast(page, `"${TITLE}" foi excluído.`);
      expect(page.url()).toBe(url);

      // Remove the remaining copy so the store ends as it began.
      await page
        .getByRole("button", { name: /^Excluir /, exact: false })
        .first()
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Excluir anúncio" })
        .click();
      await expect(rows).toHaveCount(0);
    });
  });

test.describe
  .serial("team feedback", () => {
    let link = "";

    test.afterAll(({ browser }) =>
      cleanUp(browser, async (page) => {
        await page.goto("/admin/equipe");
        await hydrated(page);
        const member = page.getByRole("row").filter({ hasText: MEMBER.email });
        if (await member.count()) {
          await member
            .getByRole("button", { name: `Ações para ${MEMBER.name}` })
            .click();
          await page.getByRole("menuitem", { name: "Remover" }).click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Remover da equipe" })
            .click();
          await expect(member).toHaveCount(0);
        }
        const invite = page.getByRole("row").filter({ hasText: REVOKED_EMAIL });
        if (await invite.count()) {
          await invite
            .getByRole("button", {
              name: `Ações para o convite de ${REVOKED_EMAIL}`,
            })
            .click();
          await page.getByRole("menuitem", { name: "Revogar" }).click();
          await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Revogar convite" })
            .click();
          await expect(invite).toHaveCount(0);
        }
      }),
    );

    test("creating an invite shows only the link dialog, no toast", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/admin/equipe");
      await hydrated(page);
      await page.getByRole("button", { name: "Convidar pessoas" }).click();
      const form = page.getByRole("dialog", { name: "Convidar pessoas" });
      await form.getByLabel("E-mail da pessoa").fill(MEMBER.email);
      await form.getByRole("button", { name: "Criar convite" }).click();
      const dialog = page.getByRole("dialog", {
        name: `Convite para ${MEMBER.email}`,
      });
      link = await dialog.getByLabel("Link do convite").inputValue();
      await expectNoToast(page);
      await dialog.getByRole("button", { name: "Pronto" }).click();
    });

    test("saving a member, uploading their photo and removing them each toast once without navigating", async ({
      page,
      browser,
    }) => {
      await acceptInvite(browser, link);
      await signIn(page);
      await page.goto("/admin/equipe");
      await hydrated(page);
      const url = page.url();
      const row = page.getByRole("row").filter({ hasText: MEMBER.email });
      const people = page.locator("#team-members");

      await row
        .getByRole("button", { name: `Ações para ${MEMBER.name}` })
        .click();
      await page.getByRole("menuitem", { name: "Editar" }).click();
      const dialog = page.getByRole("dialog", { name: MEMBER.name });
      const photo = await samplePhoto(page);
      await dialog.locator("input[type=file]").setInputFiles({
        name: "avatar.jpg",
        mimeType: "image/jpeg",
        buffer: photo,
      });
      await expectOneToast(page, "Foto atualizada.", { overDialog: true });
      await dialog.getByRole("button", { name: "Salvar alterações" }).click();
      await expectOneToast(page, "Alterações salvas.");
      await expect(dialog).toBeHidden();

      await failWith500(page, "**/api/v1/stores/*/members/*", "DELETE");
      const remove = async () => {
        await row
          .getByRole("button", { name: `Ações para ${MEMBER.name}` })
          .click();
        await page.getByRole("menuitem", { name: "Remover" }).click();
      };
      await remove();
      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { name: "Remover da equipe" }).click();
      await expectOneToast(page, GENERIC, { overDialog: true });
      await expect(confirm).toBeVisible();
      await page.unroute("**/api/v1/stores/*/members/*");

      await confirm.getByRole("button", { name: "Remover da equipe" }).click();
      await expect(row).toHaveCount(0);
      await expect(people).toBeFocused();
      await expectOneToast(page, `${MEMBER.name} saiu da equipe.`);
      expect(page.url()).toBe(url);
    });

    test("revoking an invite toasts once, fails with one error toast, and needs no navigation", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/admin/equipe");
      await hydrated(page);
      await page.getByRole("button", { name: "Convidar pessoas" }).click();
      const form = page.getByRole("dialog", { name: "Convidar pessoas" });
      await form.getByLabel("E-mail da pessoa").fill(REVOKED_EMAIL);
      await form.getByRole("button", { name: "Criar convite" }).click();
      await page
        .getByRole("dialog", { name: `Convite para ${REVOKED_EMAIL}` })
        .getByRole("button", { name: "Pronto" })
        .click();

      const url = page.url();
      const row = page.getByRole("row").filter({ hasText: REVOKED_EMAIL });
      const heading = page.locator("#team-invites");
      await expect(row).toBeVisible();
      const before = await heading.innerText();
      const menu = row.getByRole("button", {
        name: `Ações para o convite de ${REVOKED_EMAIL}`,
      });

      await menu.click();
      await page.getByRole("menuitem", { name: "Gerar novo link" }).click();
      const regenerated = page.getByRole("dialog", {
        name: `Convite para ${REVOKED_EMAIL}`,
      });
      await expect(regenerated).toBeVisible();
      await expectNoToast(page);
      await regenerated.getByRole("button", { name: "Pronto" }).click();
      await expect(regenerated).toBeHidden();

      await failWith500(page, "**/api/v1/stores/*/invites/*", "DELETE");
      await menu.click();
      await page.getByRole("menuitem", { name: "Revogar" }).click();
      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { name: "Revogar convite" }).click();
      await expectOneToast(page, GENERIC, { overDialog: true });
      await expect(confirm).toBeVisible();
      await page.unroute("**/api/v1/stores/*/invites/*");

      await confirm.getByRole("button", { name: "Revogar convite" }).click();
      await expect(row).toHaveCount(0);
      await expect(heading).not.toHaveText(before);
      await expect(heading).toBeFocused();
      await expectOneToast(page, "Convite revogado.");
      expect(page.url()).toBe(url);
    });
  });

async function acceptInvite(browser: Browser, link: string): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await hydrated(page);
  await page.getByLabel("Seu nome").fill(MEMBER.name);
  await page.getByLabel("Senha", { exact: true }).fill(MEMBER.password);
  await page.getByRole("button", { name: "Criar conta e entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await context.close();
}

test.describe("store settings feedback", () => {
  async function openStore(page: Page): Promise<void> {
    await signIn(page);
    await page.goto("/admin/loja");
    await hydrated(page);
  }
  const save = (page: Page) =>
    page.getByRole("button", { name: "Salvar loja" });

  test("saving the store toasts once", async ({ page }) => {
    await openStore(page);
    await save(page).click();
    await expectOneToast(page, "Loja atualizada.");
  });

  test("a request that never arrives shows the offline copy once", async ({
    page,
  }) => {
    await openStore(page);
    await page.route("**/api/v1/**", (route) => route.abort());
    await save(page).click();
    await expect(toast(page, OFFLINE).first()).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator(TOASTS)).toHaveCount(1);
    await expect(page.getByText(/failed to fetch|networkerror/i)).toHaveCount(
      0,
    );
  });

  test("a 401 on a write lands on the session-expired login", async ({
    page,
  }) => {
    await openStore(page);
    await page.context().clearCookies();
    await save(page).click();
    await expect(page).toHaveURL(/\/admin\/entrar\?erro=sessao-expirada$/);
    await expect(
      page.getByText("Sua sessão expirou. Entre de novo."),
    ).toBeVisible();
  });

  test("success toasts sit in a polite live region and errors in an assertive one", async ({
    page,
  }) => {
    await openStore(page);
    await save(page).click();
    const success = toast(page, "Loja atualizada.");
    await expect(success).toBeVisible();
    await expect(
      success.locator("xpath=ancestor::*[@aria-live][1]"),
    ).toHaveAttribute("aria-live", "polite");
    await success.getByRole("button", { name: "Fechar notificação" }).click();

    await failWith500(page, "**/api/v1/stores/*", "PATCH");
    await save(page).click();
    const alert = page.getByRole("alert").filter({ hasText: GENERIC });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  test("the dismiss button closes a toast", async ({ page }) => {
    await openStore(page);
    await save(page).click();
    const shown = toast(page, "Loja atualizada.");
    await expect(shown).toBeVisible();
    await shown.getByRole("button", { name: "Fechar notificação" }).click();
    await expect(shown).toHaveCount(0);
  });

  test("a toast hides on its own after about five seconds", async ({
    page,
  }) => {
    await openStore(page);
    await save(page).click();
    const shown = toast(page, "Loja atualizada.");
    await expect(shown).toBeVisible();
    const shownAt = Date.now();
    await page.mouse.move(0, 0);
    await expect(shown).toHaveCount(0, { timeout: 9_000 });
    const seconds = (Date.now() - shownAt) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(4);
    expect(seconds).toBeLessThanOrEqual(6.5);
  });
});
