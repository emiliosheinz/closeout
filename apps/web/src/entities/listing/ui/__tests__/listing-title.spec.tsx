import { render, screen } from "@testing-library/react";
import { listingSummary } from "@/test/fixtures";
import { ListingTitle } from "../listing-title";

type Row = ReturnType<typeof listingSummary>;

const row = (id: string, overrides: Partial<Row> = {}): Row =>
  listingSummary({
    id,
    slug: id,
    title: `Item ${id}`,
    sellers: [],
    ...overrides,
  });

function renderRows(rows: Row[], props: { unreachableSellerIds?: string[] }) {
  render(
    <table>
      <tbody>
        {rows.map((listing) => (
          <tr key={listing.id}>
            <td>
              <ListingTitle
                listing={listing}
                unreachableSellerIds={props.unreachableSellerIds}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>,
  );
}

describe("ListingTitle", () => {
  it("warns on published items whose seller cannot be reached", () => {
    renderRows(
      [
        row("a", { sellers: [{ id: "no-phone", displayName: "x" }] }),
        row("b", { sellers: [{ id: "with-phone", displayName: "y" }] }),
        row("c", {
          publication: "draft",
          sellers: [{ id: "no-phone", displayName: "x" }],
        }),
        row("d", {
          sellers: [
            { id: "no-phone", displayName: "x" },
            { id: "with-phone", displayName: "y" },
          ],
        }),
      ],
      { unreachableSellerIds: ["no-phone"] },
    );
    const warnings = screen.getAllByRole("link", { name: /sem WhatsApp/ });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveAttribute("href", "/admin/team");
    expect(warnings[0]?.closest("tr")).toHaveTextContent("Item a");
  });
});
