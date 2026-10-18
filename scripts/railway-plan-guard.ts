/**
 * Fails a Railway IaC plan that would touch the database or the media bucket.
 *
 *   node scripts/railway-plan-guard.ts <plan.json> [--setup]
 *
 * There are no backups, so the check fails closed: anything it does not
 * recognise is a failure. `--setup` is for the first apply of an empty
 * environment: it also lets the plan create the database and the bucket.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const GUARDED_TYPES = new Set(["database", "bucket", "volume"]);
const UNGUARDED_TYPES = new Set(["service", "group"]);

const KNOWN_KINDS = new Set([
  "resource.create",
  "resource.update",
  "resource.delete",
  "variable.set",
  "variable.delete",
]);

// Must match RAILWAY_CLI_VERSION in .github/workflows/railway.yml.
const CLI_VERSION = "5.70.0";

// Restated here so editing .railway/railway.ts alone cannot relax this.
const BUCKET_REGION = "iad";

interface Change {
  kind?: unknown;
  address?: unknown;
  field?: unknown;
  resource?: { config?: { region?: unknown } };
}

interface Plan {
  kind?: unknown;
  version?: unknown;
  cliVersion?: unknown;
  changeSet?: {
    version?: unknown;
    changes?: unknown;
    diagnostics?: unknown;
  };
}

/** Every reason the plan must not be applied; empty when it is safe. */
export function checkPlan(plan: Plan, setup: boolean): string[] {
  if (
    plan?.kind !== "railway.config.plan" ||
    plan.version !== 1 ||
    plan.changeSet?.version !== 1 ||
    !Array.isArray(plan.changeSet.changes) ||
    !Array.isArray(plan.changeSet.diagnostics)
  ) {
    return ["plan: not a version 1 Railway plan file"];
  }
  if (plan.cliVersion !== CLI_VERSION) {
    return [
      `plan: written by CLI ${String(plan.cliVersion)}, expected ${CLI_VERSION}`,
    ];
  }

  const problems: string[] = [];
  for (const diagnostic of plan.changeSet.diagnostics) {
    if (diagnostic?.severity === "error") {
      problems.push(`${diagnostic.path}: ${diagnostic.message}`);
    }
  }
  for (const change of plan.changeSet.changes as Change[]) {
    const problem = checkChange(change, setup);
    if (problem) problems.push(problem);
  }
  return problems;
}

function checkChange(change: Change, setup: boolean): string | null {
  const address = typeof change?.address === "string" ? change.address : "";
  if (!address || typeof change.kind !== "string") {
    return `${address || "change"}: missing kind or address`;
  }
  if (!KNOWN_KINDS.has(change.kind)) {
    return `${address}: unknown change kind ${change.kind}`;
  }
  // Attaching or detaching a volume shows up on the owner, whatever it is.
  if (
    change.kind === "resource.update" &&
    change.field === "volumeAttachments"
  ) {
    return `${address}: changes a volume attachment`;
  }

  const [type] = address.split(".");
  if (UNGUARDED_TYPES.has(type)) return null;
  if (!GUARDED_TYPES.has(type)) {
    return `${address}: unknown resource type ${type}`;
  }
  if (setup && change.kind === "resource.create") {
    if (type === "database") return null;
    if (
      type === "bucket" &&
      change.resource?.config?.region === BUCKET_REGION
    ) {
      return null;
    }
    if (type === "bucket") return `${address}: not created in ${BUCKET_REGION}`;
  }
  return `${address}: ${change.kind} on a data store`;
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      setup: { type: "boolean", default: false },
    },
  });
  const [file] = positionals;
  if (!file) {
    console.error("Usage: railway-plan-guard.ts <plan.json> [--setup]");
    process.exit(1);
  }

  let plan: Plan;
  try {
    plan = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`plan: cannot read ${file}: ${(err as Error).message}`);
    process.exit(1);
  }

  const problems = checkPlan(plan, values.setup);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log("Plan leaves the database and the bucket untouched.");
}

if (import.meta.main) main();
