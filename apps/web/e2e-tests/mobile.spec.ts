import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  hydrated,
  listingRows,
  STORE,
  seedTablesStore,
  signIn,
  TABLES_OWNER_EMAIL,
} from "./helpers";

test("the WhatsApp action is visible without scrolling on a phone", async ({
  page,
}) => {
  await page.goto(`${STORE}?q=bicicleta`);
  await page.getByRole("link", { name: "Bicicleta aro 29" }).click();
  await expect(page.getByTestId("whatsapp-contact").last()).toBeInViewport();
});

test("filters open in a bottom sheet and apply through the URL", async ({
  page,
}) => {
  await page.goto(STORE);
  await hydrated(page);
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrar itens" });
  await expect(sheet).toBeVisible();
  await sheet.getByText("Como novo").click();
  await sheet.getByText("Menor preço").click();
  await sheet.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/estado=como-novo/);
  await expect(page).toHaveURL(/ordem=menor-preco/);
  await expect(page.getByRole("button", { name: /^Filtros/ })).toContainText(
    "1",
  );
});

test("the catalog never scrolls sideways", async ({ page }) => {
  await page.goto(STORE);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("sharing without a share sheet or clipboard offers the link to copy", async ({
  page,
}) => {
  // The e2e origin is plain http, where browsers expose no clipboard: the
  // button must fall back to showing the link.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await page.goto(`${STORE}?q=bicicleta`);
  await page.getByRole("link", { name: "Bicicleta aro 29" }).click();
  await hydrated(page);
  // window.prompt blocks the page, so answer it from a handler registered
  // before the click.
  const shown = new Promise<{ message: string; value: string }>((resolve) => {
    page.once("dialog", async (dialog) => {
      resolve({ message: dialog.message(), value: dialog.defaultValue() });
      await dialog.dismiss();
    });
  });
  await page.getByRole("button", { name: "Compartilhar" }).click();
  expect(await shown).toEqual({
    message: "Copie o link do item:",
    value: page.url(),
  });
});

async function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/**
 * The control sits inside the phone's width and Playwright can click it
 * without the page scrolling sideways. `trial` stops short of the click, for
 * controls whose click leaves the page or changes data.
 */
async function expectTappable(
  page: Page,
  control: Locator,
  { trial = false } = {},
): Promise<void> {
  // Measured before any scrolling: a table wider than the phone scrolls inside
  // its own wrapper, and scrolling it into view would hide that.
  const box = await control.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("Control has no box on screen");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  // Taken first: an opened menu or select hides the control from role queries.
  const handle = await control.elementHandle();
  await control.click({ trial });
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const clipped = await handle?.evaluate((element) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth || node.scrollLeft !== 0) {
        return `${node.tagName}.${node.className}`;
      }
    }
    return null;
  });
  expect(clipped, "an ancestor scrolls sideways").toBeNull();
  await handle?.dispose();
}

/** Next, then back, so the table ends where it started. */
async function expectPaginationTappable(
  page: Page,
  scope: Page | Locator,
): Promise<void> {
  const next = scope.getByRole("button", { name: "Próxima página" });
  const previous = scope.getByRole("button", { name: "Página anterior" });
  await expectTappable(page, next);
  await expect(next).toBeDisabled();
  await expectTappable(page, previous);
  await expect(previous).toBeDisabled();
}

test.describe("admin tables on a phone", () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    await seedTablesStore();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
  });

  test("neither the listings nor the team page scrolls sideways", async ({
    page,
  }) => {
    await page.goto("/admin");
    await hydrated(page);
    await expect(listingRows(page).first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.goto("/admin/equipe");
    await hydrated(page);
    for (const name of [/pessoas/, /Convites pendentes/]) {
      await expect(
        page
          .getByRole("region", { name })
          .locator("tbody")
          .getByRole("row")
          .first(),
      ).toBeVisible();
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // A table wider than the phone scrolls inside its wrapper, unseen above.
    const wrappers = await page.locator("table").evaluateAll((tables) =>
      tables.map((t) => {
        const wrapper = t.parentElement as HTMLElement;
        return wrapper.scrollWidth - wrapper.clientWidth;
      }),
    );
    expect(wrappers).toHaveLength(2);
    expect(Math.max(...wrappers)).toBeLessThanOrEqual(0);
  });

  test("every listing control can be tapped without scrolling sideways", async ({
    page,
  }) => {
    await page.goto("/admin");
    await hydrated(page);
    for (const name of [/^Editar /, /^Duplicar /, /^Excluir /]) {
      await expectTappable(
        page,
        page
          .getByRole("button", { name })
          .or(page.getByRole("link", { name }))
          .first(),
        { trial: true },
      );
    }
    for (const name of [/^Publicação de /, /^Disponibilidade de /]) {
      const select = page.getByRole("combobox", { name }).first();
      await expectTappable(page, select);
      await expect(page.getByRole("option").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("option")).toHaveCount(0);
    }

    await page.goto("/admin?status=publicados");
    await hydrated(page);
    await expectTappable(
      page,
      page.getByRole("link", { name: /^Ver .* na loja$/ }).first(),
      { trial: true },
    );
    await page.goto("/admin?status=rascunhos");
    await hydrated(page);
    await expectTappable(
      page,
      page.getByRole("link", { name: /^Pré-visualizar / }).first(),
      { trial: true },
    );

    await page.goto("/admin");
    await hydrated(page);
    for (const name of ["Título", "Preço", "Atualizado"]) {
      await expectTappable(
        page,
        page.getByRole("button", { name, exact: true }),
      );
    }
    await page.goto("/admin");
    await hydrated(page);
    await expectPaginationTappable(page, page);
  });

  test("every team control can be tapped without scrolling sideways", async ({
    page,
  }) => {
    await page.goto("/admin/equipe");
    await hydrated(page);
    const members = page.getByRole("region", { name: /pessoas/ });
    const invites = page.getByRole("region", { name: /Convites pendentes/ });

    for (const [region, menu] of [
      [members, /^Ações para (?!o convite)/],
      [invites, /^Ações para o convite de /],
    ] as const) {
      await expectTappable(
        page,
        region.getByRole("button", { name: menu }).first(),
      );
      await expect(page.getByRole("menuitem").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menuitem")).toHaveCount(0);
    }

    for (const [region, sorts] of [
      [members, ["Nome", "Papel"]],
      [invites, ["Validade"]],
    ] as const) {
      for (const name of sorts) {
        await expectTappable(
          page,
          region.getByRole("button", { name, exact: true }),
        );
      }
    }
    await page.goto("/admin/equipe");
    await hydrated(page);
    await expectPaginationTappable(page, members);
    await expectPaginationTappable(page, invites);
  });
});
