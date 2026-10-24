import { render, screen } from "@testing-library/react";
import { requireMember } from "@/lib/admin/current-store";
import { adminGet } from "@/lib/admin/server-api";
import TeamPage from "../page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/lib/admin/server-api", () => ({ adminGet: jest.fn() }));
jest.mock("@/lib/admin/current-store", () => ({
  ...jest.requireActual("@/lib/admin/current-store"),
  requireMember: jest.fn(),
}));

const seller = (id: string, displayName: string) => ({
  id,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 1,
});

const asMember = (role: "owner" | "seller") =>
  (requireMember as jest.Mock).mockResolvedValue({
    me: { user: { id: "u-caio", name: "Caio", email: "caio@loja.test" } },
    store: { id: "store-1" },
    role,
    sellerId: "s-caio",
  });

describe("team page", () => {
  beforeEach(() => jest.mocked(adminGet).mockReset());

  it("gives a seller only their own card, from the sellers list", async () => {
    asMember("seller");
    jest.mocked(adminGet).mockResolvedValue({
      items: [seller("s-ana", "Ana"), seller("s-caio", "Caio Vendedor")],
    });
    render(await TeamPage());
    expect(adminGet).toHaveBeenCalledTimes(1);
    expect(adminGet).toHaveBeenCalledWith("/stores/store-1/sellers");
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Caio Vendedor"]);
    expect(screen.getByText("caio@loja.test")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.queryByLabelText("E-mail da pessoa")).toBeNull();
  });

  it("shows a seller no card when their profile is not in the list", async () => {
    asMember("seller");
    jest
      .mocked(adminGet)
      .mockResolvedValue({ items: [seller("s-ana", "Ana")] });
    render(await TeamPage());
    expect(screen.queryAllByRole("heading", { level: 3 })).toEqual([]);
  });

  it("gives a manager every member and the invites", async () => {
    asMember("owner");
    jest.mocked(adminGet).mockImplementation(async (path: string) =>
      path.endsWith("/members")
        ? {
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
          }
        : { items: [] },
    );
    render(await TeamPage());
    expect(adminGet).toHaveBeenCalledWith("/stores/store-1/members");
    expect(adminGet).toHaveBeenCalledWith("/stores/store-1/invites");
    expect(screen.getByRole("heading", { name: "Ana" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail da pessoa")).toBeInTheDocument();
  });
});
