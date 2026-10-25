/** Error carrying the HTTP status and the API's pt-BR message. Status 0 means the request never reached the server. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
