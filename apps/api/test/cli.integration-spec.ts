import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { SessionsService } from "@/auth/services/sessions.service";
import { ListingImagesService } from "@/catalog/services/listing-images.service";
import { ListingsService } from "@/catalog/services/listings.service";
import { CommandError, createAdmin, resetPassword } from "@/cli/admin-commands";
import { DEMO_PASSWORD, seedDemo } from "@/cli/seed-demo";
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
  const seed = (whatsapp: string | null = null, target = store) =>
    seedDemo(
      ctx.dataSource,
      {
        stores: ctx.app.get(StoresService),
        listings: ctx.app.get(ListingsService),
        images: ctx.app.get(ListingImagesService),
      },
      { store: target, whatsapp },
    );
  const members = (slug: string) =>
    ctx.dataSource.query(
      `SELECT u.email, m.role, COUNT(s.id)::int AS profiles
         FROM store_members m
         JOIN stores st ON st.id = m.store_id
         JOIN users u ON u.id = m.user_id
         LEFT JOIN sellers s ON s.store_id = m.store_id AND s.user_id = m.user_id
        WHERE st.slug = $1
        GROUP BY u.email, m.role
        ORDER BY u.email`,
      [slug],
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

    it("makes the next member the owner of a store that has members but no owner", async () => {
      const first = await admin("emilio@example.com");
      await ctx.dataSource.query(
        `UPDATE store_members SET role = 'admin' WHERE user_id = $1`,
        [first.userId],
      );
      const next = await admin("noiva@example.com");
      expect(next.role).toBe("owner");
    });

    it("creates a missing store with its default categories, an owner and their contact profile", async () => {
      await admin("emilio@example.com");
      const [created] = await ctx.dataSource.query(
        `SELECT name, (SELECT COUNT(*)::int FROM categories c WHERE c.store_id = s.id) AS categories
           FROM stores s WHERE slug = 'nosso-desapego'`,
      );
      expect(created).toEqual({ name: "Nosso Desapego", categories: 9 });
      expect(await members("nosso-desapego")).toEqual([
        { email: "emilio@example.com", role: "owner", profiles: 1 },
      ]);
    });

    it("keeps an existing store's name and adds later members as admins", async () => {
      await admin("emilio@example.com");
      await admin("noiva@example.com", {
        store: { slug: store.slug, name: "Outro Nome" },
      });
      await admin("amiga@example.com", { store: { slug: store.slug } });
      const [existing] = await ctx.dataSource.query(
        `SELECT name FROM stores WHERE slug = $1`,
        [store.slug],
      );
      expect(existing.name).toBe("Nosso Desapego");
      expect(await members(store.slug)).toEqual([
        { email: "amiga@example.com", role: "admin", profiles: 1 },
        { email: "emilio@example.com", role: "owner", profiles: 1 },
        { email: "noiva@example.com", role: "admin", profiles: 1 },
      ]);
    });

    it("needs a store name to create a store", async () => {
      await expect(
        admin("emilio@example.com", { store: { slug: "nova-loja" } }),
      ).rejects.toThrow(
        'Store "nova-loja" does not exist; pass --store-name to create it.',
      );
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM users`,
      );
      expect(count).toBe(0);
    });

    it("normalizes the email and refuses duplicates", async () => {
      await admin("Emilio@Example.com");
      await expect(admin("emilio@example.com")).rejects.toThrow(
        new CommandError(
          "A user with email emilio@example.com already exists.",
        ),
      );
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

  // The built CLI, as `pnpm cli` runs it: tsx emits no decorator metadata,
  // which Nest needs to inject the app's providers.
  describe("command line", () => {
    const run = (...args: string[]) =>
      promisify(execFile)(process.execPath, ["dist/cli/main.js", ...args], {
        cwd: path.join(__dirname, ".."),
        timeout: 30_000,
      });

    it("creates a store and its owner from the command line", async () => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          "dist/cli/main.js",
          "admin:create",
          "--store",
          "loja-cli",
          "--store-name",
          "Loja da CLI",
          "--email",
          "cli@example.com",
          "--name",
          "Pela CLI",
        ],
        {
          cwd: path.join(__dirname, ".."),
          timeout: 30_000,
          env: { ...process.env, CLOSEOUT_PASSWORD: PASSWORD },
        },
      );
      expect(stdout).toContain(
        "Created owner cli@example.com for store loja-cli.",
      );
      const [created] = await ctx.dataSource.query(
        `SELECT name FROM stores WHERE slug = 'loja-cli'`,
      );
      expect(created).toEqual({ name: "Loja da CLI" });
      expect(await members("loja-cli")).toEqual([
        { email: "cli@example.com", role: "owner", profiles: 1 },
      ]);
    });

    it.each([
      "admin:create",
      "seed:demo",
    ])("refuses %s without --store and prints the usage", async (command) => {
      await expect(
        run(command, "--email", "a@example.com", "--name", "A"),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringMatching(
          /--store is required\.[\s\S]*admin:create --store <slug>/,
        ),
      });
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
      expect(second).toEqual({ created: 0, skipped: true, accounts: [] });

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

    it("creates a demo owner, admin and seller with one contact profile each", async () => {
      const result = await seed();
      const accounts = [
        "admin@nosso-desapego.test",
        "owner@nosso-desapego.test",
        "seller@nosso-desapego.test",
      ];
      expect([...result.accounts].sort()).toEqual(accounts);
      expect(await members(store.slug)).toEqual([
        { email: accounts[0], role: "admin", profiles: 1 },
        { email: accounts[1], role: "owner", profiles: 1 },
        { email: accounts[2], role: "seller", profiles: 1 },
      ]);
      const [{ loginless }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS loginless FROM sellers WHERE user_id IS NULL`,
      );
      expect(loginless).toBe(0);
    });

    it("creates a demo owner for a store whose members include no owner", async () => {
      const existing = await admin("emilio@example.com");
      await ctx.dataSource.query(
        `UPDATE store_members SET role = 'admin' WHERE user_id = $1`,
        [existing.userId],
      );
      const result = await seed();
      expect(result.accounts).toContain("owner@nosso-desapego.test");
      expect(await members(store.slug)).toEqual([
        { email: "admin@nosso-desapego.test", role: "admin", profiles: 1 },
        { email: "emilio@example.com", role: "admin", profiles: 1 },
        { email: "owner@nosso-desapego.test", role: "owner", profiles: 1 },
        { email: "seller@nosso-desapego.test", role: "seller", profiles: 1 },
      ]);
    });

    it("reuses the store's owner instead of creating a second one", async () => {
      await admin("emilio@example.com");
      const result = await seed();
      expect([...result.accounts].sort()).toEqual([
        "admin@nosso-desapego.test",
        "seller@nosso-desapego.test",
      ]);
      expect(await members(store.slug)).toEqual([
        { email: "admin@nosso-desapego.test", role: "admin", profiles: 1 },
        { email: "emilio@example.com", role: "owner", profiles: 1 },
        { email: "seller@nosso-desapego.test", role: "seller", profiles: 1 },
      ]);
    });

    it("seeds two stores without their demo accounts colliding", async () => {
      await seed();
      await seed(null, { slug: "outra-loja", name: "Outra Loja" });
      expect(await members("outra-loja")).toEqual([
        { email: "admin@outra-loja.test", role: "admin", profiles: 1 },
        { email: "owner@outra-loja.test", role: "owner", profiles: 1 },
        { email: "seller@outra-loja.test", role: "seller", profiles: 1 },
      ]);
    });

    it("spreads the listings over every member, sharing at least one", async () => {
      await seed();
      const perListing = await ctx.dataSource.query(
        `SELECT array_agg(m.role ORDER BY m.role) AS roles
           FROM listing_sellers ls
           JOIN sellers s ON s.id = ls.seller_id
           JOIN store_members m ON m.store_id = s.store_id AND m.user_id = s.user_id
          GROUP BY ls.listing_id`,
      );
      const roles: string[][] = perListing.map(
        (row: { roles: string[] }) => row.roles,
      );
      expect(new Set(roles.flat())).toEqual(
        new Set(["owner", "admin", "seller"]),
      );
      expect(roles.some((sellers) => sellers.length === 2)).toBe(true);
    });

    it("lets the demo seller sign in with the demo password", async () => {
      await seed();
      const cookie = await login(
        ctx.app,
        "seller@nosso-desapego.test",
        DEMO_PASSWORD,
      );
      const me = await as(ctx.app, cookie).get("/me").expect(200);
      expect(me.body.memberships).toEqual([
        expect.objectContaining({
          role: "seller",
          store: expect.objectContaining({ slug: store.slug }),
        }),
      ]);
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
                (SELECT COUNT(*)::int FROM sellers) AS sellers,
                (SELECT COUNT(*)::int FROM users) AS users`,
      );
      expect(counts).toEqual({ listings: 0, images: 0, sellers: 0, users: 0 });
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
