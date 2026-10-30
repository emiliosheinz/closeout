import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import { AllowListProcessor } from "./allow-list.processor";

const ALLOWED = [
  "http.request.method",
  "http.route",
  "url.path",
  "http.response.status_code",
  "db.system.name",
  "db.operation.name",
  "db.query.text",
  "rpc.system",
  "rpc.service",
  "rpc.method",
  "aws.s3.bucket",
];
const SENTINEL = "zq9sentinel";
const LINKED = {
  traceId: "0af7651916cd43dd8448eb211c80319c",
  spanId: "b7ad6b7169203331",
  traceFlags: 1,
};

function setUp() {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [
      new AllowListProcessor(new SimpleSpanProcessor({ exporter })),
    ],
  });
  return { exporter, tracer: provider.getTracer("test") };
}

describe("span allow-list", () => {
  it("exports server spans with only method, route, path and status", () => {
    const { exporter, tracer } = setUp();
    const span = tracer.startSpan("GET /items/:id", {
      kind: SpanKind.SERVER,
      attributes: {
        "http.request.method": "GET",
        "http.route": "/items/:id",
        "url.path": "/items/42",
        "http.response.status_code": 200,
        "url.query": `token=${SENTINEL}`,
        "url.full": `http://api.test/items/42?token=${SENTINEL}`,
        "user_agent.original": `agent-${SENTINEL}`,
        "http.request.header.authorization": [`Bearer ${SENTINEL}`],
        "http.request.header.cookie": [`session=${SENTINEL}`],
        "client.address": "203.0.113.9",
        "network.peer.address": "203.0.113.9",
        "server.address": "api.test",
      },
    });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    expect(exported?.attributes).toEqual({
      "http.request.method": "GET",
      "http.route": "/items/:id",
      "url.path": "/items/42",
      "http.response.status_code": 200,
    });
  });

  it("keeps the query text of a failed pg query but drops its error", () => {
    const { exporter, tracer } = setUp();
    const span = tracer.startSpan("pg.query:SELECT closeout", {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system.name": "postgresql",
        "db.query.text": "SELECT $1::uuid",
        "db.namespace": "closeout",
        "db.postgresql.values": [SENTINEL],
        "db.response.status_code": "22P02",
        "error.type": "error",
        "server.address": "postgres",
        "server.port": 5432,
      },
      links: [
        {
          context: LINKED,
          attributes: { note: SENTINEL },
        },
      ],
    });
    span.recordException(
      new Error(`invalid input syntax for type uuid: "${SENTINEL}"`),
    );
    span.addEvent("query", { detail: SENTINEL });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `invalid input syntax for type uuid: "${SENTINEL}"`,
    });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    expect(exported?.attributes).toEqual({
      "db.system.name": "postgresql",
      "db.query.text": "SELECT $1::uuid",
    });
    expect(exported?.events).toEqual([]);
    expect(exported?.links).toEqual([]);
    expect(exported?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(JSON.stringify(exported?.attributes)).not.toContain(SENTINEL);
  });

  it("keeps the AWS service, operation and bucket", () => {
    const { exporter, tracer } = setUp();
    tracer
      .startSpan("S3.PutObject", {
        kind: SpanKind.CLIENT,
        attributes: {
          "rpc.system": "aws-api",
          "rpc.service": "S3",
          "rpc.method": "PutObject",
          "aws.s3.bucket": "media",
          "cloud.region": "iad",
          "aws.request.id": SENTINEL,
        },
      })
      .end();

    const [exported] = exporter.getFinishedSpans();
    expect(exported?.attributes).toEqual({
      "rpc.system": "aws-api",
      "rpc.service": "S3",
      "rpc.method": "PutObject",
      "aws.s3.bucket": "media",
    });
  });

  it("keeps only allow-listed keys whatever an instrumentation adds", () => {
    const { exporter, tracer } = setUp();
    tracer
      .startSpan("anything", {
        attributes: Object.fromEntries(
          [
            ...ALLOWED,
            "express.name",
            "http.request.body",
            "anything.else",
          ].map((key) => [key, `${key}-value`]),
        ),
      })
      .end();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(Object.keys(spans[0]?.attributes ?? {}).sort()).toEqual(
      [...ALLOWED].sort(),
    );
  });

  it("leaves a status without a message as it was", () => {
    const { exporter, tracer } = setUp();
    const span = tracer.startSpan("GET");
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    expect(exporter.getFinishedSpans()[0]?.status).toEqual({
      code: SpanStatusCode.OK,
    });
  });
});
