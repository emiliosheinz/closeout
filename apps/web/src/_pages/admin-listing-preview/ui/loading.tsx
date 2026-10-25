import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando pré-visualização">
      <Skeleton className="h-10 w-full bg-line" />
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-[4/5] rounded-lg bg-line" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4 bg-line" />
          <Skeleton className="h-6 w-32 bg-line" />
          <Skeleton className="h-24 w-full bg-line" />
        </div>
      </div>
    </LoadingRegion>
  );
}
