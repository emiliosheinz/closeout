import type {
  adminListingDetailSchema,
  adminListingSummarySchema,
  categorySchema,
  dashboardCountsSchema,
  healthResponseSchema,
  inviteDetailsSchema,
  issuedInviteSchema,
  meSchema,
  pendingInviteSchema,
  sellerSchema,
  sessionResponseSchema,
  storeSettingsSchema,
  teamMemberSchema,
} from "@closeout/contracts/schemas";
import type { z } from "zod";
import type { AuthController } from "./auth/auth.controller";
import type { DashboardController } from "./catalog/controllers/dashboard.controller";
import type { ListingsService } from "./catalog/services/listings.service";
import type { HealthController } from "./health/health.controller";
import type { InviteAcceptController } from "./invites/controllers/invite-accept.controller";
import type { InvitesController } from "./invites/controllers/invites.controller";
import type { InvitesService } from "./invites/services/invites.service";
import type { SellersService } from "./sellers/services/sellers.service";
import type { MeController } from "./stores/controllers/me.controller";
import type { StoreAdminController } from "./stores/controllers/store-admin.controller";
import type { TeamController } from "./stores/controllers/team.controller";
import type { StoresService } from "./stores/services/stores.service";
import type { TeamService } from "./stores/services/team.service";

type Body<T extends (...args: never[]) => Promise<unknown>> = Awaited<
  ReturnType<T>
>;
type Items<T> = T extends { items: infer I } ? I : never;
type Out<S extends z.ZodType> = z.output<S>;

describe("admin response types", () => {
  it("store settings, categories and me match their response schemas", () => {
    expectTypeOf<Body<StoreAdminController["get"]>>().toEqualTypeOf<
      Out<typeof storeSettingsSchema>
    >();
    expectTypeOf<Body<StoresService["me"]>>().toEqualTypeOf<
      Out<typeof meSchema>
    >();
    expectTypeOf<Body<MeController["me"]>>().toEqualTypeOf<
      Out<typeof meSchema>
    >();
    expectTypeOf<Body<StoresService["listCategories"]>[number]>().toEqualTypeOf<
      Out<typeof categorySchema>
    >();
    expectTypeOf<
      Items<Body<StoreAdminController["categories"]>>[number]
    >().toEqualTypeOf<Out<typeof categorySchema>>();
  });

  it("team members match their response schema", () => {
    expectTypeOf<Body<TeamService["list"]>[number]>().toEqualTypeOf<
      Out<typeof teamMemberSchema>
    >();
    expectTypeOf<Items<Body<TeamController["list"]>>[number]>().toEqualTypeOf<
      Out<typeof teamMemberSchema>
    >();
  });

  it("invites match their response schemas", () => {
    expectTypeOf<Body<InvitesService["list"]>[number]>().toEqualTypeOf<
      Out<typeof pendingInviteSchema>
    >();
    expectTypeOf<
      Items<Body<InvitesController["list"]>>[number]
    >().toEqualTypeOf<Out<typeof pendingInviteSchema>>();
    expectTypeOf<Body<InvitesController["create"]>>().toEqualTypeOf<
      Out<typeof issuedInviteSchema>
    >();
    expectTypeOf<Body<InvitesController["regenerate"]>>().toEqualTypeOf<
      Out<typeof issuedInviteSchema>
    >();
    expectTypeOf<Body<InviteAcceptController["lookup"]>>().toEqualTypeOf<
      Out<typeof inviteDetailsSchema>
    >();
  });

  it("sellers match their response schema", () => {
    expectTypeOf<Body<SellersService["list"]>[number]>().toEqualTypeOf<
      Out<typeof sellerSchema>
    >();
  });

  it("session bodies match their response schema", () => {
    expectTypeOf<Body<AuthController["login"]>>().toEqualTypeOf<
      Out<typeof sessionResponseSchema>
    >();
    expectTypeOf<Body<InviteAcceptController["accept"]>>().toEqualTypeOf<
      Out<typeof sessionResponseSchema>
    >();
  });

  it("dashboard counts and listings match their response schemas", () => {
    expectTypeOf<Body<DashboardController["dashboard"]>>().toEqualTypeOf<
      Out<typeof dashboardCountsSchema>
    >();
    expectTypeOf<Body<ListingsService["list"]>[number]>().toEqualTypeOf<
      Out<typeof adminListingSummarySchema>
    >();
    expectTypeOf<Body<ListingsService["get"]>>().toEqualTypeOf<
      Out<typeof adminListingDetailSchema>
    >();
  });

  it("the health report matches its response schema", () => {
    expectTypeOf<Body<HealthController["health"]>>().toEqualTypeOf<
      Out<typeof healthResponseSchema>
    >();
  });
});
