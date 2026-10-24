import { getQueryClient } from "@/shared/api";

/**
 * Stands in for the API behind the server fetcher. Each route is a path
 * suffix mapped to a JSON body or a bare status code; anything else is a 404.
 * Specs also mock `next/headers` so the fetcher finds a session cookie.
 */
export function stubAdminApi(routes: Record<string, unknown>) {
  getQueryClient().clear();
  process.env.API_BASE_URL = "http://api:3000";
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      const route = Object.entries(routes).find(([suffix]) =>
        path.endsWith(suffix),
      );
      if (!route) return new Response(null, { status: 404 });
      const [, body] = route;
      return typeof body === "number"
        ? new Response(null, { status: body })
        : Response.json(body);
    }),
  );
  return calls;
}
