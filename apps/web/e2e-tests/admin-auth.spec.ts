import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  hydrated,
  STORE,
  signIn,
} from "./helpers";

test("a member signs in after a wrong password, gets a locked-down session cookie, and signing out revokes it", async ({
  page,
  context,
}) => {
  await test.step("a wrong password gets one generic message", async () => {
    await page.goto("/admin/entrar");
    await hydrated(page);
    await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill("definitely-wrong");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  });

  await test.step("the right password signs in", async () => {
    await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(
      page.getByRole("heading", { name: "Anúncios", level: 1 }),
    ).toBeVisible();
    await hydrated(page);
  });

  const cookie = (await context.cookies()).find(
    (c) => c.name === "closeout_session",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  if (!cookie) throw new Error("No session cookie");

  await test.step("signing out drops the cookie", async () => {
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/admin\/entrar$/);
    expect(
      (await context.cookies()).find((c) => c.name === "closeout_session"),
    ).toBeUndefined();
  });

  await test.step("the old token was revoked on the server", async () => {
    await context.addCookies([cookie]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/entrar$/);
  });
});

test("a write after the session is gone lands on the session-expired login", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/loja");
  await hydrated(page);
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Salvar loja" }).click();
  await expect(page).toHaveURL(/\/admin\/entrar\?erro=sessao-expirada$/);
  await expect(
    page.getByText("Sua sessão expirou. Entre de novo."),
  ).toBeVisible();
});

test("sign-in and sign-out refuse requests from other sites without touching cookies", async ({
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" },
    data: { email: ADMIN_EMAIL, password: "x" },
  });
  expect(login.status()).toBe(403);
  expect(login.headers()["set-cookie"]).toBeUndefined();

  const logout = await request.post("/api/auth/logout", {
    headers: { Origin: "https://evil.example" },
  });
  expect(logout.status()).toBe(403);
  expect(logout.headers()["set-cookie"]).toBeUndefined();
});

test("an admin renames the store and changes its headline, and the storefront shows both", async ({
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
  const headline = await page.getByLabel("Chamada principal").inputValue();

  await test.step("the admin saves a new name and headline", async () => {
    await page.getByLabel("Nome da loja").fill("Bazar da Mudança");
    await page
      .getByLabel("Chamada principal")
      .fill("Tudo precisa sair até sexta");
    await page.getByRole("button", { name: "Salvar loja" }).click();
    await expect(page.getByText("Loja atualizada.")).toBeVisible();
  });

  await test.step("the storefront shows them", async () => {
    await page.goto(STORE);
    await expect(page).toHaveTitle("Bazar da Mudança");
    await expect(page.locator("header").first()).toContainText(
      "Bazar da Mudança",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Tudo precisa sair até sexta",
    );
  });

  await test.step("restore the fixture the other journeys expect", async () => {
    await page.goto("/admin/loja");
    await hydrated(page);
    await page.getByLabel("Nome da loja").fill("Loja E2E");
    await page.getByLabel("Chamada principal").fill(headline);
    await page.getByRole("button", { name: "Salvar loja" }).click();
    await expect(page.getByText("Loja atualizada.")).toBeVisible();
  });
});
