import { act, render, screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { dismissToasts } from "@/test/feedback-harness";
import { LoginPage } from "../admin-login-page";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

beforeEach(() => {
  stubAdminApi({ "/me": 401 });
});

afterEach(dismissToasts);

const renderPage = async (error?: string) =>
  render(await LoginPage({ searchParams: Promise.resolve({ error }) }));

describe("login page", () => {
  it("explains an expired session", async () => {
    await renderPage("session-expired");
    expect(
      await screen.findByText("Sua sessão expirou. Entre de novo."),
    ).toBeInTheDocument();
  });

  it("explains a missing store membership", async () => {
    await renderPage("no-access");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta conta não administra esta loja.",
    );
  });

  it("shows no notice by default", async () => {
    await renderPage();
    await act(async () => {});
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("points people without a store to the waitlist", async () => {
    await renderPage();
    expect(screen.getByText(/Ainda não tem uma loja\?/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entre na lista de espera" }),
    ).toHaveAttribute("href", "/waitlist?src=login");
  });
});
