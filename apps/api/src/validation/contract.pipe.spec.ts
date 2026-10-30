import {
  type ArgumentMetadata,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { z } from "zod";
import { ContractPipe } from "./contract.pipe";

const listing = z.strictObject({
  title: z.string().trim().min(1, "Dê um nome ao item.").max(5, "Curto."),
  priceCents: z.number().int().min(0, "Preço inválido.").optional(),
  attributes: z
    .array(z.strictObject({ label: z.string().min(1, "Rótulo vazio.") }))
    .optional(),
});

const body = (schema: z.ZodType = listing): ArgumentMetadata => ({
  type: "body",
  schema,
});

function rejection(value: unknown, metadata: ArgumentMetadata) {
  try {
    new ContractPipe().transform(value, metadata);
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return { status: error.getStatus(), ...(error as unknown as object) };
  }
  throw new Error("expected the pipe to reject");
}

function errorsFor(value: unknown, metadata: ArgumentMetadata) {
  return (rejection(value, metadata) as { errors?: unknown }).errors;
}

describe("contract pipe", () => {
  describe("pointers", () => {
    it("points into nested body fields", () => {
      expect(
        errorsFor({ title: "Bike", attributes: [{ label: "" }] }, body()),
      ).toEqual([{ pointer: "/attributes/0/label", detail: "Rótulo vazio." }]);
    });

    it("prefixes query fields with /query", () => {
      const query = z.strictObject({ page: z.coerce.number().int().min(1) });
      expect(
        errorsFor({ page: "0" }, { type: "query", schema: query }),
      ).toEqual([{ pointer: "/query/page", detail: "Valor inválido." }]);
    });

    it("prefixes a named route param with /params", () => {
      expect(
        errorsFor("abc", { type: "param", data: "id", schema: z.uuid() }),
      ).toEqual([{ pointer: "/params/id", detail: "Valor inválido." }]);
    });

    it("prefixes params validated as one object with /params", () => {
      const params = z.strictObject({ imageId: z.uuid() });
      expect(
        errorsFor({ imageId: "abc" }, { type: "param", schema: params }),
      ).toEqual([{ pointer: "/params/imageId", detail: "Valor inválido." }]);
    });

    it("points at the root when the body is not an object", () => {
      expect(errorsFor(["Bike"], body())).toEqual([
        { pointer: "", detail: "Valor inválido." },
      ]);
    });

    it("escapes / and ~ in keys", () => {
      expect(errorsFor({ title: "Bike", "a/b~c": 1 }, body())).toEqual([
        { pointer: "/a~1b~0c", detail: "Campo não permitido." },
      ]);
    });
  });

  describe("items", () => {
    it("keeps only the first failing rule of a field", () => {
      const schema = z.strictObject({
        name: z
          .string()
          .min(3, "Curto demais.")
          .regex(/^[a-z]+$/, "Só letras."),
      });
      expect(errorsFor({ name: "A" }, body(schema))).toEqual([
        { pointer: "/name", detail: "Curto demais." },
      ]);
    });

    it("orders fields as the schema declares them, not as the body sends them", () => {
      expect(errorsFor({ priceCents: -1, title: "" }, body())).toEqual([
        { pointer: "/title", detail: "Dê um nome ao item." },
        { pointer: "/priceCents", detail: "Preço inválido." },
      ]);
    });

    it("reports each unknown key on its own", () => {
      expect(
        errorsFor({ title: "Bike", owner: "x", admin: true }, body()),
      ).toEqual([
        { pointer: "/owner", detail: "Campo não permitido." },
        { pointer: "/admin", detail: "Campo não permitido." },
      ]);
    });

    it("answers 400 with the first field's message as the detail", () => {
      const thrown = rejection({ priceCents: -1, title: "" }, body());
      expect(thrown).toMatchObject({
        status: 400,
        detail: "Dê um nome ao item.",
      });
    });

    it("is not Nest's bad request exception", () => {
      try {
        new ContractPipe().transform({}, body());
      } catch (error) {
        expect(error).not.toBeInstanceOf(BadRequestException);
        return;
      }
      throw new Error("expected the pipe to reject");
    });
  });

  describe("input handling", () => {
    it("reads an absent body as an empty object", () => {
      expect(errorsFor(undefined, body())).toEqual([
        { pointer: "/title", detail: "Preencha este campo." },
      ]);
    });

    it("strips __proto__ keys before parsing", () => {
      const value = JSON.parse(
        '{"title":"Bike","__proto__":{"admin":true},"attributes":[{"label":"Cor","__proto__":{"x":1}}]}',
      );

      const parsed = new ContractPipe().transform(value, body());

      expect(parsed).toEqual({ title: "Bike", attributes: [{ label: "Cor" }] });
      expect(Object.hasOwn(parsed as object, "__proto__")).toBe(false);
      expect(({} as { admin?: boolean }).admin).toBeUndefined();
    });

    it("hands the handler the parsed output", () => {
      const query = z.strictObject({ page: z.coerce.number().int() });
      expect(
        new ContractPipe().transform(
          { page: "3" },
          { type: "query", schema: query },
        ),
      ).toEqual({ page: 3 });
      expect(new ContractPipe().transform({ title: " Bike " }, body())).toEqual(
        { title: "Bike" },
      );
    });

    it("passes arguments without a schema through untouched", () => {
      const value = { anything: "goes" };
      expect(new ContractPipe().transform(value, { type: "body" })).toBe(value);
      expect(
        new ContractPipe().transform("abc", { type: "param", data: "id" }),
      ).toBe("abc");
    });
  });
});
