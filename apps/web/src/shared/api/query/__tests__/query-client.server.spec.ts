/** @vitest-environment node */
import { getQueryClient } from "../query-client";

describe("query client on the server", () => {
  it("gives each server render its own client", () => {
    expect(getQueryClient()).not.toBe(getQueryClient());
  });
});
