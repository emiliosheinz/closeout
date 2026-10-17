import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted aria-[invalid=true]:border-stamp";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-stamp" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
