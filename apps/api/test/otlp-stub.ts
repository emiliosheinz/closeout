import { once } from "node:events";
import { createServer } from "node:http";

export interface OtlpRequest {
  path: string;
  body: Buffer;
}

export interface OtlpStub {
  url: string;
  /** Every request received so far, in arrival order. */
  requests: OtlpRequest[];
  close: () => Promise<void>;
}

/**
 * Stands in for an OTLP/HTTP receiver: accepts every export with an empty
 * success response and records it. `port` 0 picks a free one.
 */
export async function startOtlpStub(port = 0): Promise<OtlpStub> {
  const requests: OtlpRequest[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({ path: req.url ?? "", body: Buffer.concat(chunks) });
      res.writeHead(200, { "content-type": "application/x-protobuf" }).end();
    });
  }).listen(port);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
  };
}

export interface ExportedSpan {
  traceId: string;
  spanId: string;
  /** Empty for a root span. */
  parentSpanId: string;
  name: string;
  /** OTLP span kind: 2 server, 3 client. */
  kind: number;
  attributes: Record<string, string | number | boolean | null>;
  events: number;
  links: number;
  status: { code: number; message: string };
}

/** Every span in the trace export requests received so far. */
export function exportedSpans(stub: OtlpStub): ExportedSpan[] {
  return stub.requests
    .filter((request) => request.path === "/v1/traces")
    .flatMap((request) => decodeTraceRequest(request.body));
}

/**
 * Decodes an OTLP ExportTraceServiceRequest (protobuf) into the span fields
 * the tests read, following the opentelemetry-proto field numbers.
 */
export function decodeTraceRequest(body: Buffer): ExportedSpan[] {
  return messages(body, 1)
    .flatMap((resourceSpans) => messages(resourceSpans, 2))
    .flatMap((scopeSpans) => messages(scopeSpans, 2))
    .map(decodeSpan);
}

function decodeSpan(span: Buffer): ExportedSpan {
  const all = [...fields(span)];
  const bytes = (no: number) =>
    (all.find((field) => field.no === no)?.value as Buffer | undefined) ??
    Buffer.alloc(0);
  const status = [...fields(bytes(15))];
  return {
    traceId: bytes(1).toString("hex"),
    spanId: bytes(2).toString("hex"),
    parentSpanId: bytes(4).toString("hex"),
    name: bytes(5).toString("utf8"),
    kind: Number(all.find((field) => field.no === 6)?.value ?? 0),
    attributes: Object.fromEntries(
      all
        .filter((field) => field.no === 9)
        .map((field) => keyValue(field.value as Buffer)),
    ),
    events: all.filter((field) => field.no === 11).length,
    links: all.filter((field) => field.no === 13).length,
    status: {
      code: Number(status.find((field) => field.no === 3)?.value ?? 0),
      message: (
        (status.find((field) => field.no === 2)?.value as Buffer | undefined) ??
        Buffer.alloc(0)
      ).toString("utf8"),
    },
  };
}

function keyValue(pair: Buffer): [string, string | number | boolean | null] {
  let key = "";
  let value: string | number | boolean | null = null;
  for (const field of fields(pair)) {
    if (field.no === 1) key = (field.value as Buffer).toString("utf8");
    if (field.no === 2) value = anyValue(field.value as Buffer);
  }
  return [key, value];
}

/** String, bool and int values; any other kind reads as null. */
function anyValue(value: Buffer): string | number | boolean | null {
  for (const field of fields(value)) {
    if (field.no === 1) return (field.value as Buffer).toString("utf8");
    if (field.no === 2) return field.value === 1n;
    if (field.no === 3) return Number(field.value);
  }
  return null;
}

function messages(message: Buffer, no: number): Buffer[] {
  return [...fields(message)]
    .filter((field) => field.no === no)
    .map((field) => field.value as Buffer);
}

interface Field {
  no: number;
  /** A varint, or the raw bytes of any other wire type. */
  value: bigint | Buffer;
}

function* fields(message: Buffer): Generator<Field> {
  let pos = 0;
  const varint = (): bigint => {
    let result = 0n;
    for (let shift = 0n; ; shift += 7n) {
      const byte = message[pos++];
      if (byte === undefined) throw new Error("Truncated varint");
      result |= BigInt(byte & 0x7f) << shift;
      if (byte < 0x80) return result;
    }
  };
  const take = (length: number): Buffer => {
    const value = message.subarray(pos, pos + length);
    pos += length;
    return value;
  };
  while (pos < message.length) {
    const key = Number(varint());
    const no = key >>> 3;
    switch (key & 7) {
      case 0:
        yield { no, value: varint() };
        break;
      case 1:
        yield { no, value: take(8) };
        break;
      case 2:
        yield { no, value: take(Number(varint())) };
        break;
      case 5:
        yield { no, value: take(4) };
        break;
      default:
        throw new Error(`Unsupported wire type ${key & 7}`);
    }
  }
}
