import { createConnection, createServer, type Socket } from "node:net";

export type ProxyMode = "forward" | "refuse" | "blackhole";

/**
 * A TCP proxy in front of a real server whose behaviour a test switches:
 * `forward` relays bytes, `refuse` drops every connection, `blackhole`
 * stalls open connections and accepts new ones without ever replying.
 * Switching back to `forward` delivers whatever was stalled.
 */
export interface TcpProxy {
  port: number;
  setMode(mode: ProxyMode): void;
  close(): Promise<void>;
}

export async function startTcpProxy(
  targetHost: string,
  targetPort: number,
): Promise<TcpProxy> {
  let mode: ProxyMode = "forward";
  const pairs = new Set<{ client: Socket; upstream?: Socket }>();

  const connectUpstream = (pair: { client: Socket; upstream?: Socket }) => {
    const upstream = createConnection(targetPort, targetHost);
    pair.upstream = upstream;
    pair.client.on("data", (chunk) => upstream.write(chunk));
    upstream.on("data", (chunk) => pair.client.write(chunk));
    upstream.on("close", () => pair.client.destroy());
    upstream.on("error", () => pair.client.destroy());
    pair.client.resume();
  };

  const server = createServer({ pauseOnConnect: true }, (client) => {
    if (mode === "refuse") {
      client.destroy();
      return;
    }
    const pair: { client: Socket; upstream?: Socket } = { client };
    pairs.add(pair);
    client.on("close", () => {
      pair.upstream?.destroy();
      pairs.delete(pair);
    });
    client.on("error", () => client.destroy());
    if (mode === "forward") connectUpstream(pair);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy has no TCP address");
  }

  return {
    port: address.port,
    setMode(next) {
      mode = next;
      for (const pair of pairs) {
        if (next === "refuse") {
          pair.client.destroy();
        } else if (next === "blackhole") {
          pair.client.pause();
          pair.upstream?.pause();
        } else if (pair.upstream) {
          pair.client.resume();
          pair.upstream.resume();
        } else {
          connectUpstream(pair);
        }
      }
    },
    async close() {
      for (const pair of pairs) pair.client.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
