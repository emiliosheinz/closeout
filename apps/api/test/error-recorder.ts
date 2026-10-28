import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { registeredRoutes } from "./helpers";

const FIXTURE = path.join(__dirname, "fixtures", "error-responses.json");

/**
 * One error response the API sent before error bodies became problem
 * documents, keyed `"<METHOD> <route pattern> <status>"`. `recorded` holds
 * the messages captured then; `expectedDetail` is the `detail` every
 * response under the key must carry now (a list when several throw sites
 * share the key). `changedBy` names the behaviour change that moved the
 * outcome away from the recording.
 */
interface FixtureEntry {
  recorded: string[];
  expectedDetail: string | string[];
  changedBy?: string;
}

/**
 * Appends the `detail` of every error response the suites provoke to
 * `observedFile`, one JSON line per response. Installed ahead of every
 * other middleware so requests rejected before routing (origin check) are
 * observed too.
 */
export function installErrorObserver(
  app: INestApplication,
  observedFile: string,
): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    let body: unknown;
    const json = res.json.bind(res);
    res.json = (value: unknown) => {
      body = value;
      return json(value);
    };
    res.on("finish", () => {
      if (res.statusCode < 400) return;
      // Nest answers unknown routes from a catch-all `{/*splat}` route.
      const pattern =
        req.route && !String(req.route.path).includes("*")
          ? `${req.baseUrl}${req.route.path}`
          : matchRoute(app, req.method, req.path);
      const key = `${req.method} ${pattern} ${res.statusCode}`.replace(
        UUID,
        ":uuid",
      );
      const detail = (body as { detail?: unknown } | undefined)?.detail;
      appendFileSync(
        observedFile,
        `${JSON.stringify({ key, detail: typeof detail === "string" ? detail : `<no detail: ${JSON.stringify(body)}>` })}\n`,
      );
    });
    next();
  });
}

/**
 * Compares the observed responses with the fixture. Returns one line per
 * problem: an entry never observed (unless a behaviour change accounts for
 * it) or a key whose observed details differ from its expected ones.
 */
export function compareWithFixture(observedFile: string): string[] {
  const fixture: Record<string, FixtureEntry> = JSON.parse(
    readFileSync(FIXTURE, "utf8"),
  );
  const observed = new Map<string, Set<string>>();
  for (const line of readFileSync(observedFile, "utf8").split("\n")) {
    if (!line) continue;
    const { key, detail } = JSON.parse(line) as { key: string; detail: string };
    observed.set(key, (observed.get(key) ?? new Set()).add(detail));
  }
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(fixture)) {
    const seen = observed.get(key);
    if (!seen) {
      if (!entry.changedBy) problems.push(`${key}: never observed`);
      continue;
    }
    const expected = [entry.expectedDetail].flat().sort();
    const actual = [...seen].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(
        `${key}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual)}`,
      );
    }
  }
  return problems;
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
