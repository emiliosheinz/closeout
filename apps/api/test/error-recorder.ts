import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { registeredRoutes } from "./helpers";

const FIXTURE = path.join(__dirname, "fixtures", "error-responses.json");

/**
 * Records every error response the suites provoke as
 * `{"<METHOD> <route pattern> <status>": [messages]}`, merged into the
 * fixture file, so later changes to the error body can be compared with the
 * messages the API sends today. Installed ahead of every other middleware so
 * requests rejected before routing (origin check) are recorded too.
 */
export function installErrorRecorder(app: INestApplication): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    let body: unknown;
    const json = res.json.bind(res);
    res.json = (value: unknown) => {
      body = value;
      return json(value);
    };
    res.on("finish", () => {
      if (res.statusCode < 400) return;
      const pattern = req.route
        ? `${req.baseUrl}${req.route.path}`
        : matchRoute(app, req.method, req.path);
      record(`${req.method} ${pattern} ${res.statusCode}`, messagesOf(body));
    });
    next();
  });
}

function messagesOf(body: unknown): string[] {
  const message = (body as { message?: unknown } | undefined)?.message;
  if (typeof message === "string") return [message];
  if (Array.isArray(message)) return message.map(String);
  return [body === undefined ? "<no JSON body>" : JSON.stringify(body)];
}

/** Requests rejected before routing carry no `req.route`; match them by path. */
function matchRoute(
  app: INestApplication,
  method: string,
  requestPath: string,
): string {
  const candidates = registeredRoutes(app).filter(
    (route) =>
      (route.method === method || route.method === "ALL") &&
      new RegExp(`^${route.path.replace(/:[^/]+/g, "[^/]+")}/?$`).test(
        requestPath,
      ),
  );
  // Literal segments win over parameters, as in Express's registration order.
  candidates.sort(
    (a, b) =>
      (a.path.match(/:/g)?.length ?? 0) - (b.path.match(/:/g)?.length ?? 0),
  );
  return candidates[0]?.path ?? `<unmatched ${requestPath}>`;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Per-run ids would make every recording differ; keep the shape only. */
function record(rawKey: string, rawMessages: string[]): void {
  const key = rawKey.replace(UUID, ":uuid");
  const messages = rawMessages.map((message) => message.replace(UUID, ":uuid"));
  const fixture: Record<string, string[]> = existsSync(FIXTURE)
    ? JSON.parse(readFileSync(FIXTURE, "utf8"))
    : {};
  fixture[key] = [...new Set([...(fixture[key] ?? []), ...messages])].sort();
  const sorted = Object.fromEntries(
    Object.entries(fixture).sort(([a], [b]) => a.localeCompare(b)),
  );
  mkdirSync(path.dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, `${JSON.stringify(sorted, null, 2)}\n`);
}
