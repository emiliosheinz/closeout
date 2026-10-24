import { NotFoundMessage } from "@/components/storefront/not-found-message";

export default function NotFound() {
  return (
    <NotFoundMessage
      text="O link pode estar incompleto ou a página saiu do ar."
      href="/"
      action="Ir para o início"
    />
  );
}
