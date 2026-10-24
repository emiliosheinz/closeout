import type { Me } from "@closeout/contracts/schemas";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { act, screen, within } from "@testing-library/react";
import { AdminNav } from "@/_app/admin-panel/admin-nav";
import { sessionKeys } from "@/entities/session";
import { renderWithFeedback } from "@/test/feedback-harness";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const meAs = (role: "owner" | "admin" | "seller", storeName = "Loja"): Me => ({
  user: { id: "u1", name: "Bia", email: "bia@loja.test" },
  memberships: [
    {
      role,
      sellerId: "s1",
      store: {
        id: "st1",
        slug: "loja",
        name: storeName,
        headline: "",
        intro: "",
        locale: "pt-BR",
        currency: "BRL",
      },
    },
  ],
});

function renderNav(me: Me) {
  const seed = new QueryClient();
  seed.setQueryData(sessionKeys.me(), me);
  return renderWithFeedback(<AdminNav />, dehydrate(seed));
}

const linkNames = () =>
  within(screen.getByRole("navigation", { name: "Administração" }))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("AdminNav", () => {
  it("shows a seller listings and team, without the store settings", () => {
    renderNav(meAs("seller"));
    expect(linkNames()).toEqual(["Anúncios", "Equipe"]);
  });

  it("shows owners and admins the store settings too", () => {
    renderNav(meAs("admin"));
    expect(linkNames()).toEqual(["Anúncios", "Equipe", "Loja"]);
    expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute(
      "href",
      "/admin/equipe",
    );
  });

  it("reads the store name from the cache and follows it when it changes", async () => {
    const { client } = renderNav(meAs("owner", "Brechó da Bia"));
    expect(screen.getByRole("link", { name: "Brechó da Bia" })).toHaveAttribute(
      "href",
      "/admin",
    );

    act(() => {
      client.setQueryData(sessionKeys.me(), meAs("owner", "Bia Vintage"));
    });

    expect(
      await screen.findByRole("link", { name: "Bia Vintage" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Brechó da Bia" })).toBeNull();
  });

  it("links to the public store from its slug", () => {
    renderNav(meAs("owner"));
    expect(screen.getByRole("link", { name: /Ver loja/ })).toHaveAttribute(
      "href",
      "/store/loja",
    );
  });
});
