import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  apiAs,
  hydrated,
  listingRows,
  restoreDraft,
  seedTablesStore,
  signIn,
  TABLES_OWNER_EMAIL,
  TABLES_SEED,
  TABLES_SELLER,
} from "./helpers";

/** The first titles in pt-BR order: "Árvore" sorts with the As, "Café" after "Cadeira". */
const FIRST_TITLES = [
  "Abajur antigo",
  "Árvore de Natal",
  "Banco de jardim",
  "Bicicleta aro 26",
  "Cadeira arquivada 1",
  "Cadeira arquivada 2",
  "Cadeira arquivada 3",
  "Café expresso",
];
const LAST_TITLES_DESC = [
  "Zebra de pelúcia",
  "Ventilador de mesa",
  "Rascunho 12",
];
const PAGE_SIZE = 20;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  await seedTablesStore();
});

/** Titles of the listing rows on screen, in order. */
function rowTitles(page: Page): Promise<string[]> {
  return listingRows(page).evaluateAll((rows) =>
    rows.map((row) => row.querySelector("a")?.textContent ?? ""),
  );
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await hydrated(page);
}

async function count(page: Page, testId: string): Promise<number> {
  return Number(await page.getByTestId(testId).innerText());
}

test.describe
  .serial("admin tables on a store with more than a page of everything", () => {
    test("the listings table pages at 20 and its buttons stop at the ends", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto("/admin");
      await hydrated(page);
      const previous = page.getByRole("button", { name: "Página anterior" });
      const next = page.getByRole("button", { name: "Próxima página" });
      await expect(listingRows(page)).toHaveCount(PAGE_SIZE);
      await expect(page.getByText("Página 1 de 2")).toBeVisible();
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();

      await next.click();
      await expect(page).toHaveURL(/pagina=2/);
      await expect(page.getByText("Página 2 de 2")).toBeVisible();
      await expect(listingRows(page)).toHaveCount(
        TABLES_SEED.listings - PAGE_SIZE,
      );
      await expect(next).toBeDisabled();
      await expect(previous).toBeEnabled();

      await previous.click();
      await expect(page).not.toHaveURL(/pagina=/);
      await expect(listingRows(page)).toHaveCount(PAGE_SIZE);
    });

    test("sorting by title uses pt-BR order, lives in the URL and survives a reload", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto("/admin");
      await hydrated(page);
      const header = page.getByRole("columnheader", { name: "Título" });
      await page.getByRole("button", { name: "Título", exact: true }).click();
      await expect(page).toHaveURL(/ordem=titulo-asc/);
      await expect(header).toHaveAttribute("aria-sort", "ascending");
      await expect
        .poll(async () => (await rowTitles(page)).slice(0, FIRST_TITLES.length))
        .toEqual(FIRST_TITLES);
      expect(await rowTitles(page)).toHaveLength(PAGE_SIZE);

      await page.getByRole("button", { name: "Título", exact: true }).click();
      await expect(page).toHaveURL(/ordem=titulo-desc/);
      await expect
        .poll(async () => (await rowTitles(page)).slice(0, 3))
        .toEqual(LAST_TITLES_DESC);

      await page.getByRole("button", { name: "Título", exact: true }).click();
      await page.getByRole("button", { name: "Próxima página" }).click();
      await expect(page).toHaveURL(/ordem=titulo-asc/);
      await expect(page).toHaveURL(/pagina=2/);
      const last = async () => (await rowTitles(page)).at(-1);
      await expect.poll(last).toBe("Zebra de pelúcia");
      await expect(listingRows(page)).toHaveCount(
        TABLES_SEED.listings - PAGE_SIZE,
      );

      await reload(page);
      await expect(page).toHaveURL(/ordem=titulo-asc/);
      await expect(page).toHaveURL(/pagina=2/);
      await expect(page.getByText("Página 2 de 2")).toBeVisible();
      await expect.poll(last).toBe("Zebra de pelúcia");
      await expect(listingRows(page)).toHaveCount(
        TABLES_SEED.listings - PAGE_SIZE,
      );
    });

    test("changing the sort, search or tab returns the listings table to page 1", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      const onPage2 = async () => {
        await page.goto("/admin?pagina=2");
        await hydrated(page);
        await expect(page.getByText("Página 2 de 2")).toBeVisible();
      };

      await onPage2();
      await page.getByRole("button", { name: "Título", exact: true }).click();
      await expect(page).toHaveURL(/ordem=titulo-asc/);
      await expect(page).not.toHaveURL(/pagina=/);
      await expect(page.getByText("Página 1 de 2")).toBeVisible();
      await expect
        .poll(async () => (await rowTitles(page)).slice(0, 3))
        .toEqual(FIRST_TITLES.slice(0, 3));

      await onPage2();
      await page.getByRole("button", { name: /^Rascunhos/ }).click();
      await expect(page).toHaveURL(/status=rascunhos/);
      await expect(page).not.toHaveURL(/pagina=/);

      await onPage2();
      await page
        .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
        .fill("a");
      await expect(page).toHaveURL(/q=a/);
      await expect(page).not.toHaveURL(/pagina=/);
      await expect(page.getByText("Página 1 de 2")).toBeVisible();
    });

    test("old status and search links show the same rows as before", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto("/admin?status=reservados&q=cafe");
      await hydrated(page);
      await expect.poll(() => rowTitles(page)).toEqual(["Café expresso"]);
      await expect(
        page.getByRole("searchbox", { name: "Buscar anúncios pelo título" }),
      ).toHaveValue("cafe");

      await page.goto("/admin?status=publicados");
      await hydrated(page);
      await expect(listingRows(page)).toHaveCount(TABLES_SEED.counts.published);
      await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);

      await page.goto("/admin?status=rascunhos&q=vera");
      await hydrated(page);
      await expect
        .poll(async () => (await rowTitles(page)).sort())
        .toEqual([...TABLES_SEED.sellerListings].sort());
    });

    test("members and invites keep their own page, sort and search", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto(
        "/admin/equipe?convites-pagina=2&convites-ordem=validade-desc",
      );
      await hydrated(page);
      const members = page.getByRole("region", { name: "Membros" });
      const invites = page.getByRole("region", { name: /Convites pendentes/ });
      const inviteRows = invites.locator("tbody").getByRole("row");
      const memberRows = members.locator("tbody").getByRole("row");
      await expect(inviteRows).toHaveCount(TABLES_SEED.invites - PAGE_SIZE);
      await expect(memberRows).toHaveCount(PAGE_SIZE);
      const invitesBefore = await inviteRows.allInnerTexts();

      await members.getByRole("button", { name: "Próxima página" }).click();
      await expect(page).toHaveURL(/membros-pagina=2/);
      await expect(memberRows).toHaveCount(TABLES_SEED.members - PAGE_SIZE);

      await members.getByRole("button", { name: "Nome", exact: true }).click();
      await expect(page).toHaveURL(/membros-ordem=nome-asc/);
      await expect(page).not.toHaveURL(/membros-pagina=/);

      await members
        .getByRole("searchbox", { name: "Buscar membros" })
        .fill("jose");
      await expect(page).toHaveURL(/membros-q=jose/);
      await expect(memberRows).toHaveCount(1);
      await expect(memberRows).toContainText("José Álvares");

      await expect(page).toHaveURL(/convites-pagina=2/);
      await expect(page).toHaveURL(/convites-ordem=validade-desc/);
      expect(await inviteRows.allInnerTexts()).toEqual(invitesBefore);

      await reload(page);
      await expect(memberRows).toHaveCount(1);
      await expect(inviteRows).toHaveCount(TABLES_SEED.invites - PAGE_SIZE);
    });

    test("invites keep their own state when the members table is left alone", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto("/admin/equipe?membros-pagina=2&membros-ordem=nome-desc");
      await hydrated(page);
      const members = page.getByRole("region", { name: "Membros" });
      const invites = page.getByRole("region", { name: /Convites pendentes/ });
      const memberRows = members.locator("tbody").getByRole("row");
      await expect(memberRows).toHaveCount(TABLES_SEED.members - PAGE_SIZE);
      const membersBefore = await memberRows.allInnerTexts();

      await invites
        .getByRole("button", { name: "Validade", exact: true })
        .click();
      await expect(page).toHaveURL(/convites-ordem=validade-desc/);
      await invites.getByRole("button", { name: "Próxima página" }).click();
      await expect(page).toHaveURL(/convites-pagina=2/);
      await invites
        .getByRole("searchbox", { name: "Buscar convites" })
        .fill("convite-0");
      await expect(page).toHaveURL(/convites-q=convite-0/);

      await expect(page).toHaveURL(/membros-pagina=2/);
      await expect(page).toHaveURL(/membros-ordem=nome-desc/);
      await expect(page).not.toHaveURL(/membros-q=/);
      expect(await memberRows.allInnerTexts()).toEqual(membersBefore);
    });

    test("a seller sees only their own row on Equipe, with no table controls", async ({
      page,
    }) => {
      await signIn(page, TABLES_SELLER.email, TABLES_SELLER.password);
      await page.goto("/admin/equipe");
      await hydrated(page);
      const rows = page.locator("tbody").getByRole("row");
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(TABLES_SELLER.name);
      await expect(page.getByRole("searchbox")).toHaveCount(0);
      await expect(page.locator("thead button")).toHaveCount(0);
      await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /^(Página anterior|Próxima página)$/,
        }),
      ).toHaveCount(0);

      await page
        .getByRole("button", { name: `Ações para ${TABLES_SELLER.name}` })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Editar" }),
      ).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Remover" })).toHaveCount(
        0,
      );
    });

    test("a seller's listings table has the manager's controls over what the API returns", async ({
      page,
    }) => {
      const storeId = await seedTablesStore();
      const api = await apiAs(TABLES_SELLER.email, TABLES_SELLER.password);
      const { items } = (await (
        await api.get(`/api/v1/stores/${storeId}/listings`)
      ).json()) as { items: { title: string }[] };
      await api.dispose();
      const returned = items.map((item) => item.title);
      expect([...returned].sort()).toEqual(
        [...TABLES_SEED.sellerListings].sort(),
      );

      await signIn(page, TABLES_SELLER.email, TABLES_SELLER.password);
      await page.goto("/admin");
      await hydrated(page);
      await expect(listingRows(page)).toHaveCount(
        Math.min(returned.length, PAGE_SIZE),
      );
      await expect(
        page.getByRole("searchbox", { name: "Buscar anúncios pelo título" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Todos/ })).toContainText(
        String(returned.length),
      );
      for (const name of ["Título", "Preço", "Atualizado"]) {
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      }
      await page.getByRole("button", { name: "Título", exact: true }).click();
      await expect(page).toHaveURL(/ordem=titulo-asc/);
      await expect
        .poll(() => rowTitles(page))
        .toEqual(["Peça da Vera 1", "Peça da Vera 2", "Peça da Vera 3"]);
    });

    // Later files seed against the full store, so give the listing back.
    test.afterAll(() => restoreDraft("Rascunho 12"));

    test("deleting a listing moves the tab counts it belonged to", async ({
      page,
    }) => {
      await signIn(page, TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
      await page.goto(`/admin?q=${encodeURIComponent("Rascunho 12")}`);
      await hydrated(page);
      const all = page.getByRole("button", { name: /^Todos/ });
      await expect(all).toContainText(String(TABLES_SEED.listings));
      const before = {
        published: await count(page, "count-published"),
        available: await count(page, "count-available"),
        reserved: await count(page, "count-reserved"),
        sold: await count(page, "count-sold"),
        draft: await count(page, "count-draft"),
        archived: await count(page, "count-archived"),
      };
      expect(before).toEqual(TABLES_SEED.counts);

      await expect.poll(() => rowTitles(page)).toEqual(["Rascunho 12"]);
      await page.getByRole("button", { name: "Excluir Rascunho 12" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Excluir anúncio" })
        .click();
      await expect(listingRows(page)).toHaveCount(0);

      await expect(all).toContainText(String(TABLES_SEED.listings - 1));
      await expect(page.getByTestId("count-draft")).toHaveText(
        String(before.draft - 1),
      );
      for (const key of [
        "published",
        "available",
        "reserved",
        "sold",
        "archived",
      ] as const) {
        await expect(page.getByTestId(`count-${key}`)).toHaveText(
          String(before[key]),
        );
      }
    });
  });
