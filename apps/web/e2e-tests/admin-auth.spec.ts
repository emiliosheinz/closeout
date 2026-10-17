import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, hydrated, signIn } from "./helpers";

test("a wrong password gets one generic message", async ({ page }) => {
  await page.goto("/admin/entrar");
  await hydrated(page);
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill("definitely-wrong");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
});

test("the session cookie is HttpOnly and SameSite=Lax, and sign-out ends it", async ({
  page,
  context,
}) => {
  await signIn(page);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "closeout_session",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  if (!cookie) throw new Error("No session cookie");

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/admin\/entrar$/);
  expect(
    (await context.cookies()).find((c) => c.name === "closeout_session"),
  ).toBeUndefined();

  // The old token was revoked on the server, not just dropped by the browser.
  await context.addCookies([cookie]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/entrar$/);
});

test("logins from another site are refused", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" },
    data: { email: ADMIN_EMAIL, password: "x" },
  });
  expect(response.status()).toBe(403);
});

test("an admin edits the store identity and the storefront shows it", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation", { name: "Administração" })
    .getByRole("link", { name: "Loja", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/loja$/);
  await hydrated(page);
  await page
    .getByLabel("Chamada principal")
    .fill("Tudo precisa sair até sexta");
  await page.getByRole("button", { name: "Salvar loja" }).click();
  await expect(page.getByText("Loja atualizada.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tudo precisa sair até sexta",
  );
});
