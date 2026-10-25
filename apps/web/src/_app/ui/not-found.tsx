import { NotFoundMessage } from "@/shared/ui/not-found-message";

export function NotFound() {
  return (
    <NotFoundMessage
      text="O link pode estar incompleto ou a página saiu do ar."
      href="/"
      action="Ir para o início"
    />
  );
}
