/**
 * Fails a Railway IaC plan that would touch the database or the media bucket.
 *
 *   node scripts/railway-plan-guard.ts <plan.json> --cli-version <x.y.z> [--setup]
 *
 * There are no backups, so a plan that deletes, replaces or reconfigures a data
 * store, its volume or its variables must never reach `railway config apply`.
 * The check reads the plan file written by `railway config plan --out` and
 * fails closed: anything it does not recognise is a failure, never a pass.
 *
 * `--setup` is for the one manual first apply of an environment. It also lets
 * a plan create a data store, which the plan only does when the store is
 * absent, as long as it is created with the expected image and region.
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

/**
 * Data-store changes that are allowed anyway, as `<kind> <address>`. Empty on
 * purpose: an entry here is a reviewed exception, not a default.
 */
const ALLOWED: string[] = [];

// Restated here rather than imported from .railway/railway.ts, so that editing
// the declaration alone cannot also relax what a first apply may create.
const POSTGRES_IMAGE = "ghcr.io/railwayapp-templates/postgres-ssl:18";
const DEPLOY_REGION = "us-east4-eqdc4a";
const BUCKET_REGION = "iad";

interface Change {
  kind?: unknown;
  address?: unknown;
  field?: unknown;
  resource?: {
    image?: unknown;
    config?: { region?: unknown };
    deploy?: { multiRegionConfig?: Record<string, unknown> };
  };
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
function checkPlan(
  plan: Plan,
  options: { cliVersion: string; setup: boolean },
): string[] {
  if (
    plan?.kind !== "railway.config.plan" ||
    plan.version !== 1 ||
    plan.changeSet?.version !== 1 ||
    !Array.isArray(plan.changeSet.changes) ||
    !Array.isArray(plan.changeSet.diagnostics)
  ) {
    return ["plan: not a version 1 Railway plan file"];
  }
  if (plan.cliVersion !== options.cliVersion) {
    return [
      `plan: written by CLI ${String(plan.cliVersion)}, expected ${options.cliVersion}`,
    ];
  }

  const problems: string[] = [];
  for (const diagnostic of plan.changeSet.diagnostics) {
    if (diagnostic?.severity === "error") {
      problems.push(`${diagnostic.path}: ${diagnostic.message}`);
    }
  }
  for (const change of plan.changeSet.changes as Change[]) {
    const problem = checkChange(change, options.setup);
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
  if (ALLOWED.includes(`${change.kind} ${address}`)) return null;
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
    return checkCreate(type, address, change.resource);
  }
  return `${address}: ${change.kind} on a data store`;
}

function checkCreate(
  type: string,
  address: string,
  resource: Change["resource"],
): string | null {
  if (type === "database") {
    if (resource?.image !== POSTGRES_IMAGE) {
      return `${address}: created with image ${String(resource?.image)}, expected ${POSTGRES_IMAGE}`;
    }
    if (!resource.deploy?.multiRegionConfig?.[DEPLOY_REGION]) {
      return `${address}: not created in ${DEPLOY_REGION}`;
    }
    return null;
  }
  if (type === "bucket") {
    if (resource?.config?.region !== BUCKET_REGION) {
      return `${address}: not created in ${BUCKET_REGION}`;
    }
    return null;
  }
  return `${address}: resource.create on a data store`;
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "cli-version": { type: "string" },
      setup: { type: "boolean", default: false },
    },
  });
  const [file] = positionals;
  const cliVersion = values["cli-version"];
  if (!file || !cliVersion) {
    console.error(
      "Usage: railway-plan-guard.ts <plan.json> --cli-version <x.y.z> [--setup]",
    );
    process.exit(1);
  }

  let plan: Plan;
  try {
    plan = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`plan: cannot read ${file}: ${(err as Error).message}`);
    process.exit(1);
  }

  const problems = checkPlan(plan, { cliVersion, setup: values.setup });
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log("Plan leaves the database and the bucket untouched.");
}

if (import.meta.main) main();
