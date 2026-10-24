import { render, screen } from "@testing-library/react";
import { useParams } from "next/navigation";
import { CatalogError as StoreError } from "@/_app/ui/store-error";

jest.mock("next/navigation", () => ({ useParams: jest.fn() }));

describe("store error page", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("links back to the catalog of %s", (slug, href) => {
    jest.mocked(useParams).mockReturnValue({ slug });
    render(<StoreError error={new Error("falhou")} reset={() => {}} />);
    expect(
      screen.getByRole("link", { name: "Voltar ao catálogo" }),
    ).toHaveAttribute("href", href);
  });
});
