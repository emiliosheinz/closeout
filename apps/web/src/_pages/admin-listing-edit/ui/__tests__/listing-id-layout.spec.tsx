import { render, screen } from "@testing-library/react";
import { ListingIdLayout } from "../listing-id-layout";

const layout = (id: string) =>
  ListingIdLayout({
    params: Promise.resolve({ id }),
    children: <p>anúncio</p>,
  });

describe("listing id layout", () => {
  it("lets a listing id through", async () => {
    render(await layout("0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f"));
    expect(screen.getByText("anúncio")).toBeInTheDocument();
  });

  it.each([
    "a%2Fb",
    "..%2F..",
    "not-a-uuid",
  ])("shows not-found for %s", async (id) => {
    await expect(layout(id)).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });
});
