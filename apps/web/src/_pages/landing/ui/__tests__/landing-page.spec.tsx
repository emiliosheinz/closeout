import { render, screen } from "@testing-library/react";
import { LandingPage } from "../landing-page";

describe("landing page", () => {
  it("offers the waitlist next to the login link", () => {
    render(<LandingPage />);
    const login = screen.getByRole("link", {
      name: "Entrar para gerenciar sua loja",
    });
    const waitlist = screen.getByRole("link", {
      name: "Quero vender meus desapegos",
    });
    expect(waitlist).toHaveAttribute("href", "/waitlist?src=landing");
    expect(login).toHaveAttribute("href", "/admin/login");
    expect(waitlist.parentElement).toBe(login.parentElement);
  });
});
