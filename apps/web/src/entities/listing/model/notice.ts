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

/** Every query parameter a notice can arrive in, so the toast can clear it. */
export const LISTING_NOTICE_PARAMS = ["notice"];

/** The edit page's URL carrying a one-time notice for the destination to toast. */
export function listingEditHref(id: string, notice: ListingNotice) {
  return `/admin/listings/${id}?notice=${notice}`;
}

/** Reads the notice a URL carries; unknown values are no notice. */
export function parseListingNotice(params: {
  get(name: string): string | null;
}): ListingNotice | undefined {
  const notice = params.get("notice");
  if (notice && Object.hasOwn(LISTING_NOTICES, notice)) {
    return notice as ListingNotice;
  }
  return undefined;
}
