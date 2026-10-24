import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

const PANEL = join(process.cwd(), "src/app/admin/(panel)");

// The admin routes that load data on the server, as route segments.
const ROUTES = [
  "(listings)",
  "equipe",
  "loja",
  "anuncios/novo",
  "anuncios/[id]",
  "anuncios/[id]/previa",
];

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
  it.each(ROUTES)("has a loading file for /admin/%s", (route) => {
    expect(existsSync(join(PANEL, route, "loading.tsx"))).toBe(true);
  });

  it("covers every route that loads data", () => {
    expect(LOADINGS.map(([route]) => route)).toEqual(ROUTES);
  });

  it.each(LOADINGS)("/admin/%s renders a busy region", async (_route, load) => {
    const { default: Loading } = await load();
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
