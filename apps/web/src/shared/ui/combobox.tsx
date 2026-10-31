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
  listboxLabel,
  className,
  onKeyDown: callerOnKeyDown,
  onBlur: callerOnBlur,
  ...inputProps
}: Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "onSelect" | "role" | "type"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
  /** Accessible name of the suggestion list; defaults to the input's `aria-label`. */
  listboxLabel?: string;
}) {
  const listboxId = useId();
  const [dismissed, setDismissed] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const expanded = !dismissed && options.length > 0;
  const activeIndex = expanded
    ? options.findIndex((option) => option.id === activeId)
    : -1;
  const active = options[activeIndex];
  const optionId = (index: number) => `${listboxId}-${index}`;

  function close() {
    setDismissed(true);
    setActiveId(null);
  }

  function select(option: ComboboxOption) {
    onSelect(option);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    callerOnKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setDismissed(false);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = activeIndex + step;
      const target = next < 0 ? options.length - 1 : next % options.length;
      setActiveId(options[target]?.id ?? null);
      return;
    }
    if (event.key === "Enter" && active) {
      event.preventDefault();
      select(active);
      return;
    }
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      close();
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
          setActiveId(null);
          onValueChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          callerOnBlur?.(event);
          close();
        }}
        className={cn(inputClass, className)}
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label={listboxLabel ?? inputProps["aria-label"]}
        aria-labelledby={inputProps["aria-labelledby"]}
        hidden={!expanded}
        className="max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
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
              className="flex min-h-11 cursor-pointer select-none items-center rounded-sm px-2 text-base aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {option.label}
            </div>
          ))}
      </div>
    </div>
  );
}
