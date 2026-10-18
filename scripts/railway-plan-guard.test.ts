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
  for (const [name, resource] of [
    ["bucket-delete.json", "bucket.media"],
    ["postgres-delete.json", "database.postgres"],
    ["postgres-image.json", "database.postgres"],
    ["volume-change.json", "volume.postgres-volume"],
    ["volume-attachment.json", "service.api"],
    ["postgres-variable.json", "database.postgres"],
    ["unknown-kind.json", "service.api"],
    ["diagnostic-error.json", "resources.bucket.media.config.region"],
    ["unknown-resource-type.json", "cluster.postgres"],
    ["missing-address.json", "change"],
    ["wrong-version.json", "plan"],
  ]) {
    it(`rejects ${name}, naming ${resource}`, () => {
      const { status, output } = guard(fixture(name));
      assert.equal(status, 1);
      assert.match(
        output,
        new RegExp(`^${resource.replaceAll(".", "\\.")}:`, "m"),
      );
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
        fixture("setup-create-postgres-18.json"),
        "--setup",
      );
      assert.equal(status, 1);
      assert.match(output, /^database\.postgres: created with image .*:18/m);
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

    it("still rejects deleting a data store", () => {
      const { status, output } = guard(fixture("setup-delete.json"), "--setup");
      assert.equal(status, 1);
      assert.match(output, /^database\.postgres: resource\.delete/m);
    });
  });
});
