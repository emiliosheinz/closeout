import { MessageCircle } from "lucide-react";
import { chatUrl, displayNumber } from "@/shared/lib/whatsapp";
import type { Buyer } from "../model/types";

/** The buyer's name and, when they have one, their number linked to a WhatsApp chat. */
export function BuyerContact({
  buyer,
}: {
  buyer: Pick<Buyer, "name" | "whatsappNumber">;
}) {
  const href = chatUrl(buyer.whatsappNumber);
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className="font-semibold">{buyer.name}</span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-1 inline-flex min-h-7 items-center gap-1 self-center text-sm text-muted tabular-nums hover:text-go"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          <span className="sr-only">WhatsApp de {buyer.name}: </span>
          {displayNumber(buyer.whatsappNumber)}
        </a>
      )}
    </span>
  );
}
