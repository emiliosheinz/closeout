import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import request from "supertest";
import { z } from "zod";
import { createTestApp, ORIGIN, type TestContext } from "./helpers";

const itemSchema = z.strictObject({
  title: z.string().trim().min(1, "Dê um nome ao item."),
  priceCents: z.number().int().min(0, "Preço inválido.").optional(),
});
const pageSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).optional(),
});
const idSchema = z.uuid();

const ID = "0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f";

@Controller("validation-probe")
class ProbeController {
  @Post(":id")
  create(
    @Param("id", { schema: idSchema }) id: string,
    @Body({ schema: itemSchema }) body: unknown,
    @Query({ schema: pageSchema }) query: unknown,
  ) {
    return { id, body, query };
  }

  @Get("plain/:id")
  plain(@Param("id", { schema: idSchema }) id: string) {
    return { id };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe("request validation", () => {
  let ctx: TestContext;
  const post = (path: string) =>
    request(ctx.app.getHttpServer()).post(path).set("Origin", ORIGIN);

  beforeAll(async () => {
    ctx = await createTestApp([ProbeModule]);
  });
  afterAll(() => ctx.app.close());

  /** Asserts a 400 problem with the given field errors. */
  const invalid = (
    res: request.Response,
    errors: { pointer: string; detail: string }[],
  ) => {
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: errors[0]?.detail,
      requestId: res.headers["x-request-id"],
      errors,
    });
  };

  it("hands the handler parsed, coerced input", async () => {
    const res = await post(`/validation-probe/${ID}?page=2`)
      .send({ title: " Sofá ", priceCents: 1200 })
      .expect(201);

    expect(res.body).toEqual({
      id: ID,
      body: { title: "Sofá", priceCents: 1200 },
      query: { page: 2 },
    });
  });

  it("reports body fields in schema order, unknown keys included", async () => {
    const res = await post(`/validation-probe/${ID}`).send({
      priceCents: -1,
      title: " ",
      owner: "x",
    });

    invalid(res, [
      { pointer: "/title", detail: "Dê um nome ao item." },
      { pointer: "/priceCents", detail: "Preço inválido." },
      { pointer: "/owner", detail: "Campo não permitido." },
    ]);
  });

  it("reports a zero-length JSON body as each required field missing", async () => {
    const res = await post(`/validation-probe/${ID}`).set(
      "Content-Type",
      "application/json",
    );

    invalid(res, [{ pointer: "/title", detail: "Preencha este campo." }]);
  });

  it("reports a body that is not an object at the root", async () => {
    const res = await post(`/validation-probe/${ID}`)
      .set("Content-Type", "application/json")
      .send("[1,2]");

    invalid(res, [{ pointer: "", detail: "Valor inválido." }]);
  });

  it("reports query fields under /query", async () => {
    const res = await post(`/validation-probe/${ID}?page=0&sort=x`).send({
      title: "Sofá",
    });

    invalid(res, [
      { pointer: "/query/page", detail: "Valor inválido." },
      { pointer: "/query/sort", detail: "Campo não permitido." },
    ]);
  });

  it("reports a route param under /params", async () => {
    const res = await post("/validation-probe/abc").send({ title: "Sofá" });

    invalid(res, [{ pointer: "/params/id", detail: "Valor inválido." }]);
  });

  it("ignores query params on a route that reads no query", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/validation-probe/plain/${ID}?anything=goes`)
      .expect(200);

    expect(res.body).toEqual({ id: ID });
  });
});
