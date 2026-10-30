import type {
  adminImageSchema,
  publicImageSchema,
  publicListingDetailSchema,
  publicListingSummarySchema,
} from "@closeout/contracts/schemas";
import type { z } from "zod";
import { toAdminImage } from "./admin-mappers";
import {
  toPublicDetail,
  toPublicImage,
  toPublicSummary,
} from "./public-mappers";

describe("catalog mapper return types", () => {
  it("public image matches its response schema", () => {
    expectTypeOf(toPublicImage).returns.toEqualTypeOf<
      z.output<typeof publicImageSchema>
    >();
  });

  it("public summary matches its response schema", () => {
    expectTypeOf(toPublicSummary).returns.toEqualTypeOf<
      z.output<typeof publicListingSummarySchema>
    >();
  });

  it("public detail matches its response schema", () => {
    expectTypeOf(toPublicDetail).returns.toEqualTypeOf<
      z.output<typeof publicListingDetailSchema>
    >();
  });

  it("admin image matches its response schema", () => {
    expectTypeOf(toAdminImage).returns.toEqualTypeOf<
      z.output<typeof adminImageSchema>
    >();
  });
});
