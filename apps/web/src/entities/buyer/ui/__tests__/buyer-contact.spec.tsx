import { render, screen } from "@testing-library/react";
import { BuyerContact } from "../buyer-contact";

describe("BuyerContact", () => {
  it("links the name to the buyer's WhatsApp chat", () => {
    render(
      <BuyerContact
        buyer={{ name: "Maria Silva", whatsappNumber: "5511911112222" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Maria Silva" })).toHaveAttribute(
      "href",
      "https://wa.me/5511911112222",
    );
  });

  it("shows only the name when the buyer has no phone", () => {
    render(<BuyerContact buyer={{ name: "João", whatsappNumber: null }} />);

    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
