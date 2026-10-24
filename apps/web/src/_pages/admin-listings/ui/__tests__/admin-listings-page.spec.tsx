import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { listingSummary, meResponse, seller } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { DashboardPage } from "../admin-listings-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const listings = [
  listingSummary({ id: "l-1", title: "Sofá azul" }),
  listingSummary({
    id: "l-2",
    title: "Mesa de jantar",
    publication: "draft",
  }),
  listingSummary({
    id: "l-3",
    title: "Cadeira",
    availability: "sold",
  }),
];

const show = async (searchParams: { q?: string; status?: string } = {}) =>
  renderPage(
    await DashboardPage({ searchParams: Promise.resolve(searchParams) }),
  );

describe("admin listings page", () => {
  it("loads the listings and sellers and shows every listing", async () => {
    const calls = stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [seller("s-ana", "Ana")] },
    });
    await show();
    expect(calls).toEqual(
      expect.arrayContaining([
        "/stores/store-1/listings",
        "/stores/store-1/sellers",
      ]),
    );
    expect(screen.getByText("Sofá azul")).toBeInTheDocument();
    expect(screen.getByText("Mesa de jantar")).toBeInTheDocument();
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
  });

  it("counts every tab from the loaded listings", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show();
    const tabs = within(
      screen.getByRole("navigation", { name: "Filtrar por situação" }),
    );
    expect(tabs.getByRole("link", { name: /Todos/ })).toHaveTextContent("3");
    expect(tabs.getByRole("link", { name: /Publicados/ })).toHaveTextContent(
      "2",
    );
    expect(tabs.getByRole("link", { name: /Rascunhos/ })).toHaveTextContent(
      "1",
    );
    expect(tabs.getByRole("link", { name: /Vendidos/ })).toHaveTextContent("1");
  });

  it("filters by status and by title", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show({ status: "rascunhos", q: "mesa" });
    expect(screen.getByText("Mesa de jantar")).toBeInTheDocument();
    expect(screen.queryByText("Sofá azul")).toBeNull();
  });

  it("rejects when a listing is missing a required field", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { title: _title, ...broken } = listings[0] ?? listingSummary();
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: [broken] },
      "/stores/store-1/sellers": { items: [] },
    });
    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it("sends the member to login when the API says the session ended", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": 401,
      "/stores/store-1/sellers": 401,
    });
    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/entrar?erro=sessao-expirada"),
    });
  });

  it("shows not-found, not login, when the lists are missing for another reason", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": 404,
      "/stores/store-1/sellers": 404,
    });
    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("keeps a row under the filtered tab after its status change and moves the counts", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show({ status: "vendidos" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      {
        key: "Enter",
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );
    expect(screen.getByTestId("count-available")).toHaveTextContent("2");
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Disponível");
  });

  async function changeCadeiraToAvailable(patch: Promise<Response>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => patch),
    );
    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      { key: "Enter" },
    );
    return trigger;
  }

  it("drops the kept row once the filter or the search changes", async () => {
    const routes = {
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    };
    stubAdminApi(routes);
    const client = new QueryClient();
    const page = async (searchParams: { q?: string; status?: string }) => (
      <QueryClientProvider client={client}>
        {await DashboardPage({ searchParams: Promise.resolve(searchParams) })}
      </QueryClientProvider>
    );
    const view = render(await page({ status: "vendidos" }));
    await changeCadeiraToAvailable(new Promise<Response>(() => {}));
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );
    expect(screen.getByText("Cadeira")).toBeInTheDocument();

    view.rerender(await page({ status: "disponiveis" }));
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
    view.rerender(await page({ status: "vendidos" }));
    expect(screen.queryByText("Cadeira")).toBeNull();
    expect(screen.getByText("Nenhum anúncio em Vendidos.")).toBeInTheDocument();
  });

  it("restores the tab count when the status change is rejected", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show();
    let reject!: (response: Response) => void;
    await changeCadeiraToAvailable(
      new Promise<Response>((resolve) => {
        reject = resolve;
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );

    reject(
      Response.json({ message: "Servidor indisponível." }, { status: 500 }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("count-available")).toHaveTextContent("1");
  });
});
