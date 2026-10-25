import { render, screen } from "@testing-library/react";
import { useParams } from "next/navigation";
import { NotFound } from "../not-found";
import { StoreNotFound } from "../store-not-found";

vi.mock("next/navigation", () => ({ useParams: vi.fn() }));

describe("not-found pages", () => {
  it("links the root page back to the start", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("link", { name: "Ir para o início" }),
    ).toHaveAttribute("href", "/");
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("links the store page back to the catalog of %s", (slug, href) => {
    vi.mocked(useParams).mockReturnValue({ slug });
    render(<StoreNotFound />);
    expect(
      screen.getByRole("link", { name: "Ver o catálogo" }),
    ).toHaveAttribute("href", href);
  });
});
