import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando loja">
      <Skeleton className="h-9 w-24 bg-line" />
      <Skeleton className="mt-3 h-5 w-full max-w-sm bg-line" />
      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-xl bg-line" />
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-28 w-full bg-line" />
      </div>
    </LoadingRegion>
  );
}
