import * as contracts from "@closeout/contracts/schemas";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { createTestApp, registeredRoutes, type TestContext } from "./helpers";

const INPUTS: Partial<Record<number, string>> = {
  [RouteParamtypes.BODY]: "body",
  [RouteParamtypes.QUERY]: "query",
  [RouteParamtypes.PARAM]: "param",
};

// The store member guard checks it with the contracts UUID schema and
// answers 404 before membership, so routes need not declare it.
const GUARDED_PARAMS = new Set(["storeId"]);

describe("request input schemas", () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());

  it("declares a contracts schema for every body, query and route param", () => {
    const contractSchemas = new Set<unknown>(Object.values(contracts));
    const checked: string[] = [];
    const missing: string[] = [];
    for (const route of registeredRoutes(ctx.app)) {
      const at = `${route.method} ${route.path}`;
      const declaredParams = new Set<unknown>();
      for (const [key, arg] of Object.entries(route.args)) {
        const input = INPUTS[Number(key.split(":")[0])];
        if (!input) continue;
        const name = input === "param" ? `param ${String(arg.data)}` : input;
        if (input === "param") declaredParams.add(arg.data);
        checked.push(`${at} ${name}`);
        if (!contractSchemas.has(arg.schema)) missing.push(`${at} ${name}`);
      }
      for (const segment of route.path.split("/")) {
        const param = segment.slice(1);
        if (!segment.startsWith(":") || GUARDED_PARAMS.has(param)) continue;
        if (!declaredParams.has(param)) {
          missing.push(`${at} param ${param} (undeclared)`);
        }
      }
    }

    expect(missing).toEqual([]);
    expect(checked).toEqual(
      expect.arrayContaining([
        "GET /public/stores/:storeSlug/listings query",
        "GET /stores/:storeId/listings query",
        "PATCH /stores/:storeId/listings/:id param id",
        "PATCH /stores/:storeId/listings/:id body",
        "PATCH /stores/:storeId/listings/:id/status body",
        "PUT /stores/:storeId/listings/:id/images/order body",
        "POST /auth/invites/lookup body",
        "POST /auth/invites/accept body",
        "DELETE /stores/:storeId/listings/:id/images/:imageId param imageId",
        "PATCH /stores/:storeId/members/:userId param userId",
      ]),
    );
  });
});
