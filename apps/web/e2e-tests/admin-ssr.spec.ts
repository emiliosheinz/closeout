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
  // Repeats until stable so a removal cannot join two fragments into a new tag.
  let html = await response.text();
  let previous: string;
  do {
    previous = html;
    html = html.replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, "");
  } while (html !== previous);
  return html;
}

test("admin pages carry their data in the first server response", async ({
  page,
}) => {
  await signIn(page);
  const firstListing = page
    .locator('a[href^="/admin/listings/"]:not([href$="/new"])')
    .first();
  const href = await firstListing.getAttribute("href");
  const title = (await firstListing.innerText()).trim();
  if (!href || !title) throw new Error("The demo store has no listings");
  const titleHtml = escapeHtml(title);

  expect(await documentWithoutScripts(page, "/admin")).toContain(titleHtml);

  expect(await documentWithoutScripts(page, "/admin/team")).toContain(
    "Ana Teste",
  );

  const store = await documentWithoutScripts(page, "/admin/store");
  expect(store).toMatch(/<input[^>]*value="Loja E2E"/);

  const newListing = await documentWithoutScripts(page, "/admin/listings/new");
  expect(newListing).toMatch(/<label[^>]*>Nome do item<\/label>/);
  expect(newListing).toMatch(/<input[^>]*id="title"/);
  expect(newListing).toMatch(
    /<label[^>]*for="category"[^>]*>Categoria<\/label>[\s\S]*?<button(?=[^>]*role="combobox")(?=[^>]*id="category")/,
  );

  const edit = await documentWithoutScripts(page, href);
  expect(edit).toMatch(
    new RegExp(
      `<input[^>]*value="${titleHtml.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ),
  );

  expect(await documentWithoutScripts(page, `${href}/preview`)).toContain(
    titleHtml,
  );
});
