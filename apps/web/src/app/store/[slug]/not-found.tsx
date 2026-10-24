"use client";

import { useParams } from "next/navigation";
import { NotFoundMessage } from "@/components/storefront/not-found-message";
import { storePath } from "@/shared/lib/site";

// Not-found pages receive no params; the store comes from the URL.
export default function StoreNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <NotFoundMessage
      text="O item pode ter saído do catálogo ou o link está incompleto. Os outros itens continuam à venda."
      href={storePath(slug)}
      action="Ver o catálogo"
    />
  );
}
