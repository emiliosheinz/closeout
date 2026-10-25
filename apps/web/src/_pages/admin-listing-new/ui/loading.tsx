import { LoadingRegion } from "@/shared/ui/loading-region";
import { Skeleton } from "@/shared/ui/skeleton";

export function Loading() {
  return (
    <LoadingRegion label="Carregando formulário" className="max-w-2xl">
      <Skeleton className="h-5 w-44 bg-line" />
      <Skeleton className="mt-3 h-9 w-56 bg-line" />
      <div className="mt-8 flex flex-col gap-6">
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-11 w-full bg-line" />
        <Skeleton className="h-32 w-full bg-line" />
      </div>
    </LoadingRegion>
  );
}
