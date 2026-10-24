import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./helpers";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

/** The server's HTML with scripts removed: what a visitor without JavaScript gets, minus the data the framework ships for hydration. */
async function documentWithoutScripts(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return (await response.text()).replace(/<script[\s\S]*?<\/script>/g, "");
}

test("admin pages carry their data in the first server response", async ({
  page,
}) => {
  await signIn(page);
  const firstListing = page
    .locator('a[href^="/admin/anuncios/"]:not([href$="/novo"])')
    .first();
  const href = await firstListing.getAttribute("href");
  const title = (await firstListing.innerText()).trim();
  if (!href || !title) throw new Error("The demo store has no listings");
  const titleHtml = escapeHtml(title);

  expect(await documentWithoutScripts(page, "/admin")).toContain(titleHtml);

  expect(await documentWithoutScripts(page, "/admin/equipe")).toContain(
    "Ana Teste",
  );

  const store = await documentWithoutScripts(page, "/admin/loja");
  expect(store).toMatch(/<input[^>]*value="Loja E2E"/);

  const newListing = await documentWithoutScripts(page, "/admin/anuncios/novo");
  expect(newListing).toMatch(/<label[^>]*>Nome do item<\/label>/);
  expect(newListing).toMatch(/<input[^>]*id="title"/);
  expect(newListing).toMatch(/<button[^>]*role="combobox"[^>]*/);
  expect(newListing).toContain("Categoria");

  const edit = await documentWithoutScripts(page, href);
  expect(edit).toMatch(
    new RegExp(
      `<input[^>]*value="${titleHtml.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ),
  );

  expect(await documentWithoutScripts(page, `${href}/previa`)).toContain(
    titleHtml,
  );
});
