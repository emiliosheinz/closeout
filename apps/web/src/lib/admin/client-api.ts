/** Error carrying the HTTP status and the API's pt-BR message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const INVALID_FIELDS =
  "Alguns campos estão inválidos. Confira e tente de novo.";
/** Messages written by the API for people contain Portuguese characters or words. */
const PORTUGUESE =
  /[áàâãéêíóôõúçÁÉÍÓÚÇ]|\b(Informe|Envie|Use|Adicione|Cada|Este|Esta|Um|Uma)\b/;

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
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

/**
 * Browser-side call to the API through the same-origin `/api/v1` proxy.
 * The session cookie travels automatically; a 401 sends the admin back to
 * the login page.
 */
export async function api<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`/api/v1${path}`, init);
  if (response.status === 401) {
    window.location.assign("/admin/entrar");
    throw new ApiError(401, "Sua sessão expirou. Entre de novo.");
  }
  if (!response.ok) throw await readError(response);
  if (method !== "GET") await expireCatalogCache();
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
