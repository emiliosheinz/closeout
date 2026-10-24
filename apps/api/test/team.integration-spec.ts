import request from "supertest";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  login,
  PASSWORD,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

const FORBIDDEN = "Você não tem permissão para esta ação.";

describe("team management", () => {
  let ctx: TestContext;
  let owner: Admin;
  const members = () => `/stores/${owner.storeId}/members`;
  const asOwner = () => as(ctx.app, owner.cookie);
  const exists = async (table: string, column: string, id: string) =>
    (
      await ctx.dataSource.query(
        `SELECT 1 FROM ${table} WHERE ${column} = $1`,
        [id],
      )
    ).length > 0;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    owner = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  it("lists every member with name, email, role and contact profile", async () => {
    const seller = await addMember(ctx, owner, {
      email: "vendedora@example.com",
      name: "Vendedora",
      role: "seller",
    });
    await insertListing(ctx.dataSource, owner, {
      sellerIds: [owner.sellerId, seller.sellerId],
    });
    const res = await asOwner().get(members()).expect(200);
    expect(res.body.items).toEqual([
      {
        userId: expect.any(String),
        name: "Admin loja-a",
        email: "loja-a@example.com",
        role: "owner",
        sellerId: owner.sellerId,
        displayName: "Admin loja-a",
        whatsappNumber: "5511999998888",
        avatarUrl: null,
        listingCount: 1,
      },
      {
        userId: seller.userId,
        name: "Vendedora",
        email: "vendedora@example.com",
        role: "seller",
        sellerId: seller.sellerId,
        displayName: "Vendedora",
        whatsappNumber: null,
        avatarUrl: null,
        listingCount: 1,
      },
    ]);
  });

  describe("changing roles", () => {
    it("judges the member's next request by the new role", async () => {
      const member = await addMember(ctx, owner, {
        email: "socia@example.com",
        name: "Sócia",
      });
      const settings = `/stores/${owner.storeId}`;
      await as(ctx.app, member.cookie)
        .patch(settings)
        .send({ headline: "Antes" })
        .expect(200);

      const demoted = await asOwner()
        .patch(`${members()}/${member.userId}`)
        .send({ role: "seller" })
        .expect(200);
      expect(demoted.body).toMatchObject({
        userId: member.userId,
        role: "seller",
      });
      const refused = await as(ctx.app, member.cookie)
        .patch(settings)
        .send({ headline: "Depois" })
        .expect(403);
      expect(refused.body.message).toBe(FORBIDDEN);

      await asOwner()
        .patch(`${members()}/${member.userId}`)
        .send({ role: "admin" })
        .expect(200);
      await as(ctx.app, member.cookie)
        .patch(settings)
        .send({ headline: "De novo" })
        .expect(200);
    });

    it("refuses to change the owner's role or one's own", async () => {
      const admin = await addMember(ctx, owner, {
        email: "socia@example.com",
        name: "Sócia",
      });
      const [ownerUser] = await ctx.dataSource.query(
        `SELECT user_id FROM store_members WHERE role = 'owner'`,
      );
      const onOwner = await as(ctx.app, admin.cookie)
        .patch(`${members()}/${ownerUser.user_id}`)
        .send({ role: "admin" })
        .expect(403);
      expect(onOwner.body.message).toBe(FORBIDDEN);
      const onSelf = await as(ctx.app, admin.cookie)
        .patch(`${members()}/${admin.userId}`)
        .send({ role: "seller" })
        .expect(403);
      expect(onSelf.body.message).toBe(FORBIDDEN);
      const ownerOnSelf = await asOwner()
        .patch(`${members()}/${ownerUser.user_id}`)
        .send({ role: "admin" })
        .expect(403);
      expect(ownerOnSelf.body.message).toBe(FORBIDDEN);

      const roles = await ctx.dataSource.query(
        `SELECT role FROM store_members ORDER BY created_at`,
      );
      expect(roles).toEqual([{ role: "owner" }, { role: "admin" }]);
    });

    it("rejects owner or unknown values as the new role", async () => {
      const member = await addMember(ctx, owner, {
        email: "socia@example.com",
        name: "Sócia",
      });
      for (const role of ["owner", "manager", ""]) {
        await asOwner()
          .patch(`${members()}/${member.userId}`)
          .send({ role })
          .expect(400);
      }
      const [row] = await ctx.dataSource.query(
        `SELECT role FROM store_members WHERE user_id = $1`,
        [member.userId],
      );
      expect(row.role).toBe("admin");
    });

    it("answers 404 for a member of another store and leaves them unchanged", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const outsider = await addMember(ctx, other, {
        email: "fora@example.com",
        name: "Fora",
      });
      await asOwner()
        .patch(`${members()}/${outsider.userId}`)
        .send({ role: "seller" })
        .expect(404);
      await asOwner()
        .patch(`${members()}/00000000-0000-4000-8000-000000000000`)
        .send({ role: "seller" })
        .expect(404);
      const [row] = await ctx.dataSource.query(
        `SELECT role FROM store_members WHERE user_id = $1`,
        [outsider.userId],
      );
      expect(row.role).toBe("admin");
    });
  });

  describe("removing members", () => {
    it("refuses while the member is the only seller of listings, naming how many", async () => {
      const member = await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
      });
      for (const publication of ["draft", "published", "archived"] as const) {
        await insertListing(ctx.dataSource, owner, {
          publication,
          sellerIds: [member.sellerId],
        });
      }
      await insertListing(ctx.dataSource, owner, {
        sellerIds: [member.sellerId, owner.sellerId],
      });

      const res = await asOwner()
        .delete(`${members()}/${member.userId}`)
        .expect(409);
      expect(res.body.message).toBe(
        "Reatribua os 3 anúncios em que esta pessoa é a única vendedora antes de removê-la.",
      );
      expect(await exists("users", "id", member.userId)).toBe(true);
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM listing_sellers WHERE seller_id = $1`,
        [member.sellerId],
      );
      expect(count).toBe(4);
      await as(ctx.app, member.cookie).get("/me").expect(200);
    });

    it("names a single listing in the singular when refusing", async () => {
      const member = await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
      });
      await insertListing(ctx.dataSource, owner, {
        sellerIds: [member.sellerId],
      });
      const res = await asOwner()
        .delete(`${members()}/${member.userId}`)
        .expect(409);
      expect(res.body.message).toBe(
        "Reatribua o 1 anúncio em que esta pessoa é a única vendedora antes de removê-la.",
      );
      expect(await exists("users", "id", member.userId)).toBe(true);
      expect(await exists("sellers", "id", member.sellerId)).toBe(true);
    });

    it("deletes the account, unassigns it from shared listings and ends every session", async () => {
      const member = await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
        whatsapp: "+55 21 97777-1234",
      });
      await as(ctx.app, member.cookie)
        .post(`/stores/${owner.storeId}/sellers/${member.sellerId}/avatar`)
        .attach("file", await photo(), "a.jpg")
        .expect(201);
      const [{ avatar_key: avatarKey }] = await ctx.dataSource.query(
        `SELECT avatar_key FROM sellers WHERE id = $1`,
        [member.sellerId],
      );
      const avatar = `/media/${avatarKey}-sm.webp`;
      await request(ctx.app.getHttpServer()).get(avatar).expect(200);
      const secondSession = await login(
        ctx.app,
        "vendedora@example.com",
        PASSWORD,
      );
      const shared = await insertListing(ctx.dataSource, owner, {
        sellerIds: [member.sellerId, owner.sellerId],
      });

      await asOwner().delete(`${members()}/${member.userId}`).expect(204);

      expect(await exists("users", "id", member.userId)).toBe(false);
      expect(await exists("store_members", "user_id", member.userId)).toBe(
        false,
      );
      expect(await exists("sellers", "id", member.sellerId)).toBe(false);
      const detail = await asOwner()
        .get(`/stores/${owner.storeId}/listings/${shared.id}`)
        .expect(200);
      expect(detail.body.sellers).toEqual([
        { id: owner.sellerId, displayName: "Admin loja-a" },
      ]);
      for (const cookie of [member.cookie, secondSession]) {
        await as(ctx.app, cookie).get("/me").expect(401);
        await as(ctx.app, cookie)
          .get(`/stores/${owner.storeId}/listings`)
          .expect(401);
      }
      await request(ctx.app.getHttpServer()).get(avatar).expect(404);
    });

    it("leaves a shared listing without contact when the remaining sellers have no WhatsApp", async () => {
      const reachable = await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
        whatsapp: "+55 21 97777-1234",
      });
      const unreachable = await addMember(ctx, owner, {
        email: "parceira@example.com",
        name: "Parceira",
        role: "seller",
      });
      const listing = await insertListing(ctx.dataSource, owner, {
        publication: "published",
        sellerIds: [reachable.sellerId, unreachable.sellerId],
      });
      const page = `/public/stores/loja-a/listings/${listing.slug}`;
      const before = await request(ctx.app.getHttpServer())
        .get(page)
        .expect(200);
      expect(before.body.canContact).toBe(true);

      await asOwner().delete(`${members()}/${reachable.userId}`).expect(204);

      const after = await request(ctx.app.getHttpServer())
        .get(page)
        .expect(200);
      expect(after.body).toMatchObject({
        canContact: false,
        sellers: [{ name: "Parceira", whatsappNumber: null }],
      });
    });

    it("refuses to remove the owner or oneself", async () => {
      const admin = await addMember(ctx, owner, {
        email: "socia@example.com",
        name: "Sócia",
      });
      const [ownerUser] = await ctx.dataSource.query(
        `SELECT user_id FROM store_members WHERE role = 'owner'`,
      );
      for (const [cookie, target] of [
        [admin.cookie, ownerUser.user_id],
        [admin.cookie, admin.userId],
        [owner.cookie, ownerUser.user_id],
      ]) {
        const res = await as(ctx.app, cookie)
          .delete(`${members()}/${target}`)
          .expect(403);
        expect(res.body.message).toBe(FORBIDDEN);
      }
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM users`,
      );
      expect(count).toBe(2);
    });

    it("answers 404 for a member of another store and keeps their account", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const outsider = await addMember(ctx, other, {
        email: "fora@example.com",
        name: "Fora",
      });
      await asOwner().delete(`${members()}/${outsider.userId}`).expect(404);
      expect(await exists("users", "id", outsider.userId)).toBe(true);
      await as(ctx.app, outsider.cookie).get("/me").expect(200);
    });

    it("treats a removed member's email as new when invited again", async () => {
      const member = await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
      });
      await asOwner().delete(`${members()}/${member.userId}`).expect(204);
      const res = await asOwner()
        .post(`/stores/${owner.storeId}/invites`)
        .send({ email: "vendedora@example.com", role: "seller" })
        .expect(201);
      expect(res.body.invite).toMatchObject({
        email: "vendedora@example.com",
        role: "seller",
      });
    });
  });
});
