import {
  adminImageSchema,
  adminListingDetailSchema,
  adminListingSummarySchema,
  categorySchema,
  dashboardCountsSchema,
  inviteDetailsSchema,
  issuedInviteSchema,
  meSchema,
  pendingInviteSchema,
  publicListingDetailSchema,
  publicListingPageSchema,
  publicListingSummarySchema,
  publicStoreIndexSchema,
  publicStoreSchema,
  sellerSchema,
  sessionResponseSchema,
  storeSettingsSchema,
  teamMemberSchema,
} from "@closeout/contracts/schemas";
import request from "supertest";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  internalPost,
  PASSWORD,
  photo,
  registeredRoutes,
  resetDatabase,
  type TestContext,
} from "./helpers";

/** Routes whose response body some test parsed with a contracts schema. */
const parsedRoutes = new Set<string>();

/** Registered routes that answer 2xx without a JSON body, or have no body schema yet. */
const NOT_PARSED = new Set([
  "GET /media/:file", // image bytes
  "POST /auth/logout", // 204
  "DELETE /stores/:storeId/listings/:id", // 204
  "DELETE /stores/:storeId/members/:userId", // 204
  "DELETE /stores/:storeId/invites/:id", // 204
  "GET /health", // { status } has no contracts schema
]);

/** Fails with the schema's issues in the message instead of a bare boolean. */
function expectParses(
  route: string,
  schema: {
    safeParse(body: unknown): {
      success: boolean;
      error?: { issues: unknown[] };
    };
  },
  body: unknown,
): void {
  parsedRoutes.add(route);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(JSON.stringify(result.error?.issues, null, 2));
  }
}

describe("response contracts", () => {
  let ctx: TestContext;
  let admin: Admin;
  let withPhoto: { id: string; slug: string };
  let draft: { id: string; slug: string };
  let sold: { id: string; slug: string };
  const client = () => as(ctx.app, admin.cookie);
  const base = () => `/stores/${admin.storeId}`;
  const publicGet = (path: string) =>
    request(ctx.app.getHttpServer()).get(`/public/stores/loja-a${path}`);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
    // A second member without a contact number covers the nullable seller fields.
    await addMember(ctx, admin, { email: "bia@example.com", name: "Bia" });

    const created = await client()
      .post(`${base()}/listings`)
      .send({
        title: "Mesa de jantar",
        categoryId: admin.categoryId,
        sellerIds: [admin.sellerId],
        condition: "good",
        priceCents: 45000,
        attributes: [{ label: "Material", value: "Madeira" }],
      })
      .expect(201);
    expectParses(
      "POST /stores/:storeId/listings",
      adminListingDetailSchema,
      created.body,
    );
    withPhoto = created.body;
    await client()
      .post(`${base()}/listings/${withPhoto.id}/images`)
      .attach("files", await photo(), "foto.jpg")
      .expect(201);
    await client()
      .patch(`${base()}/listings/${withPhoto.id}/status`)
      .send({ publication: "published" })
      .expect(200);

    draft = await insertListing(ctx.dataSource, admin, { title: "Rascunho" });
    await insertListing(ctx.dataSource, admin, {
      title: "Sem foto",
      publication: "published",
    });
    sold = await insertListing(ctx.dataSource, admin, {
      title: "Vendido",
      publication: "published",
      availability: "sold",
      priceCents: 1000,
    });
  });
  afterAll(() => ctx.app.close());

  describe("admin", () => {
    it("parses the listing list", async () => {
      const res = await client().get(`${base()}/listings`).expect(200);
      expect(res.body.items).toHaveLength(4);
      for (const item of res.body.items) {
        expectParses(
          "GET /stores/:storeId/listings",
          adminListingSummarySchema,
          item,
        );
      }
    });

    it("parses a listing with photos and one without", async () => {
      for (const id of [withPhoto.id, draft.id]) {
        const res = await client().get(`${base()}/listings/${id}`).expect(200);
        expectParses(
          "GET /stores/:storeId/listings/:id",
          adminListingDetailSchema,
          res.body,
        );
      }
    });

    it("parses a duplicated listing", async () => {
      const res = await client()
        .post(`${base()}/listings/${withPhoto.id}/duplicate`)
        .expect(201);
      expectParses(
        "POST /stores/:storeId/listings/:id/duplicate",
        adminListingDetailSchema,
        res.body,
      );
    });

    it("parses the preview of a draft and of a published listing", async () => {
      for (const id of [withPhoto.id, draft.id]) {
        const res = await client()
          .get(`${base()}/listings/${id}/preview`)
          .expect(200);
        expectParses(
          "GET /stores/:storeId/listings/:id/preview",
          publicListingDetailSchema,
          res.body,
        );
      }
    });

    it("parses the dashboard counts", async () => {
      const res = await client().get(`${base()}/dashboard`).expect(200);
      expectParses(
        "GET /stores/:storeId/dashboard",
        dashboardCountsSchema,
        res.body,
      );
    });

    it("parses the store settings, read and updated", async () => {
      const read = await client().get(base()).expect(200);
      expectParses("GET /stores/:storeId", storeSettingsSchema, read.body);
      const updated = await client()
        .patch(base())
        .send({ headline: "Tudo precisa de um novo lar" })
        .expect(200);
      expectParses("PATCH /stores/:storeId", storeSettingsSchema, updated.body);
    });

    it("parses the categories", async () => {
      const res = await client().get(`${base()}/categories`).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items)
        expectParses("GET /stores/:storeId/categories", categorySchema, item);
    });

    it("parses the sellers, with and without a contact number", async () => {
      const res = await client().get(`${base()}/sellers`).expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(
        res.body.items.map(
          (s: { whatsappNumber: unknown }) => s.whatsappNumber,
        ),
      ).toContain(null);
      for (const item of res.body.items)
        expectParses("GET /stores/:storeId/sellers", sellerSchema, item);
    });

    it("parses the team members", async () => {
      const res = await client().get(`${base()}/members`).expect(200);
      expect(res.body.items).toHaveLength(2);
      for (const item of res.body.items)
        expectParses("GET /stores/:storeId/members", teamMemberSchema, item);
    });

    it("parses me", async () => {
      const res = await client().get("/me").expect(200);
      expectParses("GET /me", meSchema, res.body);
    });

    it("parses an issued invite, the pending list and the invite lookup", async () => {
      const issued = await client()
        .post(`${base()}/invites`)
        .send({ email: "novo@example.com", role: "seller" })
        .expect(201);
      expectParses(
        "POST /stores/:storeId/invites",
        issuedInviteSchema,
        issued.body,
      );

      const list = await client().get(`${base()}/invites`).expect(200);
      expect(list.body.items).toHaveLength(1);
      for (const item of list.body.items) {
        expectParses("GET /stores/:storeId/invites", pendingInviteSchema, item);
      }

      const token = (issued.body.link as string).split("/invite/")[1];
      const lookup = await internalPost(
        ctx.app,
        "/auth/invites/lookup",
        "192.0.2.20",
      )
        .send({ token })
        .expect(200);
      expectParses(
        "POST /auth/invites/lookup",
        inviteDetailsSchema,
        lookup.body,
      );
    });
  });

  describe("mutations", () => {
    it("parses a listing update and a status change", async () => {
      const updated = await client()
        .patch(`${base()}/listings/${draft.id}`)
        .send({ title: "Rascunho novo", priceCents: null })
        .expect(200);
      expectParses(
        "PATCH /stores/:storeId/listings/:id",
        adminListingDetailSchema,
        updated.body,
      );
      const status = await client()
        .patch(`${base()}/listings/${draft.id}/status`)
        .send({ availability: "reserved" })
        .expect(200);
      expectParses(
        "PATCH /stores/:storeId/listings/:id/status",
        adminListingDetailSchema,
        status.body,
      );
    });

    it("parses the image list after upload, reorder and delete", async () => {
      const url = `${base()}/listings/${withPhoto.id}/images`;
      const uploaded = await client()
        .post(url)
        .attach("files", await photo("#336699"), "outra.jpg")
        .expect(201);
      expect(uploaded.body.items).toHaveLength(2);
      for (const item of uploaded.body.items) {
        expectParses(
          "POST /stores/:storeId/listings/:id/images",
          adminImageSchema,
          item,
        );
      }
      const ids = uploaded.body.items.map((item: { id: string }) => item.id);

      const reordered = await client()
        .put(`${url}/order`)
        .send({ ids: [...ids].reverse() })
        .expect(200);
      for (const item of reordered.body.items) {
        expectParses(
          "PUT /stores/:storeId/listings/:id/images/order",
          adminImageSchema,
          item,
        );
      }

      const removed = await client().delete(`${url}/${ids[0]}`).expect(200);
      expect(removed.body.items).toHaveLength(1);
      for (const item of removed.body.items) {
        expectParses(
          "DELETE /stores/:storeId/listings/:id/images/:imageId",
          adminImageSchema,
          item,
        );
      }
    });

    it("parses a member role change", async () => {
      const members = await client().get(`${base()}/members`).expect(200);
      const bia = members.body.items.find(
        (m: { email: string }) => m.email === "bia@example.com",
      );
      const res = await client()
        .patch(`${base()}/members/${bia.userId}`)
        .send({ role: "seller" })
        .expect(200);
      expectParses(
        "PATCH /stores/:storeId/members/:userId",
        teamMemberSchema,
        res.body,
      );
    });

    it("parses a seller update and a new avatar", async () => {
      const updated = await client()
        .patch(`${base()}/sellers/${admin.sellerId}`)
        .send({ displayName: "Ana Souza", whatsappNumber: null })
        .expect(200);
      expectParses(
        "PATCH /stores/:storeId/sellers/:id",
        sellerSchema,
        updated.body,
      );
      const avatar = await client()
        .post(`${base()}/sellers/${admin.sellerId}/avatar`)
        .attach("file", await photo(), "avatar.jpg")
        .expect(201);
      expect(avatar.body.avatarUrl).not.toBeNull();
      expectParses(
        "POST /stores/:storeId/sellers/:id/avatar",
        sellerSchema,
        avatar.body,
      );
    });

    it("parses a regenerated invite", async () => {
      const issued = await client()
        .post(`${base()}/invites`)
        .send({ email: "novo@example.com", role: "admin" })
        .expect(201);
      const res = await client()
        .post(`${base()}/invites/${issued.body.invite.id}/regenerate`)
        .expect(200);
      expectParses(
        "POST /stores/:storeId/invites/:id/regenerate",
        issuedInviteSchema,
        res.body,
      );
    });
  });

  describe("sessions", () => {
    it("parses a login and an accepted invite", async () => {
      const login = await internalPost(ctx.app, "/auth/login", "192.0.2.21")
        .send({ email: admin.email, password: PASSWORD })
        .expect(200);
      expectParses("POST /auth/login", sessionResponseSchema, login.body);

      const issued = await client()
        .post(`${base()}/invites`)
        .send({ email: "nova@example.com", role: "seller" })
        .expect(201);
      const token = (issued.body.link as string).split("/invite/")[1];
      const accepted = await internalPost(
        ctx.app,
        "/auth/invites/accept",
        "192.0.2.22",
      )
        .send({ token, name: "Nova Pessoa", password: PASSWORD })
        .expect(200);
      expectParses(
        "POST /auth/invites/accept",
        sessionResponseSchema,
        accepted.body,
      );
    });
  });

  describe("public", () => {
    it("parses the store", async () => {
      const res = await publicGet("").expect(200);
      expectParses(
        "GET /public/stores/:storeSlug",
        publicStoreSchema,
        res.body,
      );
    });

    it("parses the store index", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/public/stores")
        .expect(200);
      expectParses("GET /public/stores", publicStoreIndexSchema, res.body);
    });

    it("parses the listing page and each of its items", async () => {
      const res = await publicGet("/listings").expect(200);
      expectParses(
        "GET /public/stores/:storeSlug/listings",
        publicListingPageSchema,
        res.body,
      );
      expect(res.body.items).toHaveLength(2);
      for (const item of res.body.items) {
        expectParses(
          "GET /public/stores/:storeSlug/listings",
          publicListingSummarySchema,
          item,
        );
      }
    });

    it("parses a listing with photos, attributes and contact", async () => {
      const res = await publicGet(`/listings/${withPhoto.slug}`).expect(200);
      expect(res.body.canContact).toBe(true);
      expectParses(
        "GET /public/stores/:storeSlug/listings/:listingSlug",
        publicListingDetailSchema,
        res.body,
      );
    });

    it("parses a sold listing without contact data", async () => {
      const res = await publicGet(`/listings/${sold.slug}`).expect(200);
      expect(res.body.canContact).toBe(false);
      expectParses(
        "GET /public/stores/:storeSlug/listings/:listingSlug",
        publicListingDetailSchema,
        res.body,
      );
    });
  });

  // Runs last: it diffs the routes the tests above parsed against the app's.
  it("parses the body of every registered JSON route", () => {
    const uncovered = registeredRoutes(ctx.app)
      .map((route) => `${route.method} ${route.path}`)
      .filter((route) => !NOT_PARSED.has(route) && !parsedRoutes.has(route));
    expect(uncovered).toEqual([]);
  });
});
