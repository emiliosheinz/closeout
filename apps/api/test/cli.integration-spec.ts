import { execFile } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { promisify } from "node:util";
import { SessionsService } from "@/auth/services/sessions.service";
import { ListingImagesService } from "@/catalog/services/listing-images.service";
import { ListingsService } from "@/catalog/services/listings.service";
import { CommandError, createAdmin, resetPassword } from "@/cli/admin-commands";
import { DEMO_PASSWORD, seedDemo } from "@/cli/seed-demo";
import { listWaitlist, removeWaitlistSignup } from "@/cli/waitlist-commands";
import { StoresService } from "@/stores/services/stores.service";
import { WaitlistService } from "@/waitlist/services/waitlist.service";
import { type BuiltProcess, runInApi } from "./child-process";
import {
  as,
  createTestApp,
  internalPost,
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
      ).rejects.toThrow("A senha precisa ter pelo menos 10 caracteres.");
      await expect(admin("not-an-email")).rejects.toThrow(
        "Informe um e-mail válido.",
      );
      await expect(
        admin("a@example.com", { whatsapp: "11 99999-8888" }),
      ).rejects.toThrow(
        "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
      );
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

    it("boots without the server's port, host or internal secret", async () => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          "dist/cli/main.js",
          "admin:create",
          "--store",
          "loja-operador",
          "--store-name",
          "Loja do Operador",
          "--email",
          "operador@example.com",
          "--name",
          "Operador",
        ],
        {
          cwd: path.join(__dirname, ".."),
          timeout: 30_000,
          env: {
            ...process.env,
            PORT: undefined,
            HOST: undefined,
            INTERNAL_API_SECRET: undefined,
            CLOSEOUT_PASSWORD: PASSWORD,
          },
        },
      );
      expect(stdout).toContain(
        "Created owner operador@example.com for store loja-operador.",
      );
    });

    /** Run the built CLI; with no `CLOSEOUT_PASSWORD`, answer its prompts on a fake TTY. */
    const cli = async (
      args: string[],
      password: { env: string } | { typed: string },
    ) => {
      const proc: BuiltProcess = runInApi(
        process.execPath,
        [
          "--import",
          "data:text/javascript,process.stdin.isTTY=true",
          "dist/cli/main.js",
          ...args,
        ],
        { CLOSEOUT_PASSWORD: "env" in password ? password.env : undefined },
      );
      if ("typed" in password) {
        let answered = 0;
        proc.child.stdout?.on("data", () => {
          const prompts = proc.stdout().split("assword: ").length - 1;
          for (; answered < prompts; answered++) {
            proc.child.stdin?.write(`${password.typed}\n`);
          }
          // Both prompts answered: the operator's terminal has nothing more to send.
          if (answered === 2) proc.child.stdin?.end();
        });
      }
      const [code] = await once(proc.child, "close");
      return { code, output: proc.stdout() + proc.stderr() };
    };
    const createArgs = (fields: Record<string, string> = {}) =>
      Object.entries({
        store: "loja-cli",
        "store-name": "Loja da CLI",
        email: "cli@example.com",
        name: "Pela CLI",
        ...fields,
      }).flatMap(([flag, value]) => [`--${flag}`, value]);

    // The API's message for the same field: login checks the email, invite
    // acceptance the name, password and WhatsApp number of a new account.
    const apiMessage = async (field: string, value: string) => {
      const res =
        field === "email"
          ? await internalPost(ctx.app, "/auth/login", "192.0.2.40").send({
              email: value,
              password: PASSWORD,
            })
          : await internalPost(
              ctx.app,
              "/auth/invites/accept",
              "192.0.2.40",
            ).send({
              token: "any-token",
              name: "Nova Pessoa",
              password: PASSWORD,
              [field]: value,
            });
      expect(res.status).toBe(400);
      const error = res.body.errors.find(
        (e: { pointer: string }) => e.pointer === `/${field}`,
      );
      return error.detail as string;
    };

    const flags: Record<string, string> = {
      email: "email",
      name: "name",
      whatsappNumber: "whatsapp",
    };

    it.each([
      ["email", "not-an-email"],
      ["name", "   "],
      ["password", "short-pw"],
      ["whatsappNumber", "11 99999-8888"],
    ])("refuses an invalid %s with the API's message", async (field, value) => {
      const message = await apiMessage(field, value);
      const flag = flags[field];

      const result = await cli(
        ["admin:create", ...createArgs(flag ? { [flag]: value } : {})],
        { env: field === "password" ? value : PASSWORD },
      );

      expect(result.code).not.toBe(0);
      expect(result.output).toContain(message);
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM users`,
      );
      expect(count).toBe(0);
    });

    it("reports only the first message when several fields are invalid", async () => {
      const result = await cli(
        ["admin:create", ...createArgs({ name: "  " })],
        { env: "short-pw" },
      );

      expect(result.code).not.toBe(0);
      expect(result.output).toContain("Informe seu nome.");
      expect(result.output).not.toContain(
        "A senha precisa ter pelo menos 10 caracteres.",
      );
    });

    it("refuses a blank name with the API's message", async () => {
      const result = await cli(
        ["admin:create", ...createArgs({ name: "  " })],
        {
          env: PASSWORD,
        },
      );

      expect(result.code).not.toBe(0);
      expect(result.output).toContain("Informe seu nome.");
    });

    it("refuses a name over 60 characters and a password over 200", async () => {
      const longName = await cli(
        ["admin:create", ...createArgs({ name: "n".repeat(61) })],
        { env: PASSWORD },
      );
      const longPassword = await cli(["admin:create", ...createArgs()], {
        env: "p".repeat(201),
      });

      expect(longName.code).not.toBe(0);
      expect(longName.output).toContain("Use até 60 caracteres no nome.");
      expect(longPassword.code).not.toBe(0);
      expect(longPassword.output).toContain("Use até 200 caracteres na senha.");
    });

    it("does not echo a refused WhatsApp number", async () => {
      const typed = "21 91234-5678";
      const result = await cli(
        ["admin:create", ...createArgs({ whatsapp: typed })],
        { env: PASSWORD },
      );

      expect(result.code).not.toBe(0);
      expect(result.output).toContain(
        "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
      );
      expect(result.output).not.toContain(typed);
    });

    it("creates the member without a number when --whatsapp is empty", async () => {
      const result = await cli(
        ["admin:create", ...createArgs({ whatsapp: "" })],
        { env: PASSWORD },
      );

      expect(result.code).toBe(0);
      const sellers = await ctx.dataSource.query(
        `SELECT whatsapp_number FROM sellers`,
      );
      expect(sellers).toEqual([{ whatsapp_number: null }]);
    });

    it.each([
      ["from the environment", "env"],
      ["typed at the prompt", "typed"],
    ] as const)("never prints a password %s", async (_, source) => {
      const valid = "sentinel-valid-password";
      const invalid = "Xq7-short";
      const password = (value: string) =>
        source === "env" ? { env: value } : { typed: value };

      const created = await cli(
        ["admin:create", ...createArgs()],
        password(valid),
      );
      const refused = await cli(
        ["admin:create", ...createArgs({ email: "outra@example.com" })],
        password(invalid),
      );

      expect(created.code).toBe(0);
      expect(created.output).toContain(
        "Created owner cli@example.com for store loja-cli.",
      );
      expect(refused.code).not.toBe(0);
      expect(refused.output).toContain(
        "A senha precisa ter pelo menos 10 caracteres.",
      );
      expect(created.output).not.toContain(valid);
      expect(refused.output).not.toContain(invalid);
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

    it("refuses a malformed email with the API's message", async () => {
      await expect(
        resetPassword(ctx.dataSource, ctx.app.get(SessionsService), {
          email: "not-an-email",
          password: PASSWORD,
        }),
      ).rejects.toThrow(new CommandError("Informe um e-mail válido."));
    });

    it("finds the user whatever the email's case or padding", async () => {
      await admin("emilio@example.com");
      await resetPassword(ctx.dataSource, ctx.app.get(SessionsService), {
        email: " Emilio@Example.com ",
        password: "a brand new passphrase",
      });
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

  describe("waitlist", () => {
    const waitlist = () => ctx.app.get(WaitlistService);
    const insert = (
      contact: string,
      createdAt: string,
      fields: { name?: string; ref?: string | null; src?: string | null } = {},
    ) =>
      ctx.dataSource.query(
        `INSERT INTO waitlist_signups (name, channel, contact, ref, src, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          fields.name ?? "Ana",
          contact.includes("@") ? "email" : "whatsapp",
          contact,
          fields.ref ?? null,
          fields.src ?? null,
          createdAt,
        ],
      );
    const contacts = async (): Promise<string[]> =>
      (
        await ctx.dataSource.query(
          `SELECT contact FROM waitlist_signups ORDER BY contact`,
        )
      ).map((row: { contact: string }) => row.contact);
    const run = async (args: string[]) => {
      const proc = runInApi(process.execPath, ["dist/cli/main.js", ...args]);
      const exit = await proc.exit;
      return { code: exit.code, stdout: proc.stdout(), stderr: proc.stderr() };
    };

    describe("waitlist:list", () => {
      it("prints only the header when there are no signups", async () => {
        expect(await listWaitlist(waitlist())).toBe(
          "created_at,name,channel,contact,ref,src",
        );
      });

      it("prints signups newest first with empty cells for a missing ref and src", async () => {
        await insert("5511999998888", "2026-10-30T12:00:00.000Z", {
          name: "Ana",
          ref: "loja-x",
          src: "catalog-footer",
        });
        await insert("bia@example.com", "2026-10-31T08:30:00.123Z", {
          name: "Bia",
        });
        await insert("caio@example.com", "2026-10-29T23:59:59.999Z", {
          name: "Caio",
          ref: "loja-y",
          src: "login",
        });

        expect(await listWaitlist(waitlist())).toBe(
          [
            "created_at,name,channel,contact,ref,src",
            "2026-10-31T08:30:00.123Z,Bia,email,bia@example.com,,",
            "2026-10-30T12:00:00.000Z,Ana,whatsapp,5511999998888,loja-x,catalog-footer",
            "2026-10-29T23:59:59.999Z,Caio,email,caio@example.com,loja-y,login",
          ].join("\n"),
        );
      });

      it.each([
        ["a comma", "Ana, B", '"Ana, B"'],
        ["a double quote", 'Ana "A"', '"Ana ""A"""'],
        ["a line break", "Ana\nB", '"Ana\nB"'],
        ["a comma and a double quote", 'Ana "A", B', '"Ana ""A"", B"'],
        ["a leading equals sign", "=a,b", `"'=a,b"`],
        ["a leading plus", "+1", "'+1"],
        ["a leading minus", "-1", "'-1"],
        ["a leading at sign", "@x", "'@x"],
        ["a leading quote", "'x", "''x"],
        ["no special character", "Ana B", "Ana B"],
      ])("writes a name with %s", async (_label, name, expected) => {
        await insert("a@example.com", "2026-10-30T12:00:00.000Z", { name });
        const [, row] = (await listWaitlist(waitlist())).split(/\n(?=2026)/);
        expect(row).toBe(
          `2026-10-30T12:00:00.000Z,${expected},email,a@example.com,,`,
        );
      });

      it("guards a contact that starts with a plus or a quote", async () => {
        await insert("+a@x.co", "2026-10-30T12:00:00.000Z");
        await insert("'b@x.co", "2026-10-29T12:00:00.000Z");
        expect(await listWaitlist(waitlist())).toBe(
          [
            "created_at,name,channel,contact,ref,src",
            "2026-10-30T12:00:00.000Z,Ana,email,'+a@x.co,,",
            "2026-10-29T12:00:00.000Z,Ana,email,''b@x.co,,",
          ].join("\n"),
        );
      });

      it("prints exactly the CSV on stdout from the built command and exits 0", async () => {
        await insert("5511999998888", "2026-10-30T12:00:00.000Z", {
          ref: "loja-x",
          src: "landing",
        });
        const { code, stdout, stderr } = await run(["waitlist:list"]);
        expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
        expect(stdout).toBe(
          "created_at,name,channel,contact,ref,src\n2026-10-30T12:00:00.000Z,Ana,whatsapp,5511999998888,loja-x,landing\n",
        );
      });
    });

    describe("waitlist:remove", () => {
      beforeEach(async () => {
        await insert("ana@example.com", "2026-10-30T12:00:00.000Z");
        await insert("5511999998888", "2026-10-30T12:00:01.000Z");
        await insert("+a@x.co", "2026-10-30T12:00:02.000Z");
        await insert("'b@x.co", "2026-10-30T12:00:03.000Z");
        await insert("b@x.co", "2026-10-30T12:00:04.000Z");
      });

      it("removes an e-mail typed with spaces and capitals", async () => {
        expect(
          await removeWaitlistSignup(waitlist(), " Ana@Example.com "),
        ).toBe("Removed waitlist signup ana@example.com.");
        expect(await contacts()).toEqual([
          "'b@x.co",
          "+a@x.co",
          "5511999998888",
          "b@x.co",
        ]);
      });

      it.each([
        "+55 (11) 99999-8888",
        "5511999998888",
      ])("removes the phone signup given as %s", async (input) => {
        expect(await removeWaitlistSignup(waitlist(), input)).toBe(
          "Removed waitlist signup 5511999998888.",
        );
        expect(await contacts()).toEqual([
          "'b@x.co",
          "+a@x.co",
          "ana@example.com",
          "b@x.co",
        ]);
      });

      it("removes a contact copied from a guarded cell", async () => {
        await removeWaitlistSignup(waitlist(), "'+a@x.co");
        expect(await contacts()).toEqual([
          "'b@x.co",
          "5511999998888",
          "ana@example.com",
          "b@x.co",
        ]);
      });

      it("drops only one leading quote, so a quoted contact is told from its plain twin", async () => {
        await removeWaitlistSignup(waitlist(), "''b@x.co");
        expect(await contacts()).toEqual([
          "+a@x.co",
          "5511999998888",
          "ana@example.com",
          "b@x.co",
        ]);
      });

      it("refuses an unknown contact and deletes nothing", async () => {
        await expect(
          removeWaitlistSignup(waitlist(), " Nobody@Example.com"),
        ).rejects.toThrow(
          new CommandError("No waitlist signup for nobody@example.com."),
        );
        expect(await contacts()).toHaveLength(5);
      });

      it.each([
        "",
        "   ",
        "'",
        "abc",
      ])("refuses %j as a contact that is empty once normalized", async (input) => {
        await expect(removeWaitlistSignup(waitlist(), input)).rejects.toThrow(
          /--contact/,
        );
        expect(await contacts()).toHaveLength(5);
      });

      it("prints the removal on stdout and exits 0 from the built command", async () => {
        const { code, stdout, stderr } = await run([
          "waitlist:remove",
          "--contact",
          "5511999998888",
        ]);
        expect({ code, stdout, stderr }).toEqual({
          code: 0,
          stdout: "Removed waitlist signup 5511999998888.\n",
          stderr: "",
        });
        expect(await contacts()).toHaveLength(4);
      });

      it("prints the miss on stderr and exits 1 from the built command", async () => {
        const { code, stdout, stderr } = await run([
          "waitlist:remove",
          "--contact",
          " Nobody@Example.com ",
        ]);
        expect({ code, stdout, stderr }).toEqual({
          code: 1,
          stdout: "",
          stderr: "No waitlist signup for nobody@example.com.\n",
        });
        expect(await contacts()).toHaveLength(5);
      });

      it("exits 1 naming --contact when the flag is missing", async () => {
        const { code, stdout, stderr } = await run(["waitlist:remove"]);
        expect(code).toBe(1);
        expect(stdout).toBe("");
        expect(stderr).toContain("--contact");
        expect(await contacts()).toHaveLength(5);
      });
    });
  });
});
