import { z } from "zod";

export const GENERIC_500 = "Algo deu errado. Tente novamente em instantes.";
export const BAD_REQUEST = "Requisição inválida.";
export const MALFORMED_BODY = "Não foi possível ler os dados enviados.";
export const UNAUTHORIZED = "Entre para continuar.";
export const FORBIDDEN = "Você não tem permissão para esta ação.";
export const ORIGIN_FORBIDDEN = "Origem não permitida.";
export const NOT_FOUND = "Não encontrado.";
export const NO_CLIENT_IP =
  "Não foi possível identificar a origem da requisição.";
export const TOO_MANY_ATTEMPTS =
  "Muitas tentativas. Tente novamente em alguns minutos.";
export const PAYLOAD_TOO_LARGE = "Requisição grande demais.";
export const SERVICE_UNAVAILABLE = "Serviço indisponível no momento.";
export const UNKNOWN_FIELD = "Campo não permitido.";
export const REQUIRED_FIELD = "Preencha este campo.";
export const INVALID_VALUE = "Valor inválido.";
export const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";
export const LOGIN_INVALID = "Informe um e-mail válido e a senha.";
export const LOGIN_FAILED = "Não foi possível entrar agora.";

/** One failing input field: an RFC 6901 pointer and its pt-BR message. */
export const fieldErrorSchema = z.object({
  pointer: z.string(),
  detail: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/**
 * An RFC 9457 problem document as the API writes it. With `errors`, the
 * top-level `detail` repeats the first field's message.
 */
export const problemDocumentSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    requestId: z.string(),
    errors: z.array(fieldErrorSchema).min(1).optional(),
    checks: z.object({ database: z.enum(["up", "down"]) }).optional(),
  })
  .refine(
    (problem) =>
      !problem.errors || problem.detail === problem.errors[0]?.detail,
    {
      message: "detail must repeat the first field error",
      path: ["detail"],
    },
  );
export type ProblemDocument = z.infer<typeof problemDocumentSchema>;
