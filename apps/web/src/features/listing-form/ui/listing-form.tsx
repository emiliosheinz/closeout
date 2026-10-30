"use client";

import {
  AVAILABILITIES,
  CONDITIONS,
  PUBLICATIONS,
} from "@closeout/contracts/enums";
import { listingRequestSchema } from "@closeout/contracts/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  type AdminListingDetail,
  type Category,
  LISTING_NOTICES,
  listingEditHref,
  listingKeys,
  listingReads,
  PhotoDropzone,
  type Seller,
} from "@/entities/listing";
import { readQuery } from "@/shared/api";
import {
  AVAILABILITY_LABELS,
  CONDITION_LABELS,
  joinNames,
  PUBLICATION_LABELS,
} from "@/shared/lib/format";
import { centsToInput, parsePriceToCents } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Field, inputClass } from "@/shared/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { notify } from "@/shared/ui/sonner";
import {
  createListingWithPhotos,
  type ListingFields,
  type SaveOutcome,
  updateListing,
} from "../api/save-listing";

const selectTriggerClass =
  "h-11 border-line-strong bg-surface px-3 text-base text-ink shadow-none";

const { shape } = listingRequestSchema;

function toCents(price: string | undefined): number {
  const text = price?.trim() ?? "";
  if (text === "") return Number.NaN;
  return parsePriceToCents(text) ?? Number.NaN;
}

function buildSchema(canAssignSellers: boolean) {
  return z
    .object({
      title: shape.title,
      description: shape.description.unwrap(),
      categoryId: shape.categoryId,
      sellerIds: canAssignSellers
        ? shape.sellerIds.unwrap()
        : z.array(z.string()),
      price: z.string().optional(),
      noPrice: z.boolean(),
      condition: shape.condition,
      attributes: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .max(20)
        .transform((rows) =>
          rows
            .map((row) => ({
              label: row.label.trim(),
              value: row.value.trim(),
            }))
            .filter((row) => row.label && row.value),
        ),
      availability: z.enum(AVAILABILITIES),
      publication: z.enum(PUBLICATIONS),
    })
    .transform((values, ctx) => {
      // An empty price, or "Preço a combinar", means no price; the typed text
      // is ignored while ticked but kept in the form.
      const typed = values.price?.trim() ?? "";
      const cents = values.noPrice || typed === "" ? null : toCents(typed);
      const checked = shape.priceCents.safeParse(cents);
      if (!checked.success) {
        ctx.issues.push({
          code: "custom",
          message: checked.error.issues[0]?.message ?? "",
          input: values.price,
          path: ["price"],
        });
        return z.NEVER;
      }
      return { ...values, price: checked.data ?? null };
    });
}

const managerSchema = buildSchema(true);
const sellerSchema = buildSchema(false);
type FormInput = z.input<typeof managerSchema>;
type FormValues = z.output<typeof managerSchema>;

interface ListingFormProps {
  storeId: string;
  categories: Category[];
  sellers: Seller[];
  /** The signed-in member's contact profile, preselected on new listings. */
  ownSellerId: string;
  /** Managers pick who sells; a seller's listings stay assigned as they are. */
  canAssignSellers: boolean;
  /** Edit mode: the listing is read from the query cache, like its photos. */
  listingId?: string;
}

interface BodyProps extends Omit<ListingFormProps, "listingId"> {
  listing?: AdminListingDetail;
}

/**
 * Create and edit form. New listings can attach photos right away: the
 * listing is saved first, then the photos upload in batches, then it is
 * published if asked. Every value stays in the form when a save fails.
 */
export function ListingForm({ listingId, ...props }: ListingFormProps) {
  if (listingId === undefined) return <ListingFormBody {...props} />;
  return <EditListingForm listingId={listingId} {...props} />;
}

function EditListingForm({
  listingId,
  ...props
}: Omit<ListingFormProps, "listingId"> & { listingId: string }) {
  const { data: listing } = useSuspenseQuery(
    readQuery(listingReads.detail(props.storeId, listingId)),
  );
  // A fresher server copy remounts the form so its defaults follow it.
  return (
    <ListingFormBody key={listing.updatedAt} {...props} listing={listing} />
  );
}

function ListingFormBody({
  storeId,
  categories,
  sellers,
  ownSellerId,
  canAssignSellers,
  listing,
}: BodyProps) {
  const router = useRouter();
  const editing = listing !== undefined;
  const assignedNames = listing
    ? listing.sellers.map((seller) => seller.displayName)
    : sellers
        .filter((seller) => seller.id === ownSellerId)
        .map((seller) => seller.displayName);
  // Uncontrolled inputs also take these as HTML defaults so the server render carries them.
  const defaults: FormInput = {
    title: listing?.title ?? "",
    description: listing?.description ?? "",
    categoryId: listing?.category.id ?? categories[0]?.id ?? "",
    sellerIds: listing
      ? listing.sellers.map((seller) => seller.id)
      : [ownSellerId],
    price: centsToInput(listing?.priceCents ?? null),
    noPrice: editing ? listing.priceCents === null : false,
    condition: listing?.condition ?? "good",
    attributes: listing?.attributes ?? [],
    availability: listing?.availability ?? "available",
    publication: listing?.publication ?? "draft",
  };
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(canAssignSellers ? managerSchema : sellerSchema),
    defaultValues: defaults,
  });
  const {
    fields: attributes,
    append,
    remove,
  } = useFieldArray({ control, name: "attributes" });
  const noPrice = useWatch({ control, name: "noPrice" });
  const publication = useWatch({ control, name: "publication" });

  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const files = previews.map((preview) => preview.file);
  const heldUrls = useRef(new Set<string>());

  useEffect(() => {
    const held = heldUrls.current;
    return () => {
      for (const url of held) URL.revokeObjectURL(url);
    };
  }, []);

  function addFiles(added: File[]) {
    const entries = added.map((file) => {
      const url = URL.createObjectURL(file);
      heldUrls.current.add(url);
      return { file, url };
    });
    setPreviews([...previews, ...entries]);
  }

  function removeFile(index: number) {
    const removed = previews[index];
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    heldUrls.current.delete(removed.url);
    setPreviews(previews.filter((_, i) => i !== index));
  }

  const save = useMutation({
    mutationFn: ({
      values,
      publish,
      files,
    }: {
      values: FormValues;
      publish: boolean;
      files: File[];
    }): Promise<SaveOutcome> => {
      const fields: ListingFields = {
        title: values.title,
        description: values.description,
        categoryId: values.categoryId,
        ...(canAssignSellers ? { sellerIds: values.sellerIds } : {}),
        priceCents: values.price,
        condition: values.condition,
        attributes: values.attributes,
      };
      if (listing) {
        return updateListing(
          storeId,
          listing.id,
          {
            ...fields,
            availability: values.availability,
            publication: publish ? "published" : values.publication,
          },
          publish,
        );
      }
      return createListingWithPhotos(storeId, fields, files, {
        publish,
        onProgress: setProgress,
      });
    },
    onSettled: () => setProgress(null),
    meta: { invalidates: [listingKeys.all(storeId)] },
  });

  function submit(values: FormValues, publish: boolean) {
    // Files travel with the call: the mutation picks up a new mutationFn only
    // after an effect, so a closure over `files` can lag a fresh drop.
    save.mutate(
      { values, publish, files },
      {
        onSuccess: ({ id, notice }) => {
          if (id === null) {
            const { kind, message } = LISTING_NOTICES[notice];
            notify[kind](message);
            router.push("/admin");
            return;
          }
          router.push(listingEditHref(id, notice));
        },
      },
    );
  }

  const publishing = save.isPending && save.variables.publish;
  const savingDraft = save.isPending && !save.variables.publish;

  return (
    <form
      onSubmit={handleSubmit((values) => submit(values, false))}
      className="flex flex-col gap-6"
      noValidate
    >
      {!editing && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Fotos</legend>
          <p className="text-xs text-muted">
            Comece pelas fotos: são elas que vendem. Escolha várias de uma vez;
            a primeira vira a capa.
          </p>
          <PhotoDropzone
            existing={files.length}
            onFiles={addFiles}
            disabled={save.isPending}
          />
          <span role="status" className="text-sm text-muted">
            {files.length === 0
              ? "Nenhuma foto escolhida"
              : files.length === 1
                ? "1 foto"
                : `${files.length} fotos`}
          </span>
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
                    onClick={() => removeFile(index)}
                    aria-label={`Remover foto ${index + 1}`}
                    className="absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-full bg-surface/90 shadow"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      <Field label="Nome do item" htmlFor="title" error={errors.title?.message}>
        <input
          id="title"
          maxLength={120}
          placeholder="Ex.: Sofá retrátil 3 lugares"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
          className={inputClass}
          defaultValue={defaults.title}
          {...register("title")}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Preço (R$)"
          htmlFor="price"
          error={errors.price?.message}
          hint="Sem preço definido? Marque a opção e receba propostas."
        >
          <input
            id="price"
            inputMode="decimal"
            disabled={noPrice}
            placeholder="Ex.: 450"
            aria-invalid={Boolean(errors.price)}
            aria-describedby={errors.price ? "price-error" : undefined}
            className={inputClass}
            defaultValue={defaults.price}
            {...register("price")}
          />
          <label className="mt-1 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              defaultChecked={defaults.noPrice}
              {...register("noPrice")}
            />
            Preço a combinar
          </label>
        </Field>
        <Field label="Categoria" htmlFor="category">
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="category" className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Estado</legend>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((value) => (
            <label
              key={value}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-3.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                defaultChecked={defaults.condition === value}
                {...register("condition")}
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
          rows={5}
          maxLength={5000}
          className={cn(inputClass, "h-auto py-2 leading-relaxed")}
          defaultValue={defaults.description}
          {...register("description")}
        />
      </Field>

      {!canAssignSellers ? (
        <div>
          <p className="text-sm font-semibold">Quem vende</p>
          <p className="mt-1 text-base">{joinNames(assignedNames)}</p>
          <p className="mt-1 text-xs text-muted">
            Quem recebe as mensagens no WhatsApp. Só quem administra a loja muda
            essa escolha.
          </p>
        </div>
      ) : (
        <fieldset
          aria-describedby={
            errors.sellerIds ? "sellers-hint sellers-error" : "sellers-hint"
          }
        >
          <legend className="text-sm font-semibold">Quem vende</legend>
          <p id="sellers-hint" className="mt-1 text-xs text-muted">
            Quem recebe as mensagens no WhatsApp. Com mais de uma pessoa, o
            comprador escolhe com quem falar.
          </p>
          <Controller
            control={control}
            name="sellerIds"
            render={({ field }) => (
              <div className="mt-2 flex flex-wrap gap-2">
                {sellers.map((seller) => (
                  <label
                    key={seller.id}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
                  >
                    <input
                      type="checkbox"
                      checked={field.value.includes(seller.id)}
                      aria-invalid={Boolean(errors.sellerIds)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, seller.id]
                            : field.value.filter((id) => id !== seller.id),
                        )
                      }
                      className="size-4 accent-surface"
                    />
                    {seller.displayName}
                    {seller.whatsappNumber ? "" : " (sem WhatsApp)"}
                  </label>
                ))}
              </div>
            )}
          />
          {errors.sellerIds && (
            <p
              id="sellers-error"
              role="alert"
              className="mt-1.5 text-sm font-medium text-stamp"
            >
              {errors.sellerIds.message}
            </p>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">Detalhes (opcional)</legend>
        <p className="mt-1 text-xs text-muted">
          Medidas, voltagem, marca, ano de compra...
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {attributes.map((attribute, index) => (
            <li key={attribute.id} className="flex gap-2">
              <input
                aria-label={`Nome do detalhe ${index + 1}`}
                placeholder="Ex.: Voltagem"
                maxLength={40}
                className={cn(inputClass, "w-2/5")}
                defaultValue={attribute.label}
                {...register(`attributes.${index}.label`)}
              />
              <input
                aria-label={`Valor do detalhe ${index + 1}`}
                placeholder="Ex.: 220 V"
                maxLength={120}
                className={cn(inputClass, "flex-1")}
                defaultValue={attribute.value}
                {...register(`attributes.${index}.value`)}
              />
              <button
                type="button"
                onClick={() => remove(index)}
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
            onClick={() => append({ label: "", value: "" })}
            className="mt-2 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-ink/5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar detalhe
          </button>
        )}
      </fieldset>

      {editing && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Publicação" htmlFor="publication">
            <Controller
              control={control}
              name="publication"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) =>
                    field.onChange(next as (typeof PUBLICATIONS)[number])
                  }
                >
                  <SelectTrigger
                    id="publication"
                    className={selectTriggerClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLICATIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PUBLICATION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Disponibilidade" htmlFor="availability">
            <Controller
              control={control}
              name="availability"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) =>
                    field.onChange(next as (typeof AVAILABILITIES)[number])
                  }
                >
                  <SelectTrigger
                    id="availability"
                    className={selectTriggerClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {AVAILABILITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Button type="submit" variant="outline" disabled={save.isPending}>
          {savingDraft
            ? (progress ?? "Salvando...")
            : editing
              ? "Salvar alterações"
              : "Salvar rascunho"}
        </Button>
        {publication !== "published" && (
          <Button
            type="button"
            onClick={handleSubmit((values) => submit(values, true))}
            disabled={save.isPending || (!editing && files.length === 0)}
          >
            {publishing ? (progress ?? "Publicando...") : "Salvar e publicar"}
          </Button>
        )}
        {!editing && files.length === 0 && (
          <span className="text-sm text-muted">
            Adicione fotos para poder publicar.
          </span>
        )}
      </div>
    </form>
  );
}
