import { render, screen } from "@testing-library/react";
import { ListingCard } from "../listing-card";

const listing = {
  slug: "mesa-abc123",
  title: "Mesa",
  priceCents: 45000,
  condition: "good" as const,
  availability: "available" as const,
  category: { slug: "moveis", name: "Móveis" },
  cover: null,
};

describe("ListingCard", () => {
  it("shows a placeholder instead of an image when there is no photo", () => {
    render(<ListingCard storeSlug="loja" listing={listing} />);
    expect(screen.getByTestId("photo-placeholder")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("marks only the first card's photo as high fetch priority", () => {
    const cover = {
      sm: "/sm.webp",
      lg: "/lg.webp",
      og: "/og.jpg",
      width: 640,
      height: 800,
    };
    const { unmount } = render(
      <ListingCard
        storeSlug="loja"
        listing={{ ...listing, cover }}
        priority
        fetchPriority="high"
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("fetchpriority", "high");
    unmount();

    render(
      <ListingCard storeSlug="loja" listing={{ ...listing, cover }} priority />,
    );
    expect(screen.getByRole("img")).not.toHaveAttribute(
      "fetchpriority",
      "high",
    );
  });

  it("links to the item page and stamps sold items", () => {
    render(
      <ListingCard
        storeSlug="nosso-desapego"
        listing={{ ...listing, availability: "sold" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Mesa" })).toHaveAttribute(
      "href",
      "/store/nosso-desapego/items/mesa-abc123",
    );
    expect(screen.getByText("Vendido")).toBeInTheDocument();
  });

  it("links to the item under the store it is shown in", () => {
    render(<ListingCard storeSlug="loja-da-bia" listing={listing} />);
    expect(screen.getByRole("link", { name: "Mesa" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia/items/mesa-abc123",
    );
  });
});
