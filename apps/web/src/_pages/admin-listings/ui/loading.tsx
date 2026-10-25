import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando anúncios">
      <Skeleton className="h-9 w-40 bg-line" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list.
          <Skeleton key={i} className="h-11 w-28 rounded-full bg-line" />
        ))}
      </div>
      <Skeleton className="mt-6 h-11 w-full max-w-md rounded-full bg-line" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list.
          <Skeleton key={i} className="h-20 w-full rounded-xl bg-line" />
        ))}
      </div>
    </LoadingRegion>
  );
}
