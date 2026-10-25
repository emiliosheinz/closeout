import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

const PANEL = join(process.cwd(), "src/app/admin/(panel)");

const LOADINGS: [string, () => Promise<{ default: ComponentType }>][] = [
  ["(listings)", () => import("@/app/admin/(panel)/(listings)/loading")],
  ["equipe", () => import("@/app/admin/(panel)/equipe/loading")],
  ["loja", () => import("@/app/admin/(panel)/loja/loading")],
  ["anuncios/novo", () => import("@/app/admin/(panel)/anuncios/novo/loading")],
  ["anuncios/[id]", () => import("@/app/admin/(panel)/anuncios/[id]/loading")],
  [
    "anuncios/[id]/previa",
    () => import("@/app/admin/(panel)/anuncios/[id]/previa/loading"),
  ],
];

describe("admin loading states", () => {
  it("has a loading file for every route segment that has one on disk", () => {
    const onDisk = readdirSync(PANEL, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith("loading.tsx"))
      .map((file) => dirname(file));
    expect(LOADINGS.map(([route]) => route).sort()).toEqual(onDisk.sort());
  });

  it.each(LOADINGS)("/admin/%s renders a busy region", async (_route, load) => {
    const { default: Loading } = await load();
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
