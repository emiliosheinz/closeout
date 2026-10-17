export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando item"
      className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:px-8"
    >
      <div className="aspect-[4/5] animate-pulse rounded-xl bg-line sm:aspect-[5/4] lg:aspect-[4/5]" />
      <div className="mt-8 lg:mt-0">
        <div className="h-4 w-32 animate-pulse rounded bg-line" />
        <div className="mt-3 h-10 w-3/4 animate-pulse rounded bg-line" />
        <div className="mt-6 h-24 w-full animate-pulse rounded-lg bg-line" />
      </div>
    </div>
  );
}
