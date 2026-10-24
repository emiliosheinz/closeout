import { screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { meResponse, seller } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { TeamPage } from "../admin-team-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const asMember = (role: "owner" | "seller") => ({
  "/me": meResponse(
    role,
    { id: "u-caio", name: "Caio", email: "caio@loja.test" },
    "s-caio",
  ),
});

describe("team page", () => {
  it("gives a seller only their own row, from the sellers list", async () => {
    const calls = stubAdminApi({
      ...asMember("seller"),
      "/stores/store-1/sellers": {
        items: [seller("s-ana", "Ana"), seller("s-caio", "Caio Vendedor")],
      },
    });
    renderPage(await TeamPage());
    expect(calls).toEqual(["/me", "/stores/store-1/sellers"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Caio Vendedor")).toBeInTheDocument();
    expect(screen.getByText("caio@loja.test")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Convidar pessoas" }),
    ).toBeNull();
  });

  it("shows a seller no row when their profile is not in the list", async () => {
    stubAdminApi({
      ...asMember("seller"),
      "/stores/store-1/sellers": { items: [seller("s-ana", "Ana")] },
    });
    renderPage(await TeamPage());
    expect(screen.queryAllByRole("listitem")).toEqual([]);
  });

  it("gives a manager every member and the invites", async () => {
    const calls = stubAdminApi({
      ...asMember("owner"),
      "/stores/store-1/members": {
        items: [
          {
            userId: "u-ana",
            name: "Ana",
            email: "ana@loja.test",
            role: "owner",
            sellerId: "s-ana",
            displayName: "Ana",
            whatsappNumber: null,
            avatarUrl: null,
            listingCount: 0,
          },
        ],
      },
      "/stores/store-1/invites": { items: [] },
    });
    renderPage(await TeamPage());
    expect(calls).toEqual(
      expect.arrayContaining([
        "/stores/store-1/members",
        "/stores/store-1/invites",
      ]),
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Convidar pessoas" }),
    ).toBeInTheDocument();
  });

  it("rejects when a member has the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubAdminApi({
      ...asMember("owner"),
      "/stores/store-1/members": { items: [{ userId: "u-ana" }] },
      "/stores/store-1/invites": { items: [] },
    });
    await expect(TeamPage()).rejects.toThrow();
  });
});
