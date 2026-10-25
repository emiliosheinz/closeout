"use client";

import { useParams } from "next/navigation";
import { storePath } from "@/shared/lib/site";
import { NotFoundMessage } from "@/shared/ui/not-found-message";

// Not-found pages receive no params; the store comes from the URL.
export function StoreNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <NotFoundMessage
      text="O item pode ter saído do catálogo ou o link está incompleto. Os outros itens continuam à venda."
      href={storePath(slug)}
      action="Ver o catálogo"
    />
  );
}
