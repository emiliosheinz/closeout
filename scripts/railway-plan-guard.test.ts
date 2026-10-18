import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkPlan } from "./railway-plan-guard.ts";

const GUARD = path.join(import.meta.dirname, "railway-plan-guard.ts");
const FIXTURES = path.join(import.meta.dirname, "fixtures", "railway-plan");

const plan = (changes: object[], overrides: object = {}) => ({
  kind: "railway.config.plan",
  version: 1,
  cliVersion: "5.70.0",
  changeSet: { version: 1, changes, diagnostics: [] },
  ...overrides,
});

const real = (name: string) =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

const change = (kind: string, address: string, extra: object = {}) => ({
  kind,
  address,
  ...extra,
});

const NOT_A_PLAN = ["plan: not a version 1 Railway plan file"];

describe("railway plan guard", () => {
  describe("real captures", () => {
    for (const [name, problem] of [
      ["bucket-delete", "bucket.media: resource.delete on a data store"],
      ["postgres-delete", "database.postgres: resource.delete on a data store"],
      ["postgres-image", "database.postgres: resource.update on a data store"],
      ["postgres-variable", "database.postgres: variable.set on a data store"],
    ]) {
      it(`rejects ${name}`, () => {
        assert.deepEqual(checkPlan(real(name), false), [problem]);
      });
    }

    it("accepts a variable change on the api", () => {
      assert.deepEqual(checkPlan(real("api-variable"), false), []);
    });
  });

  describe("steady state", () => {
    it("accepts an empty plan", () => {
      assert.deepEqual(checkPlan(plan([]), false), []);
    });

    for (const [address, kind] of [
      ["volume.postgres-volume", "resource.update"],
      ["bucket.media", "resource.update"],
      ["database.postgres", "variable.delete"],
    ]) {
      it(`rejects ${kind} on ${address}`, () => {
        assert.deepEqual(checkPlan(plan([change(kind, address)]), false), [
          `${address}: ${kind} on a data store`,
        ]);
      });
    }

    it("rejects a volume attachment change", () => {
      assert.deepEqual(
        checkPlan(
          plan([
            change("resource.update", "service.api", {
              field: "volumeAttachments",
            }),
          ]),
          false,
        ),
        ["service.api: changes a volume attachment"],
      );
    });

    it("rejects an unknown change kind", () => {
      assert.deepEqual(
        checkPlan(plan([change("resource.replace", "service.api")]), false),
        ["service.api: unknown change kind resource.replace"],
      );
    });

    it("rejects an unknown resource type", () => {
      assert.deepEqual(
        checkPlan(plan([change("resource.update", "cluster.postgres")]), false),
        ["cluster.postgres: unknown resource type cluster"],
      );
    });

    it("rejects a change without kind or address", () => {
      assert.deepEqual(checkPlan(plan([{ kind: "resource.update" }]), false), [
        "change: missing kind or address",
      ]);
    });

    it("rejects an error diagnostic", () => {
      const diagnostics = [
        {
          severity: "error",
          path: "resources.bucket.media.config.region",
          message: "Bucket regions are immutable",
        },
      ];
      assert.deepEqual(
        checkPlan(
          plan([], { changeSet: { version: 1, changes: [], diagnostics } }),
          false,
        ),
        ["resources.bucket.media.config.region: Bucket regions are immutable"],
      );
    });

    it("rejects creating data stores outside setup", () => {
      assert.deepEqual(
        checkPlan(
          plan([
            change("resource.create", "database.postgres"),
            change("resource.create", "bucket.media"),
          ]),
          false,
        ),
        [
          "database.postgres: resource.create on a data store",
          "bucket.media: resource.create on a data store",
        ],
      );
    });
  });

  describe("not a usable plan file", () => {
    for (const [name, overrides] of [
      ["wrong kind", { kind: "something.else" }],
      ["wrong version", { version: 2 }],
      ["wrong change set version", { changeSet: { version: 2, changes: [] } }],
      ["missing diagnostics", { changeSet: { version: 1, changes: [] } }],
    ] as const) {
      it(`rejects ${name}`, () => {
        assert.deepEqual(checkPlan(plan([], overrides), false), NOT_A_PLAN);
      });
    }

    it("rejects a plan written by another CLI version", () => {
      assert.deepEqual(checkPlan(plan([], { cliVersion: "5.71.0" }), false), [
        "plan: written by CLI 5.71.0, expected 5.70.0",
      ]);
    });
  });

  describe("first-time setup", () => {
    it("accepts creating the database and the bucket", () => {
      assert.deepEqual(
        checkPlan(
          plan([
            change("resource.create", "database.postgres"),
            change("resource.create", "bucket.media", {
              resource: { config: { region: "iad" } },
            }),
          ]),
          true,
        ),
        [],
      );
    });

    it("rejects a bucket created outside iad", () => {
      assert.deepEqual(
        checkPlan(
          plan([
            change("resource.create", "bucket.media", {
              resource: { config: { region: "ams" } },
            }),
          ]),
          true,
        ),
        ["bucket.media: not created in iad"],
      );
    });

    it("rejects creating a volume", () => {
      assert.deepEqual(
        checkPlan(
          plan([change("resource.create", "volume.postgres-volume")]),
          true,
        ),
        ["volume.postgres-volume: resource.create on a data store"],
      );
    });

    it("still rejects deleting a data store", () => {
      assert.deepEqual(
        checkPlan(plan([change("resource.delete", "database.postgres")]), true),
        ["database.postgres: resource.delete on a data store"],
      );
    });
  });

  describe("command line", () => {
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [GUARD, ...args], { encoding: "utf8" });

    it("prints usage without a plan file", () => {
      const result = run();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^Usage:/m);
    });

    it("fails on a file that is not valid JSON", () => {
      const file = path.join(
        mkdtempSync(path.join(tmpdir(), "plan-")),
        "plan.json",
      );
      writeFileSync(file, '{"kind": "railway.config.plan",');
      const result = run(file);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^plan: cannot read/m);
    });

    it("exits 1 and names the problem for a rejected plan", () => {
      const result = run(path.join(FIXTURES, "bucket-delete.json"));
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /^bucket\.media: resource\.delete on a data store$/m,
      );
    });
  });
});
