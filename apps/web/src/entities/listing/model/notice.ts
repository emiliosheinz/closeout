export type ListingNotice = "saved" | "published" | "copied" | "upload-failed";

export const LISTING_NOTICES: Record<
  ListingNotice,
  { kind: "success" | "error"; message: string }
> = {
  saved: { kind: "success", message: "Alterações salvas." },
  published: {
    kind: "success",
    message: "Anúncio publicado. Já aparece na loja.",
  },
  copied: {
    kind: "success",
    message:
      "Cópia criada como rascunho. Ajuste o que mudou e adicione as fotos.",
  },
  "upload-failed": {
    kind: "error",
    message:
      "O anúncio foi salvo, mas o envio das fotos ou a publicação falhou. Confira as fotos abaixo e tente de novo.",
  },
};

const QUERY: Record<ListingNotice, string> = {
  saved: "salvo=1",
  published: "salvo=publicado",
  copied: "copiado=1",
  "upload-failed": "erro=envio",
};

/** Every query parameter a notice can arrive in, derived so none escapes clearing. */
export const LISTING_NOTICE_PARAMS = [
  ...new Set(
    Object.values(QUERY).map((query) => query.split("=")[0] as string),
  ),
];

/** The edit page's URL carrying a one-time notice for the destination to toast. */
export function listingEditHref(id: string, notice: ListingNotice) {
  return `/admin/anuncios/${id}?${QUERY[notice]}`;
}

/** Reads the notice a URL carries; unknown values are no notice. */
export function parseListingNotice(params: {
  get(name: string): string | null;
}): ListingNotice | undefined {
  if (params.get("copiado")) return "copied";
  if (params.get("erro") === "envio") return "upload-failed";
  const salvo = params.get("salvo");
  if (salvo === "publicado") return "published";
  if (salvo === "1") return "saved";
  return undefined;
}
