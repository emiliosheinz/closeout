import { render, screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { meResponse } from "@/test/fixtures";
import { StoreLayout } from "../store-layout";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

describe("store settings layout", () => {
  it.each(["owner", "admin"] as const)("lets %s through", async (role) => {
    stubAdminApi({ "/me": meResponse(role) });
    render(await StoreLayout({ children: <p>configurações</p> }));
    expect(screen.getByText("configurações")).toBeInTheDocument();
  });

  it("shows not-found to a seller", async () => {
    stubAdminApi({ "/me": meResponse("seller") });
    await expect(
      StoreLayout({ children: <p>configurações</p> }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
