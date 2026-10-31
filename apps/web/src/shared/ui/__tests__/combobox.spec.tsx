import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "../combobox";

const OPTIONS: ComboboxOption[] = [
  { id: "b1", label: "Maria Sílva" },
  { id: "b2", label: "Mário Costa" },
];

function Harness({
  options = OPTIONS,
  onSelect = vi.fn(),
}: {
  options?: ComboboxOption[];
  onSelect?: (option: ComboboxOption) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      aria-label="Comprador"
      value={value}
      onValueChange={setValue}
      options={options}
      onSelect={(option) => {
        setValue(option.label);
        onSelect(option);
      }}
    />
  );
}

const input = () => screen.getByRole("combobox", { name: "Comprador" });

describe("Combobox", () => {
  it("exposes combobox semantics and points aria-controls at the listbox", () => {
    const { rerender } = render(<Harness options={[]} />);
    expect(input()).toHaveAttribute("aria-expanded", "false");

    rerender(<Harness />);
    fireEvent.change(input(), { target: { value: "mar" } });
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(input()).toHaveAttribute(
      "aria-controls",
      screen.getByRole("listbox").id,
    );
  });

  it("moves the active option with ArrowDown and selects it with Enter", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const second = screen.getByRole("option", { name: "Mário Costa" });
    expect(input()).toHaveAttribute("aria-activedescendant", second.id);

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(input()).toHaveValue("Mário Costa");
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("selects an option on click", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: "mar" } });

    fireEvent.click(screen.getByRole("option", { name: "Maria Sílva" }));

    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it("closes on Escape and keeps the typed text", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "mar" } });

    fireEvent.keyDown(input(), { key: "Escape" });

    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).toHaveValue("mar");
  });

  it("keeps typed text and reports no selection when nothing is picked", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    fireEvent.change(input(), { target: { value: "Fulano" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(input()).toHaveValue("Fulano");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stays closed until focused input is typed into or navigated", () => {
    render(<Harness />);
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the input loses focus", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "mar" } });
    expect(input()).toHaveAttribute("aria-expanded", "true");

    fireEvent.blur(input());

    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("selects on click without moving focus off the input", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: "mar" } });
    input().focus();
    const option = screen.getByRole("option", { name: "Maria Sílva" });

    const proceeded = fireEvent.mouseDown(option);
    fireEvent.click(option);

    expect(proceeded).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
    expect(input()).toHaveFocus();
  });

  it("names the listbox and still runs the caller's key handler", () => {
    const onKeyDown = vi.fn();
    render(
      <Combobox
        aria-label="Comprador"
        value="m"
        onValueChange={() => undefined}
        options={OPTIONS}
        onSelect={() => undefined}
        onKeyDown={onKeyDown}
      />,
    );
    fireEvent.change(input(), { target: { value: "ma" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(screen.getByRole("listbox", { name: "Comprador" })).toBeVisible();
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("renders exactly the options passed without filtering", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "zzz" } });

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});
