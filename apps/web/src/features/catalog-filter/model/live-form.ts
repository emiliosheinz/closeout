"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef } from "react";
import type { CatalogFilters } from "@/entities/listing";
import { storePath } from "@/shared/lib/site";
import { canonicalCatalogSearch, catalogEntries } from "./params";

/** How long a typed search or price waits for the next keystroke. */
export const LIVE_DELAY_MS = 400;

const TYPED_INPUTS = new Set(["search", "text", "number"]);

/*
 * The queries the live forms asked for, newest last. The search box and the
 * sidebar are separate forms, and the page re-renders their hidden fields only
 * once a navigation lands, so the next edit builds on the newest request
 * instead: a price typed right after a search keeps that search.
 */
let requested: string[] = [];

function isTyped(element: EventTarget | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && TYPED_INPUTS.has(element.type);
}

/** The form's own controls: what the visitor can change, not hidden copies. */
function controls(form: HTMLFormElement): HTMLInputElement[] {
  return Array.from(form.elements).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement &&
      element.name !== "" &&
      element.type !== "hidden",
  );
}

/** `base` with the values of the form's own controls laid over it, page reset. */
function nextQuery(form: HTMLFormElement, base: string): string {
  const next = new URLSearchParams(base);
  const fields = controls(form);
  for (const field of fields) next.delete(field.name);
  for (const field of fields) {
    if (field.type === "radio" && !field.checked) continue;
    next.append(field.name, field.value);
  }
  next.delete("page");
  return canonicalCatalogSearch(next) ?? next.toString();
}

/** Show `query` in every control except a text field the visitor is typing in. */
function syncControls(form: HTMLFormElement, query: string) {
  const values = new URLSearchParams(query);
  for (const field of controls(form)) {
    const value = values.get(field.name) ?? "";
    if (field.type === "radio") {
      field.checked = field.value === value;
    } else if (field !== document.activeElement) {
      field.value = value;
    }
  }
}

/**
 * Applies a catalog form as the visitor edits it: a choice at once, typed text
 * once typing pauses, Enter at once. The URL stays the only state, so the
 * result is the same shareable address the plain GET form produces.
 */
export function useLiveCatalogForm(storeSlug: string, filters: CatalogFilters) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = new URLSearchParams(catalogEntries(filters)).toString();

  useEffect(() => {
    // A URL the forms did not ask for came from elsewhere (a chip, "Limpar
    // tudo", the back button): show it, and stop building on old requests.
    if (current === requested.at(-1)) return;
    requested = [];
    if (formRef.current) syncControls(formRef.current, current);
  }, [current]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const base = requested.at(-1) ?? current;
    const query = nextQuery(form, base);
    if (query === base) return;
    requested = [...requested.slice(-9), query];
    const path = storePath(storeSlug);
    router.push(query ? `${path}?${query}` : path, { scroll: false });
  };

  return {
    ref: formRef,
    onChange: (event: FormEvent<HTMLFormElement>) => {
      if (!isTyped(event.target)) return apply();
      clearTimeout(timer.current);
      timer.current = setTimeout(apply, LIVE_DELAY_MS);
    },
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      apply();
    },
  };
}
