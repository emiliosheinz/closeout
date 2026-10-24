import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MockedFunction } from "vitest";
import type { AdminListingSummary } from "@/entities/listing";
import { api } from "@/shared/api";
import { ListingRows } from "../listing-rows";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/shared/api", async () => ({
  ...(await vi.importActual("@/shared/api")),
  api: vi.fn(),
}));

const apiMock = api as MockedFunction<typeof api>;

const row = (
  id: string,
  sellerIds: string[],
  publication: AdminListingSummary["publication"] = "published",
): AdminListingSummary => ({
  id,
  slug: id,
  title: `Item ${id}`,
  priceCents: 1000,
  condition: "good",
  availability: "available",
  publication,
  category: { id: "c", name: "Móveis" },
  sellers: sellerIds.map((id) => ({ id, displayName: id })),
  coverUrl: null,
  imageCount: 1,
  updatedAt: "2026-10-17T12:00:00.000Z",
});

describe("ListingRows", () => {
  it("warns on published items whose seller cannot be reached", () => {
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[
          row("a", ["no-phone"]),
          row("b", ["with-phone"]),
          row("c", ["no-phone"], "draft"),
          row("d", ["no-phone", "with-phone"]),
        ]}
        unreachableSellerIds={["no-phone"]}
      />,
    );
    const warnings = screen.getAllByRole("link", { name: /sem WhatsApp/ });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveAttribute("href", "/admin/equipe");
    expect(warnings[0]?.closest("li")).toHaveTextContent("Item a");
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego/items/a"],
    ["loja-da-bia", "/store/loja-da-bia/items/a"],
  ])("links published items to their page in %s", (slug, href) => {
    render(
      <ListingRows
        storeId="store"
        storeSlug={slug}
        listings={[row("a", [])]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Ver Item a na loja" }),
    ).toHaveAttribute("href", href);
  });

  it("links unpublished items to the admin preview", () => {
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[row("b", [], "draft")]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Pré-visualizar Item b" }),
    ).toHaveAttribute("href", "/admin/anuncios/b/previa");
  });

  it("names each status control after its item and shows the selected label", () => {
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[row("a", []), row("b", [], "draft")]}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Publicação de Item a" }),
    ).toHaveTextContent("Publicado");
    expect(
      screen.getByRole("combobox", { name: "Publicação de Item b" }),
    ).toHaveTextContent("Rascunho");
    expect(
      screen.getByRole("combobox", { name: "Disponibilidade de Item a" }),
    ).toHaveTextContent("Disponível");
  });

  it("changes availability from the keyboard: open, move, select", async () => {
    apiMock.mockReset();
    apiMock.mockResolvedValue(undefined);
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[row("a", [])]}
      />,
    );
    const select = screen.getByRole("combobox", {
      name: "Disponibilidade de Item a",
    });
    select.focus();
    fireEvent.keyDown(select, { key: "Enter" });

    await screen.findByRole("listbox");
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Disponível",
      "Reservado",
      "Vendido",
    ]);
    await waitFor(() => expect(options[0]).toHaveFocus());
    fireEvent.keyDown(options[0] as HTMLElement, { key: "ArrowDown" });
    await waitFor(() => expect(options[1]).toHaveFocus());
    fireEvent.keyDown(options[1] as HTMLElement, { key: "Enter" });

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "PATCH",
        "/stores/store/listings/a/status",
        { availability: "reserved" },
      ),
    );
  });
});
