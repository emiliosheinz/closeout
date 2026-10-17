"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/admin/client-api";
import { centsToInput, parsePriceToCents } from "@/lib/admin/money";
import type { AdminListingDetail, Category, Seller } from "@/lib/admin/types";
import {
  AVAILABILITIES,
  type Availability,
  CONDITIONS,
  type Condition,
  type ListingAttribute,
  type Publication,
} from "@/lib/catalog/types";
import {
  AVAILABILITY_LABELS,
  CONDITION_LABELS,
  PUBLICATION_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, inputClass } from "./field";

interface ListingFormProps {
  storeId: string;
  categories: Category[];
  sellers: Seller[];
  defaultSellerId: string | null;
  listing?: AdminListingDetail;
}

interface FormErrors {
  title?: string;
  price?: string;
  form?: string;
}

const PUBLICATIONS: Publication[] = ["draft", "published", "archived"];
const MAX_FILES_PER_UPLOAD = 8;

/**
 * Create and edit form. New listings can attach photos right away: the
 * listing is saved first, then the photos upload in batches, then it is
 * published if asked. Every value stays in the form when a save fails.
 */
export function ListingForm({
  storeId,
  categories,
  sellers,
  defaultSellerId,
  listing,
}: ListingFormProps) {
  const router = useRouter();
  const editing = listing !== undefined;
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    listing?.category.id ?? categories[0]?.id ?? "",
  );
  const [sellerId, setSellerId] = useState(
    listing?.seller.id ?? defaultSellerId ?? sellers[0]?.id ?? "",
  );
  const [price, setPrice] = useState(centsToInput(listing?.priceCents ?? null));
  const [noPrice, setNoPrice] = useState(
    editing ? listing.priceCents === null : false,
  );
  const [condition, setCondition] = useState<Condition>(
    listing?.condition ?? "good",
  );
  const [attributes, setAttributes] = useState<ListingAttribute[]>(
    listing?.attributes ?? [],
  );
  const [availability, setAvailability] = useState<Availability>(
    listing?.availability ?? "available",
  );
  const [publication, setPublication] = useState<Publication>(
    listing?.publication ?? "draft",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState<string | null>(null);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(
    () => () => {
      for (const preview of previews) URL.revokeObjectURL(preview.url);
    },
    [previews],
  );

  function validate(): { priceCents: number | null } | null {
    const next: FormErrors = {};
    if (!title.trim()) next.title = "Dê um nome ao item.";
    let priceCents: number | null = null;
    if (!noPrice) {
      priceCents = parsePriceToCents(price);
      if (priceCents === null) {
        next.price =
          'Use um valor como 1.200,00, ou marque "Preço a combinar".';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? { priceCents } : null;
  }

  async function save(publish: boolean) {
    const valid = validate();
    if (!valid) return;
    const fields = {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      sellerId,
      priceCents: valid.priceCents,
      condition,
      attributes: attributes.filter((a) => a.label.trim() && a.value.trim()),
    };

    setPending(publish ? "Publicando..." : "Salvando...");
    let id = listing?.id;
    try {
      if (editing && id) {
        await api("PATCH", `/stores/${storeId}/listings/${id}`, {
          ...fields,
          availability,
          publication: publish ? "published" : publication,
        });
        setPending(null);
        router.push(
          `/admin/anuncios/${id}?salvo=${publish ? "publicado" : "1"}`,
        );
        router.refresh();
        return;
      }

      const created = await api<AdminListingDetail>(
        "POST",
        `/stores/${storeId}/listings`,
        fields,
      );
      id = created.id;
      for (let i = 0; i < files.length; i += MAX_FILES_PER_UPLOAD) {
        setPending(
          `Enviando fotos (${i + 1}-${Math.min(i + MAX_FILES_PER_UPLOAD, files.length)} de ${files.length})...`,
        );
        const body = new FormData();
        for (const file of files.slice(i, i + MAX_FILES_PER_UPLOAD)) {
          body.append("files", file);
        }
        await api("POST", `/stores/${storeId}/listings/${id}/images`, body);
      }
      if (publish) {
        await api("PATCH", `/stores/${storeId}/listings/${id}/status`, {
          publication: "published",
        });
      }
      router.push(`/admin/anuncios/${id}?salvo=${publish ? "publicado" : "1"}`);
    } catch (err) {
      setPending(null);
      const message =
        err instanceof ApiError ? err.message : "Não foi possível salvar.";
      if (!editing && id) {
        // The listing exists; continue on its page instead of creating a duplicate.
        router.push(
          `/admin/anuncios/${id}?erro=${encodeURIComponent(message)}`,
        );
        return;
      }
      setErrors({ form: message });
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <Field label="Nome do item" htmlFor="title" error={errors.title}>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ex.: Sofá retrátil 3 lugares"
          aria-invalid={Boolean(errors.title)}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Preço (R$)"
          htmlFor="price"
          error={errors.price}
          hint="Deixe sem preço para receber propostas."
        >
          <input
            id="price"
            inputMode="decimal"
            value={noPrice ? "" : price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={noPrice}
            placeholder="Ex.: 450"
            aria-invalid={Boolean(errors.price)}
            className={inputClass}
          />
          <label className="mt-1 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noPrice}
              onChange={(e) => setNoPrice(e.target.checked)}
              className="size-4 accent-ink"
            />
            Preço a combinar
          </label>
        </Field>
        <Field label="Categoria" htmlFor="category">
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Estado</legend>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((value) => (
            <label
              key={value}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line bg-surface px-3.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                name="condition"
                value={value}
                checked={condition === value}
                onChange={() => setCondition(value)}
                className="sr-only"
              />
              {CONDITION_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Descrição"
        htmlFor="description"
        hint="Conte medidas, defeitos e por que está vendendo. Sinceridade vende."
      >
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={5000}
          className={cn(inputClass, "h-auto py-2 leading-relaxed")}
        />
      </Field>

      <Field
        label="Quem vende"
        htmlFor="seller"
        hint="Quem recebe as mensagens no WhatsApp."
      >
        <select
          id="seller"
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className={inputClass}
        >
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.displayName}
              {seller.whatsappNumber ? "" : " (sem WhatsApp)"}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="text-sm font-semibold">Detalhes (opcional)</legend>
        <p className="mt-1 text-xs text-muted">
          Medidas, voltagem, marca, ano de compra...
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {attributes.map((attribute, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place by position.
            <li key={index} className="flex gap-2">
              <input
                aria-label={`Nome do detalhe ${index + 1}`}
                value={attribute.label}
                onChange={(e) =>
                  setAttributes(
                    attributes.map((a, i) =>
                      i === index ? { ...a, label: e.target.value } : a,
                    ),
                  )
                }
                placeholder="Ex.: Voltagem"
                maxLength={40}
                className={cn(inputClass, "w-2/5")}
              />
              <input
                aria-label={`Valor do detalhe ${index + 1}`}
                value={attribute.value}
                onChange={(e) =>
                  setAttributes(
                    attributes.map((a, i) =>
                      i === index ? { ...a, value: e.target.value } : a,
                    ),
                  )
                }
                placeholder="Ex.: 220 V"
                maxLength={120}
                className={cn(inputClass, "flex-1")}
              />
              <button
                type="button"
                onClick={() =>
                  setAttributes(attributes.filter((_, i) => i !== index))
                }
                aria-label={`Remover detalhe ${index + 1}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {attributes.length < 20 && (
          <button
            type="button"
            onClick={() =>
              setAttributes([...attributes, { label: "", value: "" }])
            }
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-ink/5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar detalhe
          </button>
        )}
      </fieldset>

      {!editing && (
        <Field
          label="Fotos"
          htmlFor="photos"
          hint="Escolha várias de uma vez. A primeira vira a capa; dá para reordenar depois."
        >
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
              <ImagePlus className="size-4" aria-hidden="true" />
              Escolher fotos
              <input
                id="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  setFiles(
                    [...files, ...Array.from(e.target.files ?? [])].slice(
                      0,
                      20,
                    ),
                  );
                  e.target.value = "";
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </span>
            <span className="text-sm text-muted">
              {files.length === 0
                ? "Nenhuma foto escolhida"
                : files.length === 1
                  ? "1 foto"
                  : `${files.length} fotos`}
            </span>
          </div>
          {previews.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {previews.map((preview, index) => (
                <li key={preview.url} className="relative">
                  {/* biome-ignore lint/performance/noImgElement: local object URL preview. */}
                  <img
                    src={preview.url}
                    alt={`Foto ${index + 1} selecionada`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-ink/80 px-1.5 text-xs font-semibold text-surface">
                      Capa
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                    aria-label={`Remover foto ${index + 1}`}
                    className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-full bg-surface/90 shadow"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
      )}

      {editing && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Publicação" htmlFor="publication">
            <select
              id="publication"
              value={publication}
              onChange={(e) => setPublication(e.target.value as Publication)}
              className={inputClass}
            >
              {PUBLICATIONS.map((value) => (
                <option key={value} value={value}>
                  {PUBLICATION_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Disponibilidade" htmlFor="availability">
            <select
              id="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value as Availability)}
              className={inputClass}
            >
              {AVAILABILITIES.map((value) => (
                <option key={value} value={value}>
                  {AVAILABILITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {errors.form && (
        <p
          role="alert"
          className="rounded-md bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp"
        >
          {errors.form}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Button type="submit" variant="outline" disabled={pending !== null}>
          {editing ? "Salvar alterações" : "Salvar rascunho"}
        </Button>
        {publication !== "published" && (
          <Button
            type="button"
            onClick={() => save(true)}
            disabled={pending !== null || (!editing && files.length === 0)}
          >
            Salvar e publicar
          </Button>
        )}
        <span role="status" aria-live="polite" className="text-sm text-muted">
          {pending ??
            (!editing && files.length === 0
              ? "Adicione fotos para poder publicar."
              : "")}
        </span>
      </div>
    </form>
  );
}
