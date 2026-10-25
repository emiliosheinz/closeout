import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { renderWithFeedback } from "@/test/feedback-harness";
import { PhotoDropzone } from "../photo-dropzone";

const file = (name: string, type: string) => new File(["x"], name, { type });

function drop(files: File[]) {
  fireEvent.drop(screen.getByRole("button", { name: "Adicionar fotos" }), {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      })),
      types: ["Files"],
    },
  });
}

describe("photo dropzone", () => {
  it("passes dropped images to onFiles", async () => {
    const onFiles = vi.fn();
    renderWithFeedback(<PhotoDropzone existing={0} onFiles={onFiles} />);
    drop([
      file("a.png", "image/png"),
      file("b.webp", "image/webp"),
      file("c.jpg", "image/jpeg"),
      file("d.gif", "image/gif"),
    ]);
    await waitFor(() => expect(onFiles).toHaveBeenCalledOnce());
    expect(
      (onFiles.mock.calls[0]?.[0] as File[]).map((added) => added.name),
    ).toEqual(["a.png", "b.webp", "c.jpg"]);
    expect(
      await screen.findByText('"d.gif" não é JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
  });

  it("skips a non-image and toasts its name", async () => {
    const onFiles = vi.fn();
    renderWithFeedback(<PhotoDropzone existing={0} onFiles={onFiles} />);
    drop([file("nota.pdf", "application/pdf"), file("a.png", "image/png")]);
    expect(
      await screen.findByText('"nota.pdf" não é JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("uploads the remaining capacity and toasts the skipped count", async () => {
    const onFiles = vi.fn();
    renderWithFeedback(<PhotoDropzone existing={18} onFiles={onFiles} />);
    drop([1, 2, 3, 4].map((i) => file(`${i}.png`, "image/png")));
    expect(
      await screen.findByText("2 fotos não enviadas: limite de 20."),
    ).toBeInTheDocument();
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(2);
    expect(toast.getToasts()).toHaveLength(1);
  });

  it("toasts each rejected file and the skipped count, one toast each", async () => {
    const onFiles = vi.fn();
    renderWithFeedback(<PhotoDropzone existing={19} onFiles={onFiles} />);
    drop([
      file("a.pdf", "application/pdf"),
      file("b.gif", "image/gif"),
      file("1.png", "image/png"),
      file("2.png", "image/png"),
      file("3.png", "image/png"),
    ]);
    await screen.findByText("2 fotos não enviadas: limite de 20.");
    expect(
      screen.getByText('"a.pdf" não é JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('"b.gif" não é JPEG, PNG ou WebP.'),
    ).toBeInTheDocument();
    expect(toast.getToasts()).toHaveLength(3);
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it.each([
    "Enter",
    " ",
  ])("opens the picker from the keyboard with %j", async (key) => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<PhotoDropzone existing={0} onFiles={vi.fn()} />);
    const root = screen.getByRole("button", { name: "Adicionar fotos" });
    expect(root).toHaveAttribute("tabindex", "0");
    root.focus();
    fireEvent.keyDown(root, { key });
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
