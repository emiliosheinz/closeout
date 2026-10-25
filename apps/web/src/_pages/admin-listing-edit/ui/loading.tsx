import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando anúncio" className="max-w-3xl">
      <Skeleton className="h-5 w-44 bg-line" />
      <Skeleton className="mt-3 h-9 w-64 bg-line" />
      <div className="mt-8 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list.
          <Skeleton key={i} className="aspect-square rounded-lg bg-line" />
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-6 border-t border-line pt-8">
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-32 w-full bg-line" />
      </div>
    </LoadingRegion>
  );
}
