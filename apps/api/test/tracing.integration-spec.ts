import { once } from "node:events";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createTcpServer, type Socket } from "node:net";
import path from "node:path";
import { type BuiltServer, freePort, startBuiltServer } from "./child-process";
import {
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  ORIGIN,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";
import {
  type ExportedSpan,
  exportedSpans,
  type OtlpStub,
  startOtlpStub,
} from "./otlp-stub";

const SENTINEL = "zq9sentinel";
const ALLOWED_KEYS = [
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
const SERVER = 2;
const STATUS_ERROR = 2;
/** Preloaded into the server: emits one OpenTelemetry log record once running. */
const EMIT_LOG_RECORD = path.join(__dirname, "emit-log-record.cjs");
/** A trace context whose caller chose not to sample it (flags 00). */
const UNSAMPLED_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const UNSAMPLED_PARENT = `00-${UNSAMPLED_TRACE_ID}-00f067aa0ba902b7-00`;

let ctx: TestContext;
let uploadUrl: string;
let cookie: string;
let bucket: Server;
let bucketRequests: string[];
let bucketFails: boolean;
let bucketEndpoint: string;

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDatabase(ctx.dataSource);
  const admin = await createStoreWithAdmin(ctx, "traced");
  const listing = await insertListing(ctx.dataSource, admin);
  uploadUrl = `/stores/${admin.storeId}/listings/${listing.id}/images`;
  cookie = admin.cookie;

  // Stands in for the S3-compatible bucket: accepts every object write.
  bucketRequests = [];
  bucket = createHttpServer((req, res) => {
    bucketRequests.push(`${req.method} ${req.url}`);
    req.resume();
    req.on("end", () => {
      if (!bucketFails) {
        res.writeHead(200, { etag: '"stub"' }).end();
        return;
      }
      res
        .writeHead(500, { "content-type": "application/xml" })
        .end(
          `<Error><Code>InternalError</Code><Message>${SENTINEL}-bucket</Message></Error>`,
        );
    });
  }).listen(0, "127.0.0.1");
  await once(bucket, "listening");
  const address = bucket.address();
  if (!address || typeof address === "string") throw new Error("No address");
  bucketEndpoint = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  bucket.closeAllConnections();
  bucket.close();
  await ctx.app.close();
});

describe("tracing", () => {
  let server: BuiltServer | undefined;
  let receiver: OtlpStub | undefined;
  beforeEach(() => {
    bucketRequests.length = 0;
    bucketFails = false;
  });
  afterEach(async () => {
    if (server && server.child.exitCode === null) server.child.kill("SIGKILL");
    server = undefined;
    await receiver?.close();
    receiver = undefined;
  });

  async function startTraced(
    env: NodeJS.ProcessEnv = {},
  ): Promise<BuiltServer> {
    receiver = await startOtlpStub();
    server = await startBuiltServer({
      OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url,
      S3_ENDPOINT: bucketEndpoint,
      S3_REGION: "us-east-1",
      S3_BUCKET: "media",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "bucket-secret",
      ...env,
    });
    return server;
  }

  /** Uploads one photo, carrying sentinels in the query, headers and body. */
  async function upload(base: string): Promise<Response> {
    const form = new FormData();
    form.append(
      "files",
      new Blob([new Uint8Array(await photo())], { type: "image/jpeg" }),
      `${SENTINEL}-photo.jpg`,
    );
    return fetch(`${base}${uploadUrl}?ref=${SENTINEL}-query`, {
      method: "POST",
      body: form,
      headers: {
        cookie,
        origin: ORIGIN,
        authorization: `Bearer ${SENTINEL}-authorization`,
        "user-agent": `${SENTINEL}-agent`,
        "x-note": `${SENTINEL}-header`,
      },
    });
  }

  /** Sends SIGTERM and waits for a clean exit, which flushes pending spans. */
  async function stop(run: BuiltServer): Promise<number> {
    const started = Date.now();
    run.child.kill("SIGTERM");
    expect(await run.exit).toEqual({ code: 0, signal: null });
    return Date.now() - started;
  }

  function descendsFrom(
    span: ExportedSpan,
    root: ExportedSpan,
    spans: ExportedSpan[],
  ): boolean {
    let current: ExportedSpan | undefined = span;
    while (current && current.traceId === root.traceId) {
      if (current.parentSpanId === root.spanId) return true;
      const parent: string = current.parentSpanId;
      current = spans.find((candidate) => candidate.spanId === parent);
    }
    return false;
  }

  it("traces a request with a server span and its pg and S3 children", async () => {
    const run = await startTraced();
    expect((await upload(run.url)).status).toBe(201);
    await stop(run);

    expect(bucketRequests.some((line) => line.startsWith("PUT "))).toBe(true);
    const spans = exportedSpans(receiver as OtlpStub);
    const root = spans.find(
      (span) =>
        span.kind === SERVER &&
        span.attributes["http.route"] ===
          "/stores/:storeId/listings/:id/images",
    );
    expect(root).toBeDefined();
    if (!root) return;
    expect(root.parentSpanId).toBe("");
    expect(root.attributes["http.request.method"]).toBe("POST");
    expect(root.attributes["http.response.status_code"]).toBe(201);

    const children = spans.filter((span) => descendsFrom(span, root, spans));
    const queries = children.filter(
      (span) => span.attributes["db.system.name"] === "postgresql",
    );
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query.attributes["db.query.text"]).toEqual(expect.any(String));
    }
    const puts = children.filter(
      (span) =>
        span.attributes["rpc.service"] === "S3" &&
        span.attributes["rpc.method"] === "PutObject",
    );
    expect(puts.length).toBeGreaterThan(0);
    expect(puts[0]?.attributes["aws.s3.bucket"]).toBe("media");
    // Outgoing HTTP client spans stay off: the S3 span covers the call.
    expect(children.filter((span) => span.name === "PUT")).toEqual([]);
    // All spans, not only the request's: the pool connects at boot too.
    expect(
      spans.filter((span) => /^pg(-pool)?\.connect/.test(span.name)),
    ).toEqual([]);
  });

  it("exports only allow-listed span data, never request secrets", async () => {
    const run = await startTraced();
    expect((await upload(run.url)).status).toBe(201);
    await stop(run);

    const spans = exportedSpans(receiver as OtlpStub);
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      for (const key of Object.keys(span.attributes)) {
        expect(ALLOWED_KEYS).toContain(key);
      }
      expect(span.events).toBe(0);
      expect(span.links).toBe(0);
      expect(span.status.message).toBe("");
    }
    const sessionToken = cookie.split("=")[1] as string;
    for (const request of (receiver as OtlpStub).requests) {
      expect(request.body.includes(SENTINEL)).toBe(false);
      expect(request.body.includes(sessionToken)).toBe(false);
    }
  });

  it("exports no error details from a failed S3 call", async () => {
    bucketFails = true;
    const run = await startTraced();
    await upload(run.url);
    await stop(run);

    const spans = exportedSpans(receiver as OtlpStub);
    const failed = spans.filter(
      (span) =>
        span.attributes["rpc.service"] === "S3" &&
        span.status.code === STATUS_ERROR,
    );
    expect(failed.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.events).toBe(0);
      expect(span.status.message).toBe("");
    }
    for (const request of (receiver as OtlpStub).requests) {
      expect(request.body.includes(SENTINEL)).toBe(false);
    }
  });

  it("keeps responses fast and shutdown bounded when the receiver hangs", async () => {
    // Accepts connections and never answers: every export runs into its timeout.
    const held: Socket[] = [];
    const hung = createTcpServer((socket) => held.push(socket)).listen(
      0,
      "127.0.0.1",
    );
    await once(hung, "listening");
    const address = hung.address();
    if (!address || typeof address === "string") throw new Error("No address");
    try {
      const run = await startTraced({
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${address.port}`,
      });
      // Spans the whole 5 s batch delay, so exports start while requests run.
      for (let i = 0; i < 20; i++) {
        const started = Date.now();
        const res = await fetch(`${run.url}/health`);
        expect(res.status).toBe(200);
        expect(Date.now() - started).toBeLessThan(1_000);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(held.length).toBeGreaterThan(0);
      expect(await stop(run)).toBeLessThan(6_000);
    } finally {
      for (const socket of held) socket.destroy();
      hung.close();
    }
  });

  it("keeps responses unchanged when nothing listens at the endpoint", async () => {
    const run = await startTraced({
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${await freePort()}`,
    });
    const res = await fetch(`${run.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      checks: { database: "up" },
    });
    expect(await stop(run)).toBeLessThan(6_000);
  });

  it("traces a request whose caller chose not to sample it", async () => {
    const run = await startTraced();
    const res = await fetch(`${run.url}/health`, {
      headers: { traceparent: UNSAMPLED_PARENT },
    });
    expect(res.status).toBe(200);
    await stop(run);

    const spans = exportedSpans(receiver as OtlpStub);
    expect(spans).toContainEqual(
      expect.objectContaining({
        traceId: UNSAMPLED_TRACE_ID,
        kind: SERVER,
        name: "GET /health",
      }),
    );
  });

  it("flushes the spans of a request on SIGTERM within the draining window", async () => {
    const run = await startTraced();
    expect((await fetch(`${run.url}/health`)).status).toBe(200);
    // The batch delay (5 s) has not passed: only the shutdown flush sends them.
    expect(await stop(run)).toBeLessThan(15_000);

    expect(exportedSpans(receiver as OtlpStub)).toContainEqual(
      expect.objectContaining({ kind: SERVER, name: "GET /health" }),
    );
  });

  it.each([
    ["unset", {}],
    ["set", { OTEL_METRICS_EXPORTER: "otlp", OTEL_LOGS_EXPORTER: "otlp" }],
  ])("sends traces only with the metrics and logs exporters %s", async (_case, env) => {
    const run = await startTraced({
      ...env,
      NODE_OPTIONS: `--require ${EMIT_LOG_RECORD}`,
    });
    expect((await fetch(`${run.url}/health`)).status).toBe(200);
    await stop(run);

    const paths = (receiver as OtlpStub).requests.map((r) => r.path);
    expect(paths).toContain("/v1/traces");
    expect(new Set(paths)).toEqual(new Set(["/v1/traces"]));
  });

  it("writes the request's trace id on its log lines", async () => {
    const run = await startTraced();
    expect((await upload(run.url)).status).toBe(201);
    await stop(run);

    const completion = run
      .stdout()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.msg === "request completed");
    expect(completion?.trace_id).toEqual(
      expect.stringMatching(/^[0-9a-f]{32}$/),
    );

    const root = exportedSpans(receiver as OtlpStub).find(
      (span) =>
        span.kind === SERVER &&
        span.attributes["http.request.method"] === "POST",
    );
    expect(completion?.trace_id).toBe(root?.traceId);
  });
});
