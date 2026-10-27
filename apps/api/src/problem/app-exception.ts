import type { FieldError } from "@closeout/contracts/schemas";
import { HttpException, type HttpStatus } from "@nestjs/common";

export interface ProblemExtensions {
  /** Failing input fields; the first one's message is the `detail`. */
  errors?: FieldError[];
  checks?: { database: "up" | "down" };
  /** Seconds, sent as the `Retry-After` header. */
  retryAfter?: number;
}

/**
 * The one exception app code throws. Its `detail` is user-facing pt-BR copy
 * (a constant or a message factory's result) and is the only text the
 * problem filter puts in a response.
 */
export class AppException extends HttpException {
  readonly errors?: FieldError[];
  readonly checks?: { database: "up" | "down" };
  readonly retryAfter?: number;

  constructor(
    status: HttpStatus,
    readonly detail: string,
    { errors, checks, retryAfter }: ProblemExtensions = {},
  ) {
    super(detail, status);
    this.errors = errors;
    this.checks = checks;
    this.retryAfter = retryAfter;
  }
}
