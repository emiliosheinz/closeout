import { MessageCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** The primary conversion action: opens WhatsApp with a prefilled message. */
export function ContactButton({
  href,
  sellerName,
  className,
}: {
  href: string;
  sellerName: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-contact"
      className={cn(
        "inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-go px-6 py-2 text-center text-base font-semibold text-white shadow-[0_8px_20px_-10px_rgba(30,127,85,0.8)] hover:bg-go-strong",
        className,
      )}
    >
      <MessageCircle className="size-5" aria-hidden="true" />
      Chamar {sellerName} no WhatsApp
    </a>
  );
}
