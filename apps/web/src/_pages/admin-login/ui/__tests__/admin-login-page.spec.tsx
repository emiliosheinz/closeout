import { render, screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { LoginPage } from "../admin-login-page";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

beforeEach(() => {
  stubAdminApi({ "/me": 401 });
});

const renderPage = async (error?: string) =>
  render(await LoginPage({ searchParams: Promise.resolve({ error }) }));

describe("login page", () => {
  it("explains an expired session", async () => {
    await renderPage("session-expired");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sua sessão expirou. Entre de novo.",
    );
  });

  it("explains a missing store membership", async () => {
    await renderPage("no-access");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta conta não administra esta loja.",
    );
  });

  it("shows no notice by default", async () => {
    await renderPage();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("points people without a store to the waitlist", async () => {
    await renderPage();
    expect(screen.getByText(/Ainda não tem uma loja\?/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entre na lista de espera" }),
    ).toHaveAttribute("href", "/waitlist?src=login");
  });
});
