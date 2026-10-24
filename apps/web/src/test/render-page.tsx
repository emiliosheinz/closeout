import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

/** Renders a server page's output where its hydration boundary has a client to hydrate into. */
export function renderPage(page: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {page}
    </QueryClientProvider>,
  );
}
