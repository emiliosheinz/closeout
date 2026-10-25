export function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 pt-14 pb-24 sm:px-6 lg:px-8"
      role="status"
      aria-busy="true"
      aria-label="Carregando itens"
    >
      <div className="h-5 w-40 animate-pulse rounded bg-line" />
      <div className="mt-4 h-12 w-3/4 max-w-xl animate-pulse rounded bg-line" />
      <div className="mt-10 h-12 w-full animate-pulse rounded-full bg-line" />
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list.
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-lg bg-line" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-line" />
          </li>
        ))}
      </ul>
    </div>
  );
}
