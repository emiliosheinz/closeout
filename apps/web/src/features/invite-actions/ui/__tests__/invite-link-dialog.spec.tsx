import { fireEvent, render, screen } from "@testing-library/react";
import { InviteLinkDialog } from "../invite-link-dialog";

const invite = {
  email: "duda@loja.test",
  link: "https://closeout.test/invite/abc123",
};

function stubClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("InviteLinkDialog", () => {
  it("shows the link once with a note that it expires in 7 days", () => {
    render(<InviteLinkDialog invite={invite} onClose={jest.fn()} />);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Convite para duda@loja.test",
    );
    expect(screen.getByLabelText("Link do convite")).toHaveValue(
      "https://closeout.test/invite/abc123",
    );
    expect(
      screen.getByText(/Este link aparece só agora e vale por 7 dias/),
    ).toBeInTheDocument();
  });

  it("copies the link and confirms it", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<InviteLinkDialog invite={invite} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(
      await screen.findByRole("button", { name: "Copiado" }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      "https://closeout.test/invite/abc123",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Link copiado.");
  });

  it("selects the link for copying by hand when the clipboard is refused", async () => {
    stubClipboard(jest.fn().mockRejectedValue(new Error("denied")));
    render(<InviteLinkDialog invite={invite} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(
      await screen.findByText(/O link está selecionado/),
    ).toBeInTheDocument();
    const input = screen.getByLabelText<HTMLInputElement>("Link do convite");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(invite.link.length);
  });

  it("stays closed without an invite", () => {
    render(<InviteLinkDialog invite={null} onClose={jest.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
