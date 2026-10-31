import { screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { meResponse, STORE } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { StorePage } from "../admin-store-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

describe("store settings page", () => {
  // The page reads the deployment's public URL, which CI does not set.
  beforeEach(() => vi.stubEnv("PUBLIC_BASE_URL", "https://closeout.example"));
  afterEach(() => vi.unstubAllEnvs());

  it("renders the store name value from the first load", async () => {
    stubAdminApi({
      "/me": meResponse("owner"),
      "/stores/store-1": { ...STORE, name: "Brechó da Bia" },
    });
    renderPage(await StorePage());
    expect(screen.getByLabelText("Nome da loja")).toHaveValue("Brechó da Bia");
  });

  it("shows not-found to a seller", async () => {
    stubAdminApi({ "/me": meResponse("seller") });
    await expect(StorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("shows not-found when the store does not read", async () => {
    stubAdminApi({ "/me": meResponse("owner"), "/stores/store-1": 404 });
    await expect(StorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("sends the member to login when the store read is unauthorized", async () => {
    stubAdminApi({ "/me": meResponse("owner"), "/stores/store-1": 401 });
    await expect(StorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login?error=session-expired"),
    });
  });

  it("rejects when the store has the wrong shape", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stubAdminApi({
      "/me": meResponse("owner"),
      "/stores/store-1": { name: "Sem slug" },
    });
    await expect(StorePage()).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });
});
