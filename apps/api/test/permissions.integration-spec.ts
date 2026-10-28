import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import { StoresModule } from "@/stores/stores.module";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  type Member,
  photo,
  registeredRoutes,
  resetDatabase,
  type TestContext,
} from "./helpers";

const FORBIDDEN = "Você não tem permissão para esta ação.";
const ROLES = ["owner", "admin", "seller", "non-member"] as const;
type Role = (typeof ROLES)[number];

interface Fixture {
  owner: Admin;
  admin: Member;
  seller: Member;
  /** Another seller, target of other members' edits. */
  other: Member;
  outsider: Admin;
}

interface Call {
  method: "get" | "post" | "patch" | "put" | "delete";
  url: string;
  body?: object;
  file?: string;
}

interface Capability {
  name: string;
  /** Builds a fresh target for each role, so one role's change cannot affect another's. */
  call: (fx: Fixture, role: Role) => Promise<Call>;
  /** Expected status for owner, admin, seller and a member of another store. */
  expected: [number, number, number, number];
}

const store = (fx: Fixture) => `/stores/${fx.owner.storeId}`;
const unassigned = async (fx: Fixture) =>
  `${store(fx)}/listings/${(await insertListing(dataSource(), fx.owner)).id}`;
const assigned = async (fx: Fixture) =>
  `${store(fx)}/listings/${
    (
      await insertListing(dataSource(), fx.owner, {
        sellerIds: [fx.seller.sellerId],
      })
    ).id
  }`;
const ownProfile = (fx: Fixture, role: Role) =>
  ({
    owner: fx.owner.sellerId,
    admin: fx.admin.sellerId,
    seller: fx.seller.sellerId,
    "non-member": fx.outsider.sellerId,
  })[role];
const invite = async (fx: Fixture) => {
  const res = await as(ctx.app, fx.owner.cookie)
    .post(`${store(fx)}/invites`)
    .send({ email: `${nextId()}@convite.test`, role: "seller" })
    .expect(201);
  return `${store(fx)}/invites/${res.body.invite.id}`;
};

let ctx: TestContext;
const dataSource = () => ctx.dataSource;
let counter = 0;
const nextId = () => `p${++counter}`;

const CAPABILITIES: Capability[] = [
  {
    name: "read store settings",
    call: async (fx) => ({ method: "get", url: store(fx) }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "change store settings",
    call: async (fx) => ({
      method: "patch",
      url: store(fx),
      body: { headline: "Nova chamada" },
    }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "list categories",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/categories` }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "list listings",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/listings` }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "read an unassigned listing",
    call: async (fx) => ({ method: "get", url: await unassigned(fx) }),
    expected: [200, 200, 404, 404],
  },
  {
    name: "read an assigned listing",
    call: async (fx) => ({ method: "get", url: await assigned(fx) }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "preview an unassigned listing",
    call: async (fx) => ({
      method: "get",
      url: `${await unassigned(fx)}/preview`,
    }),
    expected: [200, 200, 404, 404],
  },
  {
    name: "preview an assigned listing",
    call: async (fx) => ({
      method: "get",
      url: `${await assigned(fx)}/preview`,
    }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "create a listing",
    call: async (fx) => ({
      method: "post",
      url: `${store(fx)}/listings`,
      body: {
        title: "Cadeira",
        categoryId: fx.owner.categoryId,
        sellerIds: [fx.owner.sellerId],
        condition: "good",
      },
    }),
    expected: [201, 201, 201, 404],
  },
  {
    name: "edit an unassigned listing",
    call: async (fx) => ({
      method: "patch",
      url: await unassigned(fx),
      body: { title: "Trocado" },
    }),
    expected: [200, 200, 404, 404],
  },
  {
    name: "edit an assigned listing",
    call: async (fx) => ({
      method: "patch",
      url: await assigned(fx),
      body: { title: "Trocado" },
    }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "change the status of an unassigned listing",
    call: async (fx) => ({
      method: "patch",
      url: `${await unassigned(fx)}/status`,
      body: { availability: "reserved" },
    }),
    expected: [200, 200, 404, 404],
  },
  {
    name: "change the status of an assigned listing",
    call: async (fx) => ({
      method: "patch",
      url: `${await assigned(fx)}/status`,
      body: { availability: "reserved" },
    }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "duplicate an unassigned listing",
    call: async (fx) => ({
      method: "post",
      url: `${await unassigned(fx)}/duplicate`,
    }),
    expected: [201, 201, 404, 404],
  },
  {
    name: "duplicate an assigned listing",
    call: async (fx) => ({
      method: "post",
      url: `${await assigned(fx)}/duplicate`,
    }),
    expected: [201, 201, 201, 404],
  },
  {
    name: "delete an unassigned listing",
    call: async (fx) => ({ method: "delete", url: await unassigned(fx) }),
    expected: [204, 204, 404, 404],
  },
  {
    name: "delete an assigned listing",
    call: async (fx) => ({ method: "delete", url: await assigned(fx) }),
    expected: [204, 204, 204, 404],
  },
  {
    name: "upload photos to an unassigned listing",
    call: async (fx) => ({
      method: "post",
      url: `${await unassigned(fx)}/images`,
      file: "files",
    }),
    expected: [201, 201, 404, 404],
  },
  {
    name: "upload photos to an assigned listing",
    call: async (fx) => ({
      method: "post",
      url: `${await assigned(fx)}/images`,
      file: "files",
    }),
    expected: [201, 201, 201, 404],
  },
  {
    name: "reorder photos of an unassigned listing",
    call: async (fx) => ({
      method: "put",
      url: `${await unassigned(fx)}/images/order`,
      body: { ids: [] },
    }),
    expected: [200, 200, 404, 404],
  },
  {
    name: "reorder photos of an assigned listing",
    call: async (fx) => ({
      method: "put",
      url: `${await assigned(fx)}/images/order`,
      body: { ids: [] },
    }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "delete a photo of an assigned listing",
    call: async (fx) => {
      const url = await assigned(fx);
      const uploaded = await as(ctx.app, fx.owner.cookie)
        .post(`${url}/images`)
        .attach("files", await photo(), "a.jpg")
        .expect(201);
      return {
        method: "delete",
        url: `${url}/images/${uploaded.body.items[0].id}`,
      };
    },
    expected: [200, 200, 200, 404],
  },
  {
    name: "delete a photo of an unassigned listing",
    call: async (fx) => {
      const url = await unassigned(fx);
      const uploaded = await as(ctx.app, fx.owner.cookie)
        .post(`${url}/images`)
        .attach("files", await photo(), "a.jpg")
        .expect(201);
      return {
        method: "delete",
        url: `${url}/images/${uploaded.body.items[0].id}`,
      };
    },
    expected: [200, 200, 404, 404],
  },
  {
    name: "change an assigned listing's sellers",
    call: async (fx) => ({
      method: "patch",
      url: await assigned(fx),
      body: { sellerIds: [fx.seller.sellerId, fx.owner.sellerId] },
    }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "open the dashboard",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/dashboard` }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "list contact profiles",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/sellers` }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "edit their own contact profile",
    call: async (fx, role) => ({
      method: "patch",
      url: `${store(fx)}/sellers/${ownProfile(fx, role)}`,
      body: { displayName: "Novo nome" },
    }),
    expected: [200, 200, 200, 404],
  },
  {
    name: "edit another member's contact profile",
    call: async (fx) => ({
      method: "patch",
      url: `${store(fx)}/sellers/${fx.other.sellerId}`,
      body: { displayName: "Outra pessoa" },
    }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "change another member's photo",
    call: async (fx) => ({
      method: "post",
      url: `${store(fx)}/sellers/${fx.other.sellerId}/avatar`,
      file: "file",
    }),
    expected: [201, 201, 403, 404],
  },
  {
    name: "list members with emails and roles",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/members` }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "list pending invites",
    call: async (fx) => ({ method: "get", url: `${store(fx)}/invites` }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "create an invite",
    call: async (fx) => ({
      method: "post",
      url: `${store(fx)}/invites`,
      body: { email: `${nextId()}@convite.test`, role: "seller" },
    }),
    expected: [201, 201, 403, 404],
  },
  {
    name: "revoke an invite",
    call: async (fx) => ({ method: "delete", url: await invite(fx) }),
    expected: [204, 204, 403, 404],
  },
  {
    name: "regenerate an invite",
    call: async (fx) => ({
      method: "post",
      url: `${await invite(fx)}/regenerate`,
    }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "change a member's role",
    call: async (fx) => ({
      method: "patch",
      url: `${store(fx)}/members/${fx.other.userId}`,
      body: { role: "seller" },
    }),
    expected: [200, 200, 403, 404],
  },
  {
    name: "remove a member",
    call: async (fx) => {
      const id = nextId();
      const target = await addMember(ctx, fx.owner, {
        email: `${id}@example.com`,
        name: id,
        role: "seller",
      });
      return { method: "delete", url: `${store(fx)}/members/${target.userId}` };
    },
    expected: [204, 204, 403, 404],
  },
];

describe("store permissions", () => {
  let fx: Fixture;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.dataSource);
    const owner = await createStoreWithAdmin(ctx, "loja-a");
    fx = {
      owner,
      admin: await addMember(ctx, owner, {
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
      }),
      seller: await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
      }),
      other: await addMember(ctx, owner, {
        email: "outra@example.com",
        name: "Outra",
        role: "seller",
      }),
      outsider: await createStoreWithAdmin(ctx, "loja-b"),
    };
  });
  afterAll(() => ctx.app.close());

  const cookie = (role: Role) =>
    ({
      owner: fx.owner.cookie,
      admin: fx.admin.cookie,
      seller: fx.seller.cookie,
      "non-member": fx.outsider.cookie,
    })[role];

  const cases = CAPABILITIES.flatMap((capability) =>
    ROLES.map((role, index) => ({
      ...capability,
      role,
      status: capability.expected[index] as number,
    })),
  );

  it.each(cases)("answers $status when the $role tries to $name", async ({
    call,
    role,
    status,
  }) => {
    const { method, url, body, file } = await call(fx, role);
    let req = as(ctx.app, cookie(role))[method](url);
    if (file) req = req.attach(file, await photo(), "a.jpg");
    else if (body) req = req.send(body);
    const res = await req;
    expect(res.status).toBe(status);
    if (status === 403) expect(res.body.detail).toBe(FORBIDDEN);
  });

  it("answers a seller's request for an unassigned or malformed listing id exactly like an unknown id", async () => {
    const seller = as(ctx.app, fx.seller.cookie);
    const unknown = await seller
      .get(`${store(fx)}/listings/00000000-0000-4000-8000-000000000000`)
      .expect(404);
    expect(unknown.body).toEqual({
      statusCode: 404,
      message: "Anúncio não encontrado.",
      error: "Not Found",
    });
    const hidden = await seller.get(await unassigned(fx)).expect(404);
    expect(hidden.body).toEqual(unknown.body);
    const malformed = await seller
      .patch(`${store(fx)}/listings/not-a-uuid/status`)
      .send({ availability: "sold" })
      .expect(404);
    expect(malformed.body).toEqual(unknown.body);
  });

  it("declares the allowed roles on every store route", () => {
    const storeRoutes = registeredRoutes(ctx.app).filter((route) =>
      route.path.startsWith("/stores/:storeId"),
    );
    expect(storeRoutes.length).toBeGreaterThan(0);
    const undeclared = storeRoutes
      .filter((route) => !route.roles || route.roles.length === 0)
      .map((route) => `${route.method} ${route.path}`);
    expect(undeclared).toEqual([]);
  });

  it("offers no route to create or delete a contact profile", () => {
    const sellerRoutes = registeredRoutes(ctx.app)
      .filter((route) => route.path.startsWith("/stores/:storeId/sellers"))
      .map((route) => `${route.method} ${route.path}`)
      .sort();
    expect(sellerRoutes).toEqual([
      "GET /stores/:storeId/sellers",
      "PATCH /stores/:storeId/sellers/:id",
      "POST /stores/:storeId/sellers/:id/avatar",
    ]);
  });
});

@Controller("stores/:storeId/undeclared")
@UseGuards(SessionGuard, StoreMemberGuard)
class UndeclaredController {
  @Get()
  get() {
    return { reached: true };
  }
}

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [UndeclaredController],
})
class UndeclaredModule {}

describe("a store route without a role declaration", () => {
  beforeAll(async () => {
    ctx = await createTestApp([UndeclaredModule]);
    await resetDatabase(ctx.dataSource);
  });
  afterAll(() => ctx.app.close());

  it("is refused for every role", async () => {
    const owner = await createStoreWithAdmin(ctx, "loja-a");
    const members = [
      owner,
      await addMember(ctx, owner, {
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
      }),
      await addMember(ctx, owner, {
        email: "vendedora@example.com",
        name: "Vendedora",
        role: "seller",
      }),
    ];
    for (const member of members) {
      const res = await as(ctx.app, member.cookie)
        .get(`/stores/${owner.storeId}/undeclared`)
        .expect(403);
      expect(res.body.detail).toBe(FORBIDDEN);
    }
    const outsider = await createStoreWithAdmin(ctx, "loja-b");
    await as(ctx.app, outsider.cookie)
      .get(`/stores/${owner.storeId}/undeclared`)
      .expect(404);
  });
});
