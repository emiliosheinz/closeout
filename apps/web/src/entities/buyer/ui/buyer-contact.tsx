import { chatUrl } from "@/shared/lib/whatsapp";
import type { Buyer } from "../model/types";

/** The buyer's name, linked to a WhatsApp chat when they have a number. */
export function BuyerContact({
  buyer,
}: {
  buyer: Pick<Buyer, "name" | "whatsappNumber">;
}) {
  const href = chatUrl(buyer.whatsappNumber);
  if (!href) return <span className="font-semibold">{buyer.name}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold underline underline-offset-2"
    >
      {buyer.name}
    </a>
  );
}
