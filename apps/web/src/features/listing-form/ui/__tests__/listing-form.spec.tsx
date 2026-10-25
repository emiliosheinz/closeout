import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { toast } from "sonner";
import { type AdminListingDetail, listingKeys } from "@/entities/listing";
import { renderWithFeedback } from "@/test/feedback-harness";
import { ListingForm } from "../listing-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockReset();
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "GET") return json(listing);
    if (url.endsWith("/images")) return json({ items: [] }, 201);
    if (init?.method === "POST") return json({ id: "new-listing" }, 201);
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const apiCalls = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) =>
        String(url).startsWith("/api/v1") &&
        (init as RequestInit).method !== "GET",
    )
    .map(([url, init]) => ({
      method: (init as RequestInit).method,
      path: String(url).replace("/api/v1", ""),
      body:
        typeof (init as RequestInit).body === "string"
          ? JSON.parse((init as RequestInit).body as string)
          : (init as RequestInit).body,
    }));

const seller = (id: string, displayName: string) => ({
  id,
  userId: `user-${id}`,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 0,
});

const categories = [{ id: "c", slug: "moveis", name: "Móveis" }];
const sellers = [seller("ana", "Ana"), seller("bia", "Bia")];

const listing: AdminListingDetail = {
  id: "listing-1",
  slug: "mesa",
  title: "Mesa",
  priceCents: 10000,
  condition: "good",
  availability: "available",
  publication: "draft",
  category: { id: "c", name: "Móveis" },
  sellers: [
    { id: "ana", displayName: "Ana" },
    { id: "bia", displayName: "Bia" },
  ],
  coverUrl: null,
  imageCount: 0,
  updatedAt: "2026-10-17T12:00:00.000Z",
  description: "",
  attributes: [],
  images: [],
};

function cachedDetail(detail: AdminListingDetail) {
  const client = new QueryClient();
  client.setQueryData(listingKeys.detail("store", detail.id), detail);
  return dehydrate(client);
}

const renderForm = (props: {
  canAssignSellers?: boolean;
  listing?: AdminListingDetail;
  categories?: { id: string; slug: string; name: string }[];
}) =>
  renderWithFeedback(
    <ListingForm
      storeId="store"
      categories={props.categories ?? categories}
      sellers={sellers}
      ownSellerId="bia"
      canAssignSellers={props.canAssignSellers ?? true}
      listingId={props.listing?.id}
    />,
    props.listing && cachedDetail(props.listing),
  );

const renderNew = (canAssignSellers = true) => renderForm({ canAssignSellers });

const title = () => screen.getByLabelText("Nome do item");
const price = () => screen.getByLabelText("Preço (R$)");
const saveDraft = () =>
  screen.getByRole("button", { name: /^Salvar rascunho|^Salvando/ });

function drop(files: File[]) {
  fireEvent.drop(screen.getByRole("button", { name: "Adicionar fotos" }), {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      })),
      types: ["Files"],
    },
  });
}
const photo = (name = "mesa.jpg") =>
  new File(["x"], name, { type: "image/jpeg" });

async function pickByKeyboard(trigger: HTMLElement, steps: number) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  await screen.findByRole("listbox");
  const options = screen.getAllByRole("option");
  const start = options.findIndex(
    (option) => option.getAttribute("aria-selected") === "true",
  );
  for (let step = 0; step < steps; step += 1) {
    fireEvent.keyDown(options[start + step] as HTMLElement, {
      key: "ArrowDown",
    });
    await waitFor(() => expect(options[start + step + 1]).toHaveFocus());
  }
  fireEvent.keyDown(options[start + steps] as HTMLElement, { key: "Enter" });
}

describe("ListingForm", () => {
  it("groups the photo picker under its Fotos heading", () => {
    renderNew();
    expect(screen.getByRole("group", { name: "Fotos" })).toContainElement(
      screen.getByRole("button", { name: "Adicionar fotos" }),
    );
  });

  it("asks for photos before anything else on a new listing", () => {
    renderNew();
    const photos = screen.getByRole("button", { name: "Adicionar fotos" });
    expect(
      photos.compareDocumentPosition(title()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe("validation", () => {
    it("shows the title message, marks the field and sends nothing", async () => {
      renderNew();
      fireEvent.click(saveDraft());

      expect(await screen.findByText("Dê um nome ao item.")).toBeVisible();
      expect(title()).toHaveAttribute("aria-invalid", "true");
      expect(title()).toHaveAccessibleDescription("Dê um nome ao item.");
      expect(apiCalls()).toHaveLength(0);
    });

    it("clears the title message once fixed and resubmitted", async () => {
      renderNew();
      fireEvent.click(saveDraft());
      await screen.findByText("Dê um nome ao item.");

      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(screen.queryByText("Dê um nome ao item.")).toBeNull();
      expect(title()).toHaveAttribute("aria-invalid", "false");
    });

    it("shows the price message for text that is not a price and sends nothing", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.change(price(), { target: { value: "abc" } });
      fireEvent.click(saveDraft());

      const message =
        'Use um valor como 1.200,00, ou deixe vazio para "Preço a combinar".';
      expect(await screen.findByText(message)).toBeVisible();
      expect(price()).toHaveAttribute("aria-invalid", "true");
      expect(price()).toHaveAccessibleDescription(message);
      expect(apiCalls()).toHaveLength(0);
    });

    it("starts a new listing with only the signed-in seller and requires one", async () => {
      renderNew();
      expect(screen.getByRole("checkbox", { name: "Ana" })).not.toBeChecked();
      const mine = screen.getByRole("checkbox", { name: "Bia" });
      expect(mine).toBeChecked();

      fireEvent.click(mine);
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      const message = "Escolha ao menos uma pessoa para receber as mensagens.";
      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.getByRole("checkbox", { name: "Ana" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(apiCalls()).toHaveLength(0);
    });

    it("limits every text control to the API's length", () => {
      renderForm({
        listing: { ...listing, attributes: [{ label: "a", value: "b" }] },
      });
      expect(title()).toHaveAttribute("maxlength", "120");
      expect(screen.getByLabelText("Descrição")).toHaveAttribute(
        "maxlength",
        "5000",
      );
      expect(screen.getByLabelText("Nome do detalhe 1")).toHaveAttribute(
        "maxlength",
        "40",
      );
      expect(screen.getByLabelText("Valor do detalhe 1")).toHaveAttribute(
        "maxlength",
        "120",
      );
    });

    it("stops offering to add details at 20", () => {
      renderForm({
        listing: {
          ...listing,
          attributes: Array.from({ length: 20 }, (_, i) => ({
            label: `l${i}`,
            value: `v${i}`,
          })),
        },
      });
      expect(
        screen.queryByRole("button", { name: "Adicionar detalhe" }),
      ).toBeNull();
    });
  });

  describe("request bodies", () => {
    it("shows a seller their own name instead of a picker and lets the API assign them", async () => {
      renderNew(false);
      expect(
        screen.queryAllByRole("checkbox", { name: /Ana|Bia/ }),
      ).toHaveLength(0);
      expect(screen.getByText("Bia")).toBeInTheDocument();

      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      const [call] = apiCalls();
      expect(call?.method).toBe("POST");
      expect(call?.path).toBe("/stores/store/listings");
      expect(call?.body).not.toHaveProperty("sellerIds");
    });

    it("shows a seller every assigned name on an edit and never sends the assignment", async () => {
      renderForm({ canAssignSellers: false, listing });
      expect(screen.queryByRole("checkbox", { name: "Ana" })).toBeNull();
      expect(screen.getByText("Ana e Bia")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      const [call] = apiCalls();
      expect(call?.method).toBe("PATCH");
      expect(call?.path).toBe("/stores/store/listings/listing-1");
      expect(call?.body).not.toHaveProperty("sellerIds");
    });

    it("sends the picked sellers when a manager saves", async () => {
      renderForm({ listing });
      fireEvent.click(screen.getByRole("checkbox", { name: "Ana" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      expect(apiCalls()[0]?.body).toMatchObject({ sellerIds: ["bia"] });
    });

    it("sends the typed price in cents, and null for no price", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.change(price(), { target: { value: "1.200,50" } });
      fireEvent.click(saveDraft());
      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      expect(apiCalls()[0]?.body).toMatchObject({ priceCents: 120050 });
    });

    it("sends no price once Preço a combinar is ticked", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.change(price(), { target: { value: "50" } });
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Preço a combinar" }),
      );
      expect(price()).toBeDisabled();
      fireEvent.click(saveDraft());
      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      expect(apiCalls()[0]?.body).toMatchObject({ priceCents: null });
    });

    it("keeps the typed price when Preço a combinar is unticked again, and ignores it while ticked", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.change(price(), { target: { value: "abc" } });
      const none = screen.getByRole("checkbox", { name: "Preço a combinar" });
      fireEvent.click(none);
      fireEvent.click(saveDraft());
      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      expect(apiCalls()[0]?.body).toMatchObject({ priceCents: null });
      expect(screen.queryByText(/Use um valor como/)).toBeNull();

      fireEvent.click(none);
      expect(price()).toHaveValue("abc");
    });

    it("drops blank detail rows and keeps filled ones", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Adicionar detalhe" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Adicionar detalhe" }),
      );
      fireEvent.change(screen.getByLabelText("Nome do detalhe 1"), {
        target: { value: "Voltagem" },
      });
      fireEvent.change(screen.getByLabelText("Valor do detalhe 1"), {
        target: { value: "220 V" },
      });
      fireEvent.click(saveDraft());
      await waitFor(() => expect(apiCalls()).toHaveLength(1));
      expect(apiCalls()[0]?.body).toMatchObject({
        attributes: [{ label: "Voltagem", value: "220 V" }],
      });
    });
  });

  describe("save outcomes", () => {
    const renderEdit = (publication: AdminListingDetail["publication"]) =>
      renderForm({ listing: { ...listing, publication } });

    it("publishes a draft being edited and lands on its page with the published notice", async () => {
      renderEdit("draft");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/listing-1?salvo=publicado",
        ),
      );
      expect(apiCalls()[0]?.body).toMatchObject({ publication: "published" });
      expect(toast.getToasts()).toHaveLength(0);
    });

    it("keeps an archived listing archived on a plain save", async () => {
      renderEdit("archived");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/admin/anuncios/listing-1?salvo=1"),
      );
      expect(apiCalls()[0]?.body).toMatchObject({ publication: "archived" });
    });

    it("keeps a draft a draft on a plain save", async () => {
      renderEdit("draft");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/admin/anuncios/listing-1?salvo=1"),
      );
      expect(apiCalls()[0]?.body).toMatchObject({ publication: "draft" });
    });

    it("saves a new listing as a draft and opens it with the plain saved notice", async () => {
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/new-listing?salvo=1",
        ),
      );
      expect(apiCalls().map((c) => `${c.method} ${c.path}`)).toEqual([
        "POST /stores/store/listings",
      ]);
    });

    it("uploads dropped photos, then publishes, and opens the listing with the published notice", async () => {
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/new-listing?salvo=publicado",
        ),
      );
      expect(apiCalls().map((c) => `${c.method} ${c.path}`)).toEqual([
        "POST /stores/store/listings",
        "POST /stores/store/listings/new-listing/images",
        "PATCH /stores/store/listings/new-listing/status",
      ]);
      expect(apiCalls()[2]?.body).toEqual({ publication: "published" });
      expect(toast.getToasts()).toHaveLength(0);
    });

    it("creates exactly one listing and toasts the saved message once when the answer is unreadable", async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? json({ oops: true }, 201)
          : new Response(null, { status: 204 }),
      );
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
      expect(await screen.findByText("Alterações salvas.")).toBeVisible();
      expect(toast.getToasts()).toHaveLength(1);
      expect(apiCalls()).toHaveLength(1);
    });

    it("continues on the created listing with the upload-failed notice and no toast here when the upload fails", async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/images")) {
          return json({ message: "Não foi possível enviar." }, 500);
        }
        return init?.method === "POST"
          ? json({ id: "new-listing" }, 201)
          : new Response(null, { status: 204 });
      });
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/new-listing?erro=envio",
        ),
      );
      expect(toast.getToasts()).toHaveLength(0);
      expect(
        apiCalls().filter((c) => c.path === "/stores/store/listings"),
      ).toHaveLength(1);
    });

    it("lands on ?salvo=1 when a published listing is saved plainly", async () => {
      renderForm({ listing: { ...listing, publication: "published" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/admin/anuncios/listing-1?salvo=1"),
      );
    });

    it("refetches the listing being edited after a save", async () => {
      renderForm({ listing });
      const reads = () =>
        fetchMock.mock.calls.filter(
          ([url, init]) =>
            String(url) === "/api/v1/stores/store/listings/listing-1" &&
            (init as RequestInit).method === "GET",
        );
      expect(reads()).toHaveLength(0);
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() => expect(reads()).toHaveLength(1));
    });

    it("does not claim a plain save when the answer is unreadable and photos or publishing were pending", async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? json({ oops: true }, 201)
          : new Response(null, { status: 204 }),
      );
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
      expect(
        await screen.findByText(/O anúncio foi salvo, mas o envio das fotos/),
      ).toBeVisible();
      expect(toast.getToasts()).toHaveLength(1);
      expect(apiCalls().map((c) => `${c.method} ${c.path}`)).toEqual([
        "POST /stores/store/listings",
      ]);
    });

    it("leaves a 401 during the upload to the session handling: no notice, no toast", async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/images")) return json({}, 401);
        return init?.method === "POST"
          ? json({ id: "new-listing" }, 201)
          : new Response(null, { status: 204 });
      });
      const assign = vi.fn();
      vi.stubGlobal("location", { ...window.location, assign });
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() => expect(assign).toHaveBeenCalled());
      expect(push).not.toHaveBeenCalled();
      expect(toast.getToasts()).toHaveLength(0);
      expect(
        apiCalls().filter((c) => c.path === "/stores/store/listings"),
      ).toHaveLength(1);
    });

    it("toasts once, keeps the values and re-enables the buttons when an edit fails", async () => {
      fetchMock.mockImplementation(async () =>
        json({ message: "Algo deu errado." }, 500),
      );
      renderForm({ listing });
      fireEvent.change(title(), { target: { value: "Mesa nova" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() => expect(toast.getToasts()).toHaveLength(1));
      expect(push).not.toHaveBeenCalled();
      expect(title()).toHaveValue("Mesa nova");
      expect(
        screen.getByRole("button", { name: "Salvar alterações" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      ).toBeEnabled();
    });

    it("toasts once and stays put when the create itself fails", async () => {
      fetchMock.mockImplementation(async () =>
        json({ message: "Algo deu errado." }, 500),
      );
      renderNew();
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(saveDraft());

      await waitFor(() => expect(toast.getToasts()).toHaveLength(1));
      expect(push).not.toHaveBeenCalled();
      expect(saveDraft()).toBeEnabled();
      expect(title()).toHaveValue("Mesa");
    });
  });

  describe("while saving", () => {
    it("disables every submit button, labels the clicked one and sends no second request", async () => {
      let finish: (response: Response) => void = () => {};
      fetchMock.mockImplementationOnce(
        () => new Promise<Response>((resolve) => (finish = resolve)),
      );
      renderForm({ listing });

      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      const publishing = await screen.findByRole("button", {
        name: "Publicando...",
      });
      expect(publishing).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Salvar alterações" }),
      ).toBeDisabled();
      fireEvent.click(publishing);
      fireEvent.submit(title().closest("form") as HTMLFormElement);
      expect(apiCalls()).toHaveLength(1);
      finish(new Response(null, { status: 204 }));
      await waitFor(() => expect(push).toHaveBeenCalled());
    });

    it('labels the draft button "Salvando..." while it saves', async () => {
      fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
      renderForm({ listing });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      expect(
        await screen.findByRole("button", { name: "Salvando..." }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      ).toBeDisabled();
    });

    it("shows the upload progress on the clicked button", async () => {
      let finishPublish: (response: Response) => void = () => {};
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/images")) return json({ items: [] }, 201);
        if (url.endsWith("/status")) {
          return new Promise<Response>((resolve) => (finishPublish = resolve));
        }
        return init?.method === "POST"
          ? json({ id: "new-listing" }, 201)
          : new Response(null, { status: 204 });
      });
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa" } });
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      expect(
        await screen.findByRole("button", {
          name: "Enviando fotos (1 de 1)...",
        }),
      ).toBeDisabled();
      expect(saveDraft()).toBeDisabled();
      fetchMock.mockImplementation(
        async () => new Response(null, { status: 204 }),
      );
      finishPublish(new Response(null, { status: 204 }));
      await waitFor(() => expect(push).toHaveBeenCalled());
    });
  });

  describe("photo previews", () => {
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    const original = {
      createObjectURL: URL.createObjectURL,
      revokeObjectURL: URL.revokeObjectURL,
    };

    beforeEach(() => {
      let next = 0;
      createObjectURL.mockReset();
      revokeObjectURL.mockReset();
      createObjectURL.mockImplementation(() => `blob:preview-${++next}`);
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
      URL.createObjectURL = original.createObjectURL;
      URL.revokeObjectURL = original.revokeObjectURL;
    });

    it("keeps one preview URL for a photo while the rest of the form changes", async () => {
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.change(title(), { target: { value: "Mesa de jantar" } });
      fireEvent.change(title(), { target: { value: "Mesa de jantar grande" } });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it("revokes a preview URL when its photo is removed", async () => {
      renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("revokes the preview URLs when the form goes away", async () => {
      const { unmount } = renderNew();
      drop([photo()]);
      await screen.findByAltText("Foto 1 selecionada");
      unmount();

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("queues dropped photos in order, appending later drops, with the first as cover", async () => {
      renderNew();
      drop([photo("a.jpg"), photo("b.jpg")]);
      await screen.findByAltText("Foto 2 selecionada");
      drop([photo("c.jpg")]);
      await screen.findByAltText("Foto 3 selecionada");

      expect(screen.getAllByText("Capa")).toHaveLength(1);
      expect(screen.getByText("3 fotos")).toBeVisible();
    });

    it("skips a dropped non-image with one toast and queues the rest", async () => {
      renderNew();
      drop([new File(["x"], "nota.pdf", { type: "application/pdf" }), photo()]);
      await screen.findByAltText("Foto 1 selecionada");

      expect(
        await screen.findByText('"nota.pdf" não é JPEG, PNG ou WebP.'),
      ).toBeVisible();
      expect(toast.getToasts()).toHaveLength(1);
      expect(screen.queryByAltText("Foto 2 selecionada")).toBeNull();
    });
  });

  it("picks the category from the keyboard and saves it", async () => {
    renderForm({
      canAssignSellers: false,
      categories: [
        { id: "c1", slug: "moveis", name: "Móveis" },
        { id: "c2", slug: "livros", name: "Livros" },
      ],
    });
    const category = screen.getByRole("combobox", { name: "Categoria" });
    expect(category).toHaveTextContent("Móveis");
    category.focus();
    fireEvent.keyDown(category, { key: "Enter" });
    await screen.findByRole("listbox");
    const options = screen.getAllByRole("option");
    await waitFor(() => expect(options[0]).toHaveFocus());
    fireEvent.keyDown(options[0] as HTMLElement, { key: "ArrowDown" });
    await waitFor(() => expect(options[1]).toHaveFocus());
    fireEvent.keyDown(options[1] as HTMLElement, { key: "Enter" });

    await waitFor(() => expect(category).toHaveTextContent("Livros"));
    fireEvent.change(title(), { target: { value: "Livro" } });
    fireEvent.click(saveDraft());
    await waitFor(() => expect(apiCalls()).toHaveLength(1));
    expect(apiCalls()[0]?.body).toMatchObject({ categoryId: "c2" });
  });

  it("saves the publication and availability picked by keyboard on an edit", async () => {
    renderForm({ listing });
    const publication = screen.getByLabelText("Publicação");
    const availability = screen.getByLabelText("Disponibilidade");
    expect(publication).toHaveTextContent("Rascunho");
    expect(availability).toHaveTextContent("Disponível");

    await pickByKeyboard(publication, 1);
    await waitFor(() => expect(publication).toHaveTextContent("Publicado"));
    await pickByKeyboard(availability, 1);
    await waitFor(() => expect(availability).toHaveTextContent("Reservado"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(apiCalls()).toHaveLength(1));
    expect(apiCalls()[0]?.body).toMatchObject({
      publication: "published",
      availability: "reserved",
    });
  });
});

describe("ListingForm server render", () => {
  it("carries the listing values in the HTML before hydration", () => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <HydrationBoundary
          state={cachedDetail({ ...listing, description: "Mesa de jantar" })}
        >
          <ListingForm
            storeId="store"
            categories={categories}
            sellers={sellers}
            ownSellerId="bia"
            canAssignSellers
            listingId={listing.id}
          />
        </HydrationBoundary>
      </QueryClientProvider>,
    );

    expect(html).toContain('value="Mesa"');
    expect(html).toContain("Mesa de jantar");
  });
});
