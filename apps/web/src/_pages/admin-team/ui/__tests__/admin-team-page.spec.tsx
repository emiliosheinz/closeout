import { screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
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

const Nuqs = withNuqsTestingAdapter();

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
    renderPage(<Nuqs>{await TeamPage()}</Nuqs>);
    expect(calls).toEqual(["/me", "/stores/store-1/sellers"]);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Caio Vendedor")).toBeInTheDocument();
    expect(
      screen.getByRole("row", { name: /caio@loja\.test/ }),
    ).toBeInTheDocument();
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
    renderPage(<Nuqs>{await TeamPage()}</Nuqs>);
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ações para/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
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
    renderPage(<Nuqs>{await TeamPage()}</Nuqs>);
    expect(calls).toEqual([
      "/me",
      "/stores/store-1/members",
      "/stores/store-1/invites",
    ]);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Convidar pessoas" }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "members",
      {
        "/stores/store-1/members": 401,
        "/stores/store-1/invites": { items: [] },
      },
    ],
    [
      "invites",
      {
        "/stores/store-1/members": { items: [] },
        "/stores/store-1/invites": 401,
      },
    ],
  ])("sends a manager to login when the %s read is unauthorized", async (_name, routes) => {
    stubAdminApi({ ...asMember("owner"), ...routes });
    await expect(TeamPage()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login?error=session-expired"),
    });
  });

  it("sends a seller to login when the sellers read is unauthorized", async () => {
    stubAdminApi({ ...asMember("seller"), "/stores/store-1/sellers": 401 });
    await expect(TeamPage()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login?error=session-expired"),
    });
  });

  it("rejects when a member has the wrong shape", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stubAdminApi({
      ...asMember("owner"),
      "/stores/store-1/members": { items: [{ userId: "u-ana" }] },
      "/stores/store-1/invites": { items: [] },
    });
    await expect(TeamPage()).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });
});
