import { Search } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** The admin tables' search box; `label` names it for screen readers. */
export function SearchInput({
  id,
  label,
  placeholder = label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative max-w-md", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-9 text-base"
      />
    </div>
  );
}
