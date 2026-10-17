import { act, fireEvent, render, screen } from "@testing-library/react";
import { ShareButton } from "../share-button";

describe("ShareButton", () => {
  it("copies the link and confirms when there is no share sheet", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <ShareButton url="https://loja.example/itens/mesa-abc123" title="Mesa" />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    });

    expect(writeText).toHaveBeenCalledWith(
      "https://loja.example/itens/mesa-abc123",
    );
    expect(
      screen.getByRole("button", { name: "Link copiado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Link do item copiado.",
    );
  });

  it("uses the native share sheet when available", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });

    render(
      <ShareButton url="https://loja.example/itens/mesa-abc123" title="Mesa" />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    });

    expect(share).toHaveBeenCalledWith({
      title: "Mesa",
      url: "https://loja.example/itens/mesa-abc123",
    });
  });
});
