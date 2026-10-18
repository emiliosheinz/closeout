import type { INestApplication } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { ModulesContainer } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "@/app.module";
import { createAdmin } from "@/cli/admin-commands";
import { configureApp } from "@/configure-app";
import { StoresService } from "@/stores/services/stores.service";

export const ORIGIN = "http://storefront.test";
export const INTERNAL_SECRET = "integration-test-secret-0123456789abcdef";
export const PASSWORD = "correct horse battery";

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `TRUNCATE "listing_images", "listings", "categories", "sellers", "store_members", "sessions", "users", "stores" CASCADE`,
  );
}

export interface Admin {
  email: string;
  storeId: string;
  storeSlug: string;
  cookie: string;
  sellerId: string;
  categoryId: string;
}

/** Create a store with one admin (via the real CLI command) and sign in. */
export async function createStoreWithAdmin(
  ctx: TestContext,
  slug: string,
  email = `${slug}@example.com`,
): Promise<Admin> {
  const { storeId, userId } = await createAdmin(
    ctx.dataSource,
    ctx.app.get(StoresService),
    {
      email,
      name: `Admin ${slug}`,
      password: PASSWORD,
      store: { slug, name: `Loja ${slug}` },
      whatsapp: "+55 11 99999-8888",
    },
  );
  const [seller] = await ctx.dataSource.query(
    `SELECT id FROM sellers WHERE user_id = $1`,
    [userId],
  );
  const [category] = await ctx.dataSource.query(
    `SELECT id FROM categories WHERE store_id = $1 AND slug = 'moveis'`,
    [storeId],
  );
  return {
    email,
    storeId,
    storeSlug: slug,
    cookie: await login(ctx.app, email, PASSWORD),
    sellerId: seller.id,
    categoryId: category.id,
  };
}

/** Log in the way apps/web does and return a `Cookie` header value. */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .set("x-internal-secret", INTERNAL_SECRET)
    .set("x-client-ip", "192.0.2.10")
    .send({ email, password })
    .expect(200);
  return `closeout_session=${res.body.sessionToken}`;
}

/** An admin-side HTTP client: same-origin Origin header and session cookie. */
export function as(app: INestApplication, cookie: string) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test) =>
    req.set("Cookie", cookie).set("Origin", ORIGIN);
  return {
    get: (url: string) => withAuth(request(server).get(url)),
    post: (url: string) => withAuth(request(server).post(url)),
    patch: (url: string) => withAuth(request(server).patch(url)),
    put: (url: string) => withAuth(request(server).put(url)),
    delete: (url: string) => withAuth(request(server).delete(url)),
  };
}

export function photo(
  color = "#c0603a",
  width = 800,
  height = 600,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

/** Insert a listing row directly, bypassing the API rules under test elsewhere. */
export async function insertListing(
  dataSource: DataSource,
  admin: Admin,
  state: {
    title?: string;
    description?: string;
    priceCents?: number | null;
    condition?: "new" | "like_new" | "good" | "fair" | "for_parts";
    category?: string;
    publication?: "draft" | "published" | "archived";
    availability?: "available" | "reserved" | "sold";
    publishedAt?: Date;
  } = {},
): Promise<{ id: string; slug: string }> {
  const title = state.title ?? "Item";
  const publication = state.publication ?? "draft";
  const [row] = await dataSource.query(
    `WITH listing AS (
       INSERT INTO listings (store_id, category_id, slug, title, description, price_cents, condition, availability, publication, published_at)
       VALUES ($1, (SELECT id FROM categories WHERE store_id = $1 AND slug = $3), $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, slug
     ), seller AS (
       INSERT INTO listing_sellers (listing_id, seller_id) SELECT id, $2 FROM listing
     )
     SELECT id, slug FROM listing`,
    [
      admin.storeId,
      admin.sellerId,
      state.category ?? "moveis",
      `item-${Math.random().toString(36).slice(2, 10)}`,
      title,
      state.description ?? "",
      state.priceCents ?? null,
      state.condition ?? "good",
      state.availability ?? "available",
      publication,
      publication === "published" ? (state.publishedAt ?? new Date()) : null,
    ],
  );
  return row;
}

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "ALL",
  "OPTIONS",
  "HEAD",
];

interface Route {
  method: string;
  path: string;
  guarded: boolean;
}

/** Every route the app registers, read from Nest's controller metadata. */
export function registeredRoutes(app: INestApplication): Route[] {
  const routes: Route[] = [];
  for (const moduleRef of app.get(ModulesContainer).values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controller = wrapper.metatype as { prototype: object } | null;
      if (!controller) continue;
      const prefix: string =
        Reflect.getMetadata(PATH_METADATA, controller) ?? "";
      const guardedClass =
        (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []).length > 0;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (typeof handler !== "function") continue;
        const method: number | undefined = Reflect.getMetadata(
          METHOD_METADATA,
          handler,
        );
        if (method === undefined) continue;
        const path: string = Reflect.getMetadata(PATH_METADATA, handler) ?? "";
        routes.push({
          method: HTTP_METHODS[method] ?? String(method),
          path: `/${[prefix, path].filter((part) => part && part !== "/").join("/")}`,
          guarded:
            guardedClass ||
            (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []).length > 0,
        });
      }
    }
  }
  return routes;
}
