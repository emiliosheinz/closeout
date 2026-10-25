import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando equipe">
      <Skeleton className="h-9 w-32 bg-line" />
      <Skeleton className="mt-3 h-5 w-full max-w-md bg-line" />
      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list.
          <Skeleton key={i} className="h-16 w-full rounded-xl bg-line" />
        ))}
      </div>
    </LoadingRegion>
  );
}
