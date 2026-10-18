import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const GUARD = path.join(import.meta.dirname, "railway-plan-guard.ts");
const FIXTURES = path.join(import.meta.dirname, "fixtures", "railway-plan");

function guard(file: string, ...flags: string[]) {
  const result = spawnSync(
    process.execPath,
    [GUARD, file, "--cli-version", "5.70.0", ...flags],
    { encoding: "utf8" },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

const fixture = (name: string) => path.join(FIXTURES, name);

describe("railway plan guard", () => {
  for (const [name, problem] of [
    ["bucket-delete.json", "bucket.media: resource.delete on a data store"],
    [
      "postgres-delete.json",
      "database.postgres: resource.delete on a data store",
    ],
    [
      "postgres-image.json",
      "database.postgres: resource.update on a data store",
    ],
    [
      "volume-change.json",
      "volume.postgres-volume: resource.update on a data store",
    ],
    ["volume-attachment.json", "service.api: changes a volume attachment"],
    [
      "postgres-variable.json",
      "database.postgres: variable.set on a data store",
    ],
    ["unknown-kind.json", "service.api: unknown change kind resource.replace"],
    [
      "diagnostic-error.json",
      "resources.bucket.media.config.region: Bucket regions are immutable",
    ],
    [
      "unknown-resource-type.json",
      "cluster.postgres: unknown resource type cluster",
    ],
    ["missing-address.json", "change: missing kind or address"],
    ["wrong-version.json", "plan: not a version 1 Railway plan file"],
    ["wrong-kind.json", "plan: not a version 1 Railway plan file"],
    [
      "wrong-change-set-version.json",
      "plan: not a version 1 Railway plan file",
    ],
    ["missing-diagnostics.json", "plan: not a version 1 Railway plan file"],
  ]) {
    it(`rejects ${name}: ${problem}`, () => {
      const { status, output } = guard(fixture(name));
      assert.equal(status, 1);
      assert.ok(output.split("\n").includes(problem), output);
    });
  }

  it("rejects a file that is not valid JSON", () => {
    const file = path.join(
      mkdtempSync(path.join(tmpdir(), "plan-")),
      "plan.json",
    );
    writeFileSync(file, '{"kind": "railway.config.plan",');
    const { status, output } = guard(file);
    assert.equal(status, 1);
    assert.match(output, /^plan: cannot read/m);
  });

  it("rejects a plan written by another CLI version", () => {
    const result = spawnSync(
      process.execPath,
      [GUARD, fixture("empty.json"), "--cli-version", "5.69.0"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /written by CLI 5\.70\.0, expected 5\.69\.0/);
  });

  it("refuses to run without the expected CLI version", () => {
    const result = spawnSync(process.execPath, [GUARD, fixture("empty.json")], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Usage:/m);
  });

  for (const name of ["empty.json", "api-variable.json"]) {
    it(`accepts ${name}`, () => {
      assert.equal(guard(fixture(name)).status, 0);
    });
  }

  describe("first-time setup", () => {
    it("rejects creating data stores outside setup", () => {
      const { status, output } = guard(fixture("setup-create.json"));
      assert.equal(status, 1);
      assert.match(output, /^database\.postgres:/m);
      assert.match(output, /^bucket\.media:/m);
    });

    it("accepts creating the database and bucket with the expected image and region", () => {
      assert.equal(guard(fixture("setup-create.json"), "--setup").status, 0);
    });

    it("rejects creating the database with another Postgres major", () => {
      const { status, output } = guard(
        fixture("setup-create-postgres-17.json"),
        "--setup",
      );
      assert.equal(status, 1);
      assert.match(output, /^database\.postgres: created with image .*:17/m);
    });

    for (const [name, resource, region] of [
      [
        "setup-create-postgres-region.json",
        "database.postgres",
        "us-east4-eqdc4a",
      ],
      ["setup-create-bucket-region.json", "bucket.media", "iad"],
    ]) {
      it(`rejects ${name}, created outside ${region}`, () => {
        const { status, output } = guard(fixture(name), "--setup");
        assert.equal(status, 1);
        assert.match(
          output,
          new RegExp(
            `^${resource.replace(".", "\\.")}: not created in ${region}`,
            "m",
          ),
        );
      });
    }

    it("rejects creating a volume", () => {
      const { status, output } = guard(
        fixture("setup-create-volume.json"),
        "--setup",
      );
      assert.equal(status, 1);
      assert.match(
        output,
        /^volume\.postgres-volume: resource\.create on a data store$/m,
      );
    });

    it("still rejects deleting a data store", () => {
      const { status, output } = guard(fixture("setup-delete.json"), "--setup");
      assert.equal(status, 1);
      assert.match(output, /^database\.postgres: resource\.delete/m);
    });
  });
});
