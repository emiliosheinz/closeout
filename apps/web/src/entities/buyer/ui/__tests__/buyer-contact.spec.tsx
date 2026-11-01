import { render, screen } from "@testing-library/react";
import { BuyerContact } from "../buyer-contact";

describe("BuyerContact", () => {
  it("links the buyer's number to their WhatsApp chat", () => {
    render(
      <BuyerContact
        buyer={{ name: "Maria Silva", whatsappNumber: "5511911112222" }}
      />,
    );

    const link = screen.getByRole("link", { name: /^WhatsApp de Maria Silva/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5511911112222");
    // jsdom applies no CSS, so its name computation misses the space browsers
    // keep after the sr-only (absolutely positioned, so block) prefix.
    expect(link).toHaveTextContent(
      "WhatsApp de Maria Silva: +55 11 91111-2222",
    );
  });

  it("shows only the name when the buyer has no phone", () => {
    render(<BuyerContact buyer={{ name: "João", whatsappNumber: null }} />);

    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
