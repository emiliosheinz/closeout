import { dehydrate, QueryClient, useQuery } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { type AdminImage, listingKeys, listingReads } from "@/entities/listing";
import { readQuery } from "@/shared/api";
import { renderWithFeedback } from "@/test/feedback-harness";
import { problemResponse } from "@/test/fixtures";
import { PhotoManager } from "../photo-manager";

const image = (id: string): AdminImage => ({
  id,
  position: 0,
  width: 10,
  height: 10,
  urls: { sm: `/${id}-sm.jpg`, lg: `/${id}-lg.jpg` },
});

const detail = (images: AdminImage[]) => ({
  id: "l1",
  slug: "sofa",
  title: "Sofá",
  priceCents: 1000,
  condition: "good",
  availability: "available",
  publication: "draft",
  category: { id: "c", name: "Móveis" },
  sellers: [],
  coverUrl: null,
  imageCount: images.length,
  updatedAt: "2026-10-17T12:00:00.000Z",
  description: "",
  attributes: [],
  images,
});

const file = (name: string, type = "image/jpeg") =>
  new File(["x"], name, { type });

let server: AdminImage[];
let failPostsFrom: number;
let failGets: boolean;
let holdPosts: Promise<void> | undefined;
let posts: number;
let calls: { method: string; url: string; files?: number }[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  server = [image("a"), image("b"), image("c")];
  failPostsFrom = Number.POSITIVE_INFINITY;
  failGets = false;
  holdPosts = undefined;
  posts = 0;
  calls = [];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (!url.startsWith("/api/v1")) return new Response(null, { status: 204 });
    const path = url.replace("/api/v1", "");
    calls.push({
      method,
      url: path,
      files:
        init?.body instanceof FormData
          ? init.body.getAll("files").length
          : undefined,
    });
    if (method === "GET" && path === "/stores/s1/listings") {
      return Response.json({ items: [] });
    }
    if (method === "GET") {
      return failGets
        ? Response.json({ message: "fora do ar" }, { status: 500 })
        : Response.json(detail(server));
    }
    if (method === "POST") {
      await holdPosts;
      if (++posts >= failPostsFrom) {
        return problemResponse(422, "Imagem inválida.");
      }
      const count = (init?.body as FormData).getAll("files").length;
      for (let i = 0; i < count; i++) server.push(image(`n${posts}-${i}`));
      return Response.json({ items: server });
    }
    if (method === "PUT") {
      const { ids } = JSON.parse(init?.body as string) as { ids: string[] };
      server = ids.map((id) => server.find((item) => item.id === id) as never);
      // A body the client cannot parse: the grid must still follow the server.
      return Response.json({ unexpected: true });
    }
    server = server.filter((item) => !path.endsWith(`/${item.id}`));
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const writes = () => calls.filter(({ method }) => method !== "GET");
const altOrder = () =>
  screen.getAllByRole("img").map((img) => img.getAttribute("src"));

function renderManager() {
  // The page hydrates the listing, so the grid starts from the cache.
  const seed = new QueryClient();
  seed.setQueryData(listingKeys.detail("s1", "l1"), detail(server));
  return renderWithFeedback(
    <PhotoManager storeId="s1" listingId="l1" />,
    dehydrate(seed),
  );
}

function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByRole("button", { name: "Adicionar fotos" }), {
    dataTransfer: {
      files,
      items: files.map((f) => ({
        kind: "file",
        type: f.type,
        getAsFile: () => f,
      })),
      types: ["Files"],
    },
  });
}

function pickFiles(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLElement;
  fireEvent.change(input, { target: { files } });
}

describe("PhotoManager", () => {
  it("makes the same upload call and one toast for a drop as for the picker", async () => {
    const { container } = renderManager();
    const files = [file("1.jpg"), file("2.png", "image/png")];

    pickFiles(container, files);
    expect(await screen.findByText("2 fotos adicionadas.")).toBeVisible();
    const picked = writes();

    calls = [];
    dropFiles(files);
    await waitFor(() => expect(writes()).toHaveLength(picked.length));
    expect(writes()).toEqual(picked);
    expect(picked).toEqual([
      { method: "POST", url: "/stores/s1/listings/l1/images", files: 2 },
    ]);
    await waitFor(() =>
      expect(screen.getAllByText("2 fotos adicionadas.")).toHaveLength(2),
    );
  });

  it("toasts the singular for one photo", async () => {
    renderManager();
    dropFiles([file("1.jpg")]);
    expect(await screen.findByText("Foto adicionada.")).toBeVisible();
  });

  it("shows only the k of n toast when a later batch fails", async () => {
    failPostsFrom = 2;
    renderManager();
    dropFiles(Array.from({ length: 10 }, (_, i) => file(`${i}.jpg`)));

    expect(
      await screen.findByText(
        "8 de 10 fotos enviadas. Tente enviar as outras de novo.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/adicionadas/)).not.toBeInTheDocument();
    expect(screen.queryByText("Imagem inválida.")).not.toBeInTheDocument();
    expect(toast.getToasts()).toHaveLength(1);
    // The 8 stored photos show without a reload.
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(11));
  });

  it("counts the photos stored by the batches that went through when one of several is sent", async () => {
    failPostsFrom = 2;
    renderManager();
    dropFiles(Array.from({ length: 9 }, (_, i) => file(`${i}.jpg`)));

    expect(
      await screen.findByText(
        "8 de 9 fotos enviadas. Tente enviar as outras de novo.",
      ),
    ).toBeVisible();
    expect(writes().map(({ files }) => files)).toEqual([8, 1]);
    expect(toast.getToasts()).toHaveLength(1);
  });

  it("shows the server order after Usar como capa even when the response is unreadable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderManager();

    fireEvent.click(
      screen.getByRole("button", { name: "Usar foto 3 como capa" }),
    );

    expect(await screen.findByText("Capa atualizada.")).toBeVisible();
    expect(writes()).toEqual([
      { method: "PUT", url: "/stores/s1/listings/l1/images/order" },
    ]);
    expect(
      JSON.parse(
        fetchMock.mock.calls.find(([, i]) => i?.method === "PUT")?.[1].body,
      ),
    ).toEqual({
      ids: ["c", "a", "b"],
    });
    await waitFor(() =>
      expect(altOrder()).toEqual(["/c-sm.jpg", "/a-sm.jpg", "/b-sm.jpg"]),
    );
  });

  it("moves a photo right and toasts the new order", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderManager();

    fireEvent.click(
      screen.getByRole("button", { name: "Mover foto 1 para a direita" }),
    );

    expect(await screen.findByText("Ordem atualizada.")).toBeVisible();
    await waitFor(() =>
      expect(altOrder()).toEqual(["/b-sm.jpg", "/a-sm.jpg", "/c-sm.jpg"]),
    );
  });

  it("removes a photo and shows the server list", async () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Remover foto 2" }));

    expect(await screen.findByText("Foto removida.")).toBeVisible();
    expect(writes()).toEqual([
      { method: "DELETE", url: "/stores/s1/listings/l1/images/b" },
    ]);
    await waitFor(() => expect(altOrder()).toEqual(["/a-sm.jpg", "/c-sm.jpg"]));
  });

  it("shows one toast with the server message when the first batch fails", async () => {
    failPostsFrom = 1;
    renderManager();
    dropFiles([file("1.jpg"), file("2.jpg")]);

    expect(await screen.findByText("Imagem inválida.")).toBeVisible();
    expect(
      screen.queryByText(/ de \d+ fotos enviadas/),
    ).not.toBeInTheDocument();
    expect(toast.getToasts()).toHaveLength(1);
  });

  it("uploads only what fits and toasts the skipped count", async () => {
    server = Array.from({ length: 19 }, (_, i) => image(`p${i}`));
    renderManager();
    dropFiles([file("1.jpg"), file("2.jpg")]);

    expect(
      await screen.findByText("1 foto não enviada: limite de 20."),
    ).toBeInTheDocument();
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: "POST", files: 1 });
  });

  it("refetches the listing list as well as the detail after a change", async () => {
    // Only observed queries refetch, so mount the list beside the manager.
    function ListProbe() {
      useQuery(readQuery(listingReads.list("s1")));
      return null;
    }
    const seed = new QueryClient();
    seed.setQueryData(listingKeys.detail("s1", "l1"), detail(server));
    renderWithFeedback(
      <>
        <ListProbe />
        <PhotoManager storeId="s1" listingId="l1" />
      </>,
      dehydrate(seed),
    );
    const reads = () => calls.filter(({ method }) => method === "GET");
    await waitFor(() =>
      expect(reads().map(({ url }) => url)).toEqual(["/stores/s1/listings"]),
    );
    calls = [];

    fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));

    await screen.findByText("Foto removida.");
    await waitFor(() =>
      expect(
        reads()
          .map(({ url }) => url)
          .sort(),
      ).toEqual(["/stores/s1/listings", "/stores/s1/listings/l1"]),
    );
  });

  it("disables the controls while a change is in flight", async () => {
    let release = () => {};
    holdPosts = new Promise((resolve) => {
      release = resolve;
    });
    renderManager();
    dropFiles([file("1.jpg")]);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remover foto 1" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "Mover foto 1 para a direita" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Usar foto 2 como capa" }),
    ).toBeDisabled();

    release();
    await screen.findByText("Foto adicionada.");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remover foto 1" }),
      ).toBeEnabled(),
    );
  });

  it("keeps the cached grid when a refetch fails", async () => {
    const { client } = renderManager();
    failGets = true;

    await client.invalidateQueries({
      queryKey: listingKeys.detail("s1", "l1"),
    });

    expect(altOrder()).toEqual(["/a-sm.jpg", "/b-sm.jpg", "/c-sm.jpg"]);
  });
});
