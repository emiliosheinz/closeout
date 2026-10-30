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
