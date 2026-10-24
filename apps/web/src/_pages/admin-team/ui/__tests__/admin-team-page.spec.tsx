import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { requireMember } from "@/entities/session/index.server";
import { adminGet } from "@/shared/api/index.server";
import { TeamPage } from "../admin-team-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/shared/api/index.server", () => ({ adminGet: vi.fn() }));
vi.mock("@/entities/session/index.server", async () => ({
  ...(await vi.importActual("@/entities/session/index.server")),
  requireMember: vi.fn(),
}));

const seller = (id: string, displayName: string) => ({
  id,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 1,
});

const asMember = (role: "owner" | "seller") =>
  (requireMember as Mock).mockResolvedValue({
    me: { user: { id: "u-caio", name: "Caio", email: "caio@loja.test" } },
    store: { id: "store-1" },
    role,
    sellerId: "s-caio",
  });

describe("team page", () => {
  beforeEach(() => {
    vi.mocked(adminGet).mockReset();
  });

  it("gives a seller only their own row, from the sellers list", async () => {
    asMember("seller");
    vi.mocked(adminGet).mockResolvedValue({
      items: [seller("s-ana", "Ana"), seller("s-caio", "Caio Vendedor")],
    });
    render(await TeamPage());
    expect(adminGet).toHaveBeenCalledTimes(1);
    expect(adminGet).toHaveBeenCalledWith(
      "/stores/store-1/sellers",
      expect.anything(),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Caio Vendedor")).toBeInTheDocument();
    expect(screen.getByText("caio@loja.test")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Convidar pessoas" }),
    ).toBeNull();
  });

  it("shows a seller no row when their profile is not in the list", async () => {
    asMember("seller");
    vi.mocked(adminGet).mockResolvedValue({ items: [seller("s-ana", "Ana")] });
    render(await TeamPage());
    expect(screen.queryAllByRole("listitem")).toEqual([]);
  });

  it("gives a manager every member and the invites", async () => {
    asMember("owner");
    vi.mocked(adminGet).mockImplementation(async (path: string) =>
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
    expect(adminGet).toHaveBeenCalledWith(
      "/stores/store-1/members",
      expect.anything(),
    );
    expect(adminGet).toHaveBeenCalledWith(
      "/stores/store-1/invites",
      expect.anything(),
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Convidar pessoas" }),
    ).toBeInTheDocument();
  });
});
