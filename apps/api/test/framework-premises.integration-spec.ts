import {
  type ArgumentMetadata,
  type ArgumentsHost,
  Body,
  Catch,
  Controller,
  type ExceptionFilter,
  HttpException,
  type INestApplication,
  Injectable,
  Module,
  Param,
  type PipeTransform,
  Post,
  Query,
} from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { createTestApp, ORIGIN, type TestContext } from "./helpers";

type Schema = NonNullable<ArgumentMetadata["schema"]>;

function passThroughSchema(): Schema {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => ({ value }),
    },
  };
}

const bodySchema = passThroughSchema();
const querySchema = passThroughSchema();
const idSchema = passThroughSchema();

@Controller("premises")
class PremisesController {
  @Post(":id")
  handle(
    @Body({ schema: bodySchema }) _body: unknown,
    @Query({ schema: querySchema }) _query: unknown,
    @Param("id", { schema: idSchema }) _id: string,
  ) {
    return { ok: true };
  }
}

const seenByPipe: ArgumentMetadata[] = [];

@Injectable()
class RecordingPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    seenByPipe.push(metadata);
    return value;
  }
}

@Module({
  controllers: [PremisesController],
  providers: [{ provide: APP_PIPE, useClass: RecordingPipe }],
})
class SchemaMetadataModule {}

class ParserRejected extends HttpException {
  constructor() {
    super("parser rejected the body", 415);
  }
}

const caughtByFilter: unknown[] = [];

@Catch()
class RecordingFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    caughtByFilter.push(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(299)
      .json({
        caught: exception instanceof Error ? exception.constructor.name : null,
      });
  }
}

@Module({
  controllers: [PremisesController],
  providers: [{ provide: APP_FILTER, useClass: RecordingFilter }],
})
class ParserErrorModule {}

describe("framework premises", () => {
  describe("schemas declared on route parameters", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestApp([SchemaMetadataModule]);
    });
    afterAll(() => ctx.app.close());

    it("reach a global pipe with the argument type and name", async () => {
      seenByPipe.length = 0;
      await request(ctx.app.getHttpServer())
        .post("/premises/42?page=2")
        .set("Origin", ORIGIN)
        .send({ title: "Sofá" })
        .expect(201);

      const byType = (type: string) =>
        seenByPipe.find((metadata) => metadata.type === type);
      expect(byType("body")?.schema).toBe(bodySchema);
      expect(byType("body")?.data).toBeUndefined();
      expect(byType("query")?.schema).toBe(querySchema);
      expect(byType("query")?.data).toBeUndefined();
      expect(byType("param")?.schema).toBe(idSchema);
      expect(byType("param")?.data).toBe("id");
    });
  });

  describe("errors from an app-registered parsing middleware", () => {
    let app: INestApplication;
    const rejection = new ParserRejected();
    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ParserErrorModule],
      }).compile();
      app = moduleRef.createNestApplication({
        logger: false,
        bodyParser: false,
      });
      app.use((_req: Request, _res: Response, next: NextFunction) =>
        next(rejection),
      );
      await app.init();
    });
    afterAll(() => app.close());

    it("reach a catch-all filter unchanged when they are not a SyntaxError", async () => {
      caughtByFilter.length = 0;
      const res = await request(app.getHttpServer())
        .post("/premises/42")
        .send({ title: "Sofá" })
        .expect(299);

      expect(caughtByFilter).toHaveLength(1);
      expect(caughtByFilter[0]).toBe(rejection);
      expect(res.body).toEqual({ caught: "ParserRejected" });
    });
  });
});
