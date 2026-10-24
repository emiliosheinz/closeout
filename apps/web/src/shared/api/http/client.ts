import { ApiError } from "./api-error";
import type { Schema } from "./schema";

export const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const INVALID_FIELDS =
  "Alguns campos estão inválidos. Confira e tente de novo.";
const NETWORK_FAILURE = "Sem conexão. Verifique a internet e tente de novo.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo.";
/** Messages written by the API for people contain Portuguese characters or words. */
const PORTUGUESE =
  /[áàâãéêíóôõúçÁÉÍÓÚÇ]|\b(Informe|Envie|Use|Adicione|Cada|Este|Esta|Um|Uma)\b/;

type Write = "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * A write that succeeded. `parsed: false` means the body did not match the
 * schema: the write still happened, so callers carry on with `data` unknown.
 */
export type WriteResult<T> =
  | { parsed: true; data: T }
  | { parsed: false; data: unknown };

async function readError(response: Response): Promise<ApiError> {
  try {
    const body: { message?: unknown } = await response.json();
    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message];
    // The API writes user-facing messages in Portuguese; framework validation
    // defaults are English and mean a field the form should have caught.
    const portuguese = messages.filter(
      (m): m is string => typeof m === "string" && PORTUGUESE.test(m),
    );
    return new ApiError(
      response.status,
      portuguese.join(" ") ||
        (response.status === 400 ? INVALID_FIELDS : GENERIC_ERROR),
    );
  } catch {
    return new ApiError(response.status, GENERIC_ERROR);
  }
}

// The write already succeeded; a failed expiry only delays the storefront
// until the cache's own revalidation window passes.
async function expireCatalogCache(): Promise<void> {
  try {
    await fetch("/api/catalog/revalidate", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {}
}

async function send(
  method: "GET" | Write,
  path: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, init);
  } catch {
    throw new ApiError(0, NETWORK_FAILURE);
  }
  if (response.status === 401) throw new ApiError(401, SESSION_EXPIRED);
  if (!response.ok) throw await readError(response);
  if (method !== "GET") await expireCatalogCache();
  return response;
}

async function parseBody<T>(
  path: string,
  response: Response,
  schema: Schema<T>,
): Promise<WriteResult<T>> {
  const raw: unknown = await response.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (result.success) return { parsed: true, data: result.data };
  console.error(`Response from ${path} failed its schema`, result.error);
  return { parsed: false, data: raw };
}

/**
 * Browser-side calls to the API through the same-origin `/api/v1` proxy; the
 * session cookie travels automatically. Failures throw an `ApiError`: status
 * 0 when the request never arrived, 401 when the session ended. The client
 * never navigates; callers react to the error.
 */
export async function apiGet<T>(path: string, schema: Schema<T>): Promise<T> {
  const response = await send("GET", path);
  const result = await parseBody(path, response, schema);
  if (!result.parsed) throw new ApiError(500, GENERIC_ERROR);
  return result.data;
}

/** A write whose response body is not used. */
export async function api(
  method: Write,
  path: string,
  body?: unknown,
): Promise<void> {
  await send(method, path, body);
}

/** A write whose response body is parsed; a body that fails the schema still resolves. */
export async function apiParsed<T>(
  method: Write,
  path: string,
  body: unknown,
  schema: Schema<T>,
): Promise<WriteResult<T>> {
  return parseBody(path, await send(method, path, body), schema);
}
