import { render, screen } from "@testing-library/react";
import { useParams } from "next/navigation";
import { CatalogError as StoreError } from "@/_app/ui/store-error";

vi.mock("next/navigation", () => ({ useParams: vi.fn() }));

describe("store error page", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("links back to the catalog of %s", (slug, href) => {
    vi.mocked(useParams).mockReturnValue({ slug });
    render(<StoreError error={new Error("falhou")} reset={() => {}} />);
    expect(
      screen.getByRole("link", { name: "Voltar ao catálogo" }),
    ).toHaveAttribute("href", href);
  });
});
