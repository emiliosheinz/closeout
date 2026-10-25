import { ApiError } from "../../http/api-error";
import { getQueryClient, makeQueryClient, shouldRetry } from "../query-client";

describe("query client in the browser", () => {
  it("shares one client", () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it("keeps hydrated data fresh for a while", () => {
    expect(makeQueryClient().getDefaultOptions().queries?.staleTime).toBe(
      60_000,
    );
  });

  it("lets a caller's cache and defaults through", () => {
    const client = makeQueryClient({
      defaultOptions: { queries: { staleTime: 5 } },
    });
    expect(client.getDefaultOptions().queries?.staleTime).toBe(5);
    expect(client.getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});

describe("retry predicate", () => {
  it.each([400, 401, 404, 422, 499])("does not retry a %i", (status) => {
    expect(shouldRetry(0, new ApiError(status, "x"))).toBe(false);
  });

  it.each([500, 502, 0])("retries a %i once", (status) => {
    const error = new ApiError(status, "x");
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(false);
  });

  it("retries an unknown failure once", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(true);
    expect(shouldRetry(1, new Error("boom"))).toBe(false);
  });
});
