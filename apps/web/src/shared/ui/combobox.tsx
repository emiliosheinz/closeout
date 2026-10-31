"use client";

import { useId, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { inputClass } from "./field";

export type ComboboxOption = { id: string; label: string };

/**
 * Free-text input with a suggestion list (WAI-ARIA list autocomplete with
 * manual selection). It renders exactly the `options` it is given: filtering
 * and capping belong to the caller. Typing never selects; only Enter or a
 * click on an option calls `onSelect`.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  onSelect,
  className,
  ...inputProps
}: Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "onSelect" | "role" | "type"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
}) {
  const listboxId = useId();
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const expanded = !dismissed && options.length > 0;
  const active = expanded ? options[activeIndex] : undefined;
  const optionId = (index: number) => `${listboxId}-${index}`;

  function select(option: ComboboxOption) {
    onSelect(option);
    setDismissed(true);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setDismissed(false);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + step;
        if (next < 0) return options.length - 1;
        return next % options.length;
      });
      return;
    }
    if (event.key === "Enter" && active) {
      event.preventDefault();
      select(active);
      return;
    }
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoComplete="off"
        {...inputProps}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={active ? optionId(activeIndex) : undefined}
        value={value}
        onChange={(event) => {
          setDismissed(false);
          setActiveIndex(-1);
          onValueChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        className={cn(inputClass, className)}
      />
      <div
        id={listboxId}
        role="listbox"
        hidden={!expanded}
        className="overflow-hidden rounded-md border border-line bg-surface"
      >
        {expanded &&
          options.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled on the combobox input (aria-activedescendant).
            <div
              key={option.id}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option)}
              className="flex min-h-11 cursor-pointer items-center px-3 text-base text-ink aria-selected:bg-paper hover:bg-paper"
            >
              {option.label}
            </div>
          ))}
      </div>
    </div>
  );
}
