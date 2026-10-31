import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { PanelLayout } from "@/_app/admin-panel/panel-layout";
import { getQueryClient } from "@/shared/api";
import { stubAdminApi } from "@/test/admin-api";
import { meResponse, STORE } from "@/test/fixtures";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  usePathname: () => "/admin",
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const renderAs = async (role: "owner" | "admin" | "seller") => {
  stubAdminApi({ "/me": meResponse(role) });
  render(await PanelLayout({ children: <p>conteúdo</p> }));
};

describe("panel layout", () => {
  it.each([
    "owner",
    "admin",
  ] as const)("shows %s the Loja link", async (role) => {
    await renderAs(role);
    expect(screen.getByRole("link", { name: "Loja" })).toBeInTheDocument();
  });

  it("hides the Loja link from a seller", async () => {
    await renderAs("seller");
    expect(screen.queryByRole("link", { name: "Loja" })).toBeNull();
    expect(screen.getByRole("link", { name: "Equipe" })).toBeInTheDocument();
  });

  it("names the store in the nav and renders the page and the toaster", async () => {
    await renderAs("owner");
    expect(screen.getByRole("link", { name: STORE.name })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Notificações/ }),
    ).toBeInTheDocument();
  });

  it("sends a visitor without a session to login", async () => {
    stubAdminApi({ "/me": 401 });
    await expect(
      PanelLayout({ children: <p>conteúdo</p> }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login"),
    });
  });

  it("hands the browser only the session, not other data the request loaded", async () => {
    stubAdminApi({ "/me": meResponse("owner") });
    getQueryClient().setQueryData(["listings"], [{ id: "l-1" }]);
    const Probe = () => {
      const client = useQueryClient();
      return (
        <p>
          {client.getQueryData(["listings"]) === undefined
            ? "sem listagens"
            : "com listagens"}
        </p>
      );
    };
    render(await PanelLayout({ children: <Probe /> }));
    expect(screen.getByText("sem listagens")).toBeInTheDocument();
  });
});
