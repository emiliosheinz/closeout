import { SessionsService } from "@/auth/services/sessions.service";
import { ListingImagesService } from "@/catalog/services/listing-images.service";
import { ListingsService } from "@/catalog/services/listings.service";
import { CommandError, createAdmin, resetPassword } from "@/cli/admin-commands";
import { seedDemo } from "@/cli/seed-demo";
import { StoresService } from "@/stores/services/stores.service";
import {
  as,
  createTestApp,
  login,
  PASSWORD,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("operator commands", () => {
  let ctx: TestContext;
  const store = { slug: "nosso-desapego", name: "Nosso Desapego" };
  const admin = (
    email: string,
    extra: Partial<Parameters<typeof createAdmin>[2]> = {},
  ) =>
    createAdmin(ctx.dataSource, ctx.app.get(StoresService), {
      email,
      name: email.split("@")[0] ?? email,
      password: PASSWORD,
      store,
      ...extra,
    });
  const seed = (whatsapp: string | null = null) =>
    seedDemo(
      ctx.dataSource,
      {
        stores: ctx.app.get(StoresService),
        listings: ctx.app.get(ListingsService),
        images: ctx.app.get(ListingImagesService),
      },
      { store, whatsapp },
    );

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDatabase(ctx.dataSource));
  afterAll(() => ctx.app.close());

  describe("admin:create", () => {
    it("makes the first admin the owner and the second an admin of the same store", async () => {
      const first = await admin("emilio@example.com", {
        whatsapp: "+55 11 98888-7777",
      });
      const second = await admin("noiva@example.com");
      expect(first.role).toBe("owner");
      expect(second.role).toBe("admin");
      expect(second.storeId).toBe(first.storeId);

      const sellers = await ctx.dataSource.query(
        `SELECT display_name, whatsapp_number, user_id FROM sellers ORDER BY created_at`,
      );
      expect(sellers).toEqual([
        {
          display_name: "emilio",
          whatsapp_number: "5511988887777",
          user_id: first.userId,
        },
        {
          display_name: "noiva",
          whatsapp_number: null,
          user_id: second.userId,
        },
      ]);
    });

    it("normalizes the email and refuses duplicates", async () => {
      await admin("Emilio@Example.com");
      await expect(admin("emilio@example.com")).rejects.toThrow(CommandError);
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM users`,
      );
      expect(count).toBe(1);
    });

    it("rejects weak passwords, bad emails, invalid numbers and slugs before writing", async () => {
      await expect(
        admin("a@example.com", { password: "short" }),
      ).rejects.toThrow(/at least 10/);
      await expect(admin("not-an-email")).rejects.toThrow(/Invalid email/);
      await expect(
        admin("a@example.com", { whatsapp: "11 99999-8888" }),
      ).rejects.toThrow(/country code/);
      await expect(
        admin("a@example.com", { store: { slug: "Bad Slug", name: "x" } }),
      ).rejects.toThrow(/Invalid store slug/);
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM stores`,
      );
      expect(count).toBe(0);
    });
  });

  describe("admin:password", () => {
    it("replaces the password and signs out existing sessions", async () => {
      await admin("emilio@example.com");
      const oldCookie = await login(ctx.app, "emilio@example.com", PASSWORD);
      await as(ctx.app, oldCookie).get("/me").expect(200);

      await resetPassword(ctx.dataSource, ctx.app.get(SessionsService), {
        email: "emilio@example.com",
        password: "a brand new passphrase",
      });

      await as(ctx.app, oldCookie).get("/me").expect(401);
      await login(ctx.app, "emilio@example.com", "a brand new passphrase");
    });

    it("refuses unknown users", async () => {
      await expect(
        resetPassword(ctx.dataSource, ctx.app.get(SessionsService), {
          email: "ghost@example.com",
          password: PASSWORD,
        }),
      ).rejects.toThrow(/No user/);
    });
  });

  describe("seed:demo", () => {
    it("creates clearly marked demo listings once and skips on later runs", async () => {
      const first = await seed();
      const second = await seed();
      expect(first.skipped).toBe(false);
      expect(second).toEqual({ created: 0, skipped: true });

      const listings = await ctx.dataSource.query(
        `SELECT title, description, attributes, publication FROM listings`,
      );
      expect(listings).toHaveLength(first.created);
      for (const listing of listings) {
        expect(listing.description).toContain("Anúncio de demonstração");
        expect(listing.attributes).toContainEqual({
          label: "Observação",
          value: "Anúncio de demonstração",
        });
      }
      expect(
        listings.some(
          (l: { publication: string }) => l.publication === "draft",
        ),
      ).toBe(true);
    });

    it("never invents seller phone numbers", async () => {
      await seed();
      const numbers = await ctx.dataSource.query(
        `SELECT whatsapp_number FROM sellers`,
      );
      expect(
        numbers.every(
          (s: { whatsapp_number: string | null }) => s.whatsapp_number === null,
        ),
      ).toBe(true);
    });

    it("uses an explicitly given number for the demo sellers", async () => {
      await seed("5511977776666");
      const numbers = await ctx.dataSource.query(
        `SELECT DISTINCT whatsapp_number FROM sellers`,
      );
      expect(numbers).toEqual([{ whatsapp_number: "5511977776666" }]);
    });

    it("removes everything it created when a step fails halfway", async () => {
      const images = ctx.app.get(ListingImagesService);
      let calls = 0;
      const failing = {
        add: (...args: Parameters<ListingImagesService["add"]>) => {
          calls += 1;
          if (calls === 2) return Promise.reject(new Error("disk full"));
          return images.add(...args);
        },
      } as ListingImagesService;
      await expect(
        seedDemo(
          ctx.dataSource,
          {
            stores: ctx.app.get(StoresService),
            listings: ctx.app.get(ListingsService),
            images: failing,
          },
          { store, whatsapp: null },
        ),
      ).rejects.toThrow("disk full");
      const [counts] = await ctx.dataSource.query(
        `SELECT (SELECT COUNT(*)::int FROM listings) AS listings,
                (SELECT COUNT(*)::int FROM listing_images) AS images,
                (SELECT COUNT(*)::int FROM sellers) AS sellers`,
      );
      expect(counts).toEqual({ listings: 0, images: 0, sellers: 0 });
      expect((await seed()).skipped).toBe(false);
    });

    it("gives every published demo listing a photo", async () => {
      await seed();
      const rows = await ctx.dataSource.query(
        `SELECT l.title FROM listings l
         WHERE l.publication = 'published'
           AND NOT EXISTS (SELECT 1 FROM listing_images i WHERE i.listing_id = l.id)`,
      );
      expect(rows).toEqual([]);
    });
  });
});
