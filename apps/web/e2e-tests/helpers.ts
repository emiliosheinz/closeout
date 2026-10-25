import {
  type APIRequestContext,
  expect,
  type Page,
  request,
} from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
/** Seller provisioned for the admin account in docker-compose.e2e.yaml. */
export const ADMIN_WHATSAPP = "5511988887777";

/** Absolute origin the app is configured with (PUBLIC_BASE_URL in the stack). */
export const BASE_URL = process.env.E2E_APP_BASE_URL ?? "http://web:3001";
/** The store the admin owns, seeded with demo members and listings. */
export const STORE = "/store/loja-e2e";
/** A second store with only its owner, for isolation checks. */
export const OTHER_STORE = "/store/outra-loja";
/** Its owner; every CLI-created account in the stack uses ADMIN_PASSWORD. */
export const OTHER_OWNER_EMAIL = "dono@outra-loja.test";

/**
 * Wait until client components are interactive. In the e2e stack pages
 * compile on first visit, so a fast test can otherwise act on server HTML
 * before React has attached its handlers.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

export async function signIn(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<void> {
  await page.goto("/admin/entrar");
  await hydrated(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Anúncios", level: 1 }),
  ).toBeVisible();
  await hydrated(page);
}

/**
 * The admin listing table's item rows. Hidden rows count too, because an open
 * modal dialog marks the table aria-hidden while it is still on screen.
 */
export function listingRows(page: Page) {
  return page.getByRole("row", { includeHidden: true }).filter({
    has: page.getByRole("combobox", {
      name: /^Publicação de /,
      includeHidden: true,
    }),
  });
}

/** Search the admin listing table and wait for the filtered, interactive page. */
export async function findInAdmin(page: Page, title: string): Promise<void> {
  await page
    .getByRole("searchbox", { name: "Buscar anúncios pelo título" })
    .fill(title);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\?q=/);
  await hydrated(page);
}

/** A real JPEG to upload: the demo seed's link-preview variant of a cover. */
export async function samplePhoto(page: {
  request: APIRequestContext;
}): Promise<Buffer> {
  const html = await (await page.request.get(STORE)).text();
  const match = html.match(/\/media\/[0-9a-f-]{36}-sm\.webp/);
  if (!match) throw new Error("No seeded photo found on the storefront");
  const response = await page.request.get(
    match[0].replace("-sm.webp", "-og.jpg"),
  );
  return response.body();
}

/** The store dedicated to the table journeys, so loja-e2e state stays untouched. */
export const TABLES_OWNER_EMAIL = "dona@loja-tabelas.test";
export const TABLES_SELLER = {
  email: "vera@loja-tabelas.test",
  name: "Vera Vendedora",
  password: "senha-da-vera",
};
export const MEMBER_PASSWORD = "senha-do-membro";

type Seed = {
  title: string;
  priceCents: number | null;
  publication: "published" | "draft" | "archived";
  availability?: "available" | "reserved" | "sold";
};

/** Titles chosen to tell pt-BR collation from code point order. */
const MANAGER_LISTINGS: Seed[] = [
  { title: "Árvore de Natal", priceCents: 12000, publication: "published" },
  { title: "Banco de jardim", priceCents: 35000, publication: "published" },
  {
    title: "Café expresso",
    priceCents: 9000,
    publication: "published",
    availability: "reserved",
  },
  { title: "Abajur antigo", priceCents: null, publication: "published" },
  {
    title: "Zebra de pelúcia",
    priceCents: 4500,
    publication: "published",
    availability: "sold",
  },
  { title: "Estante Éden", priceCents: 28000, publication: "published" },
  {
    title: "Ventilador de mesa",
    priceCents: 15000,
    publication: "published",
    availability: "reserved",
  },
  { title: "Bicicleta aro 26", priceCents: 90000, publication: "published" },
  ...[1, 2, 3].map((n) => ({
    title: `Cadeira arquivada ${n}`,
    priceCents: 1000 * n,
    publication: "archived" as const,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    title:
      i === 10
        ? "Rascunho 11 com um título muito comprido para conferir a quebra de linha no celular"
        : `Rascunho ${String(i + 1).padStart(2, "0")}`,
    priceCents: 500 * (i + 1),
    publication: "draft" as const,
  })),
];
const SELLER_LISTINGS = [1, 2, 3].map((n) => `Peça da Vera ${n}`);
const MEMBER_COUNT = 21;
const INVITE_COUNT = 21;

/** What the seeded store holds, for assertions. */
export const TABLES_SEED = {
  listings: MANAGER_LISTINGS.length + SELLER_LISTINGS.length,
  titles: [...MANAGER_LISTINGS.map((l) => l.title), ...SELLER_LISTINGS],
  sellerListings: SELLER_LISTINGS,
  /** Owner, Vera and the accepted members. */
  members: MEMBER_COUNT + 2,
  invites: INVITE_COUNT,
  counts: {
    published: 8,
    available: 5,
    reserved: 2,
    sold: 1,
    draft: 12 + SELLER_LISTINGS.length,
    archived: 3,
  },
};

export const memberEmail = (n: number) =>
  `membro-${String(n).padStart(2, "0")}@loja-tabelas.test`;
export const inviteEmail = (n: number) =>
  n === 1
    ? "convite-com-um-endereco-de-email-bem-comprido-para-o-celular-01@loja-tabelas.test"
    : `convite-${String(n).padStart(2, "0")}@loja-tabelas.test`;

/** An API context signed in as `email`, calling the app like the browser does. */
export async function apiAs(
  email: string,
  password: string,
): Promise<APIRequestContext> {
  const api = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
  });
  const login = await api.post("/api/auth/login", {
    data: { email, password },
  });
  if (!login.ok())
    throw new Error(`Login failed for ${email}: ${login.status()}`);
  return api;
}

/**
 * Re-create a seeded draft listing a journey deleted, so the store returns to
 * its seeded state for the next file.
 */
export async function restoreDraft(title: string): Promise<void> {
  const seed = MANAGER_LISTINGS.find((item) => item.title === title);
  if (seed?.publication !== "draft")
    throw new Error(`${title} is no seeded draft`);
  const owner = await apiAs(TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
  const { memberships } = await ok<{
    memberships: { sellerId: string; store: { id: string } }[];
  }>(await owner.get("/api/v1/me"));
  const membership = memberships[0];
  if (!membership) throw new Error("loja-tabelas has no store");
  const base = `/api/v1/stores/${membership.store.id}`;
  const { items: categories } = await ok<{ items: { id: string }[] }>(
    await owner.get(`${base}/categories`),
  );
  await ok(
    await owner.post(`${base}/listings`, {
      data: {
        title,
        categoryId: categories[0]?.id,
        sellerIds: [membership.sellerId],
        priceCents: seed.priceCents,
        condition: "good",
      },
    }),
  );
  await owner.dispose();
}

async function ok<T>(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${response.url()} -> ${response.status()} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

async function list(api: APIRequestContext, path: string): Promise<number> {
  return (await ok<{ items: unknown[] }>(await api.get(path))).items.length;
}

async function invite(
  api: APIRequestContext,
  storeId: string,
  email: string,
  role: "seller" | "admin",
): Promise<string> {
  const { link } = await ok<{ link: string }>(
    await api.post(`/api/v1/stores/${storeId}/invites`, {
      data: { email, role },
    }),
  );
  return link.slice(link.lastIndexOf("/") + 1);
}

async function accept(
  token: string,
  name: string,
  password: string,
  ip: string,
): Promise<void> {
  const anonymous = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL, "x-real-ip": ip },
  });
  await ok(
    await anonymous.post("/api/auth/invite", {
      data: { token, name, password },
    }),
  );
  await anonymous.dispose();
}

let seeding: Promise<string> | undefined;

/**
 * Fill loja-tabelas with enough listings, members and pending invites to
 * span two pages in every table, and return its store id. Seeds once per
 * provisioned database (a store matching the seed in every part is taken as
 * seeded), so several files can call it. A store holding anything else, a
 * half-finished seed or a rerun after the delete journey included, throws:
 * recreate the stack. Goes through the same HTTP API the admin uses.
 */
export function seedTablesStore(): Promise<string> {
  seeding ??= seed();
  return seeding;
}

async function seed(): Promise<string> {
  const owner = await apiAs(TABLES_OWNER_EMAIL, ADMIN_PASSWORD);
  const me = await ok<{
    memberships: { sellerId: string; store: { id: string } }[];
  }>(await owner.get("/api/v1/me"));
  const membership = me.memberships[0];
  if (!membership) throw new Error("loja-tabelas has no store");
  const storeId = membership.store.id;
  const base = `/api/v1/stores/${storeId}`;
  const found = {
    members: await list(owner, `${base}/members`),
    invites: await list(owner, `${base}/invites`),
    listings: await list(owner, `${base}/listings`),
  };
  const fresh = found.members === 1 && !found.invites && !found.listings;
  const seeded =
    found.members === TABLES_SEED.members &&
    found.invites === TABLES_SEED.invites &&
    found.listings === TABLES_SEED.listings;
  if (seeded) {
    await owner.dispose();
    return storeId;
  }
  if (!fresh) {
    throw new Error(
      "seeded store not in its initial state: recreate the e2e stack (bin/closeout e2e down -v)",
    );
  }

  const sellerToken = await invite(
    owner,
    storeId,
    TABLES_SELLER.email,
    "seller",
  );
  await accept(
    sellerToken,
    TABLES_SELLER.name,
    TABLES_SELLER.password,
    "10.0.0.1",
  );
  for (let n = 1; n <= MEMBER_COUNT; n++) {
    const token = await invite(
      owner,
      storeId,
      memberEmail(n),
      n === 2 ? "admin" : "seller",
    );
    const name =
      n === 1
        ? "José Álvares"
        : n === 3
          ? "Maria Aparecida de Souza Albuquerque Montenegro Filha"
          : `Membro ${String(n).padStart(2, "0")}`;
    await accept(token, name, MEMBER_PASSWORD, `10.0.1.${n}`);
  }
  for (let n = 1; n <= INVITE_COUNT; n++) {
    await invite(
      owner,
      storeId,
      inviteEmail(n),
      n % 3 === 0 ? "admin" : "seller",
    );
  }

  const { items: categories } = await ok<{ items: { id: string }[] }>(
    await owner.get(`${base}/categories`),
  );
  const categoryId = categories[0]?.id;
  if (!categoryId) throw new Error("No category to list under");
  const photo = await samplePhoto({ request: owner });
  const create = async (api: APIRequestContext, item: Seed) => {
    const { id } = await ok<{ id: string }>(
      await api.post(`${base}/listings`, {
        data: {
          title: item.title,
          categoryId,
          // The API ignores this for sellers, whose listings are their own.
          sellerIds: [membership.sellerId],
          priceCents: item.priceCents,
          condition: "good",
        },
      }),
    );
    if (item.publication === "published") {
      await ok(
        await api.post(`${base}/listings/${id}/images`, {
          multipart: {
            files: { name: "foto.jpg", mimeType: "image/jpeg", buffer: photo },
          },
        }),
      );
    }
    if (item.publication !== "draft") {
      await ok(
        await api.patch(`${base}/listings/${id}/status`, {
          data: {
            publication: item.publication,
            availability: item.availability ?? "available",
          },
        }),
      );
    }
  };
  for (const listing of MANAGER_LISTINGS) await create(owner, listing);
  const vera = await apiAs(TABLES_SELLER.email, TABLES_SELLER.password);
  for (const title of SELLER_LISTINGS) {
    await create(vera, { title, priceCents: 2500, publication: "draft" });
  }
  await vera.dispose();
  await owner.dispose();
  return storeId;
}
