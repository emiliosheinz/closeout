import type { Me } from "@closeout/contracts/schemas";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AdminNav } from "@/_app/admin-panel/admin-nav";
import { sessionKeys } from "@/entities/session";
import { StoreSettingsForm } from "@/features/edit-store";
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
      "/admin/team",
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

  it("shows the new store name after the store settings are saved", async () => {
    let me = meAs("owner", "Brechó da Bia");
    const { store } = me.memberships[0] as Me["memberships"][number];
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          const { name } = JSON.parse(init.body as string) as { name: string };
          me = meAs("owner", name);
          return new Response(null, { status: 204 });
        }
        return Response.json(me);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const seed = new QueryClient();
    seed.setQueryData(sessionKeys.me(), me);
    renderWithFeedback(
      <>
        <AdminNav />
        <StoreSettingsForm
          store={store}
          storeUrl="https://closeout.test/loja"
        />
      </>,
      dehydrate(seed),
    );
    expect(screen.getByRole("link", { name: "Brechó da Bia" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Nome da loja"), {
      target: { value: "Bia Vintage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar loja" }));

    expect(
      await screen.findByRole("link", { name: "Bia Vintage" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Brechó da Bia" })).toBeNull();
    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toContain(
        "PATCH",
      ),
    );
    vi.unstubAllGlobals();
  });
});
