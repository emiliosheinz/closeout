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
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

/** Fails with the schema's issues in the message instead of a bare boolean. */
function expectParses(
  schema: {
    safeParse(body: unknown): {
      success: boolean;
      error?: { issues: unknown[] };
    };
  },
  body: unknown,
): void {
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
    expectParses(adminListingDetailSchema, created.body);
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
        expectParses(adminListingSummarySchema, item);
      }
    });

    it("parses a listing with photos and one without", async () => {
      for (const id of [withPhoto.id, draft.id]) {
        const res = await client().get(`${base()}/listings/${id}`).expect(200);
        expectParses(adminListingDetailSchema, res.body);
      }
    });

    it("parses a duplicated listing", async () => {
      const res = await client()
        .post(`${base()}/listings/${withPhoto.id}/duplicate`)
        .expect(201);
      expectParses(adminListingDetailSchema, res.body);
    });

    it("parses the preview of a draft and of a published listing", async () => {
      for (const id of [withPhoto.id, draft.id]) {
        const res = await client()
          .get(`${base()}/listings/${id}/preview`)
          .expect(200);
        expectParses(publicListingDetailSchema, res.body);
      }
    });

    it("parses the dashboard counts", async () => {
      const res = await client().get(`${base()}/dashboard`).expect(200);
      expectParses(dashboardCountsSchema, res.body);
    });

    it("parses the store settings, read and updated", async () => {
      const read = await client().get(base()).expect(200);
      expectParses(storeSettingsSchema, read.body);
      const updated = await client()
        .patch(base())
        .send({ headline: "Tudo precisa de um novo lar" })
        .expect(200);
      expectParses(storeSettingsSchema, updated.body);
    });

    it("parses the categories", async () => {
      const res = await client().get(`${base()}/categories`).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items) expectParses(categorySchema, item);
    });

    it("parses the sellers, with and without a contact number", async () => {
      const res = await client().get(`${base()}/sellers`).expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(
        res.body.items.map(
          (s: { whatsappNumber: unknown }) => s.whatsappNumber,
        ),
      ).toContain(null);
      for (const item of res.body.items) expectParses(sellerSchema, item);
    });

    it("parses the team members", async () => {
      const res = await client().get(`${base()}/members`).expect(200);
      expect(res.body.items).toHaveLength(2);
      for (const item of res.body.items) expectParses(teamMemberSchema, item);
    });

    it("parses me", async () => {
      const res = await client().get("/me").expect(200);
      expectParses(meSchema, res.body);
    });

    it("parses an issued invite, the pending list and the invite lookup", async () => {
      const issued = await client()
        .post(`${base()}/invites`)
        .send({ email: "novo@example.com", role: "seller" })
        .expect(201);
      expectParses(issuedInviteSchema, issued.body);

      const list = await client().get(`${base()}/invites`).expect(200);
      expect(list.body.items).toHaveLength(1);
      for (const item of list.body.items) {
        expectParses(pendingInviteSchema, item);
      }

      const token = (issued.body.link as string).split("/invite/")[1];
      const lookup = await internalPost(
        ctx.app,
        "/auth/invites/lookup",
        "192.0.2.20",
      )
        .send({ token })
        .expect(200);
      expectParses(inviteDetailsSchema, lookup.body);
    });
  });

  describe("mutations", () => {
    it("parses a listing update and a status change", async () => {
      const updated = await client()
        .patch(`${base()}/listings/${draft.id}`)
        .send({ title: "Rascunho novo", priceCents: null })
        .expect(200);
      expectParses(adminListingDetailSchema, updated.body);
      const status = await client()
        .patch(`${base()}/listings/${draft.id}/status`)
        .send({ availability: "reserved" })
        .expect(200);
      expectParses(adminListingDetailSchema, status.body);
    });

    it("parses the image list after upload, reorder and delete", async () => {
      const url = `${base()}/listings/${withPhoto.id}/images`;
      const uploaded = await client()
        .post(url)
        .attach("files", await photo("#336699"), "outra.jpg")
        .expect(201);
      expect(uploaded.body.items).toHaveLength(2);
      for (const item of uploaded.body.items) {
        expectParses(adminImageSchema, item);
      }
      const ids = uploaded.body.items.map((item: { id: string }) => item.id);

      const reordered = await client()
        .put(`${url}/order`)
        .send({ ids: [...ids].reverse() })
        .expect(200);
      for (const item of reordered.body.items) {
        expectParses(adminImageSchema, item);
      }

      const removed = await client().delete(`${url}/${ids[0]}`).expect(200);
      expect(removed.body.items).toHaveLength(1);
      for (const item of removed.body.items) {
        expectParses(adminImageSchema, item);
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
      expectParses(teamMemberSchema, res.body);
    });

    it("parses a seller update and a new avatar", async () => {
      const updated = await client()
        .patch(`${base()}/sellers/${admin.sellerId}`)
        .send({ displayName: "Ana Souza", whatsappNumber: null })
        .expect(200);
      expectParses(sellerSchema, updated.body);
      const avatar = await client()
        .post(`${base()}/sellers/${admin.sellerId}/avatar`)
        .attach("file", await photo(), "avatar.jpg")
        .expect(201);
      expect(avatar.body.avatarUrl).not.toBeNull();
      expectParses(sellerSchema, avatar.body);
    });

    it("parses a regenerated invite", async () => {
      const issued = await client()
        .post(`${base()}/invites`)
        .send({ email: "novo@example.com", role: "admin" })
        .expect(201);
      const res = await client()
        .post(`${base()}/invites/${issued.body.invite.id}/regenerate`)
        .expect(200);
      expectParses(issuedInviteSchema, res.body);
    });
  });

  describe("public", () => {
    it("parses the store", async () => {
      const res = await publicGet("").expect(200);
      expectParses(publicStoreSchema, res.body);
    });

    it("parses the store index", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/public/stores")
        .expect(200);
      expectParses(publicStoreIndexSchema, res.body);
    });

    it("parses the listing page and each of its items", async () => {
      const res = await publicGet("/listings").expect(200);
      expectParses(publicListingPageSchema, res.body);
      expect(res.body.items).toHaveLength(2);
      for (const item of res.body.items) {
        expectParses(publicListingSummarySchema, item);
      }
    });

    it("parses a listing with photos, attributes and contact", async () => {
      const res = await publicGet(`/listings/${withPhoto.slug}`).expect(200);
      expect(res.body.canContact).toBe(true);
      expectParses(publicListingDetailSchema, res.body);
    });

    it("parses a sold listing without contact data", async () => {
      const res = await publicGet(`/listings/${sold.slug}`).expect(200);
      expect(res.body.canContact).toBe(false);
      expectParses(publicListingDetailSchema, res.body);
    });
  });
});
