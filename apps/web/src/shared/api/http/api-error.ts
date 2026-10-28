/** Each failing field's pt-BR message, keyed by its RFC 6901 pointer (`/name`). */
export type FieldErrors = Readonly<Record<string, string>>;

/** Error carrying the HTTP status and the API's pt-BR message. Status 0 means the request never reached the server. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
