import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, BASE_URL, hydrated, STORE, signIn } from "./helpers";

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
  await expect(
    page.getByText(`${BASE_URL}${STORE}`, { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Chamada principal")
    .fill("Tudo precisa sair até sexta");
  await page.getByRole("button", { name: "Salvar loja" }).click();
  await expect(page.getByText("Loja atualizada.")).toBeVisible();
  await page.goto(STORE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tudo precisa sair até sexta",
  );
});

test("an expired session sends the member to login with an explanation", async ({
  page,
}) => {
  await page.clock.install();
  await signIn(page);
  await page.context().clearCookies();

  // The session query is stale after a minute; coming back to the tab refetches it.
  await page.clock.fastForward(61_000);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );

  await expect(page).toHaveURL(/\/admin\/entrar\?erro=sessao-expirada$/);
  await expect(
    page.getByText("Sua sessão expirou. Entre de novo."),
  ).toBeVisible();
});

test("only the admin panel has a toast container", async ({ page }) => {
  const toaster = page.getByRole("region", { name: /Notificações/ });

  await page.goto(STORE);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(toaster).toHaveCount(0);

  await page.goto("/invite/not-a-real-token");
  await expect(toaster).toHaveCount(0);

  await page.goto("/admin/entrar");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(toaster).toHaveCount(0);

  await signIn(page);
  await expect(toaster).toHaveCount(1);
});
