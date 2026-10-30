import { TOO_MANY_ATTEMPTS } from "@closeout/contracts/schemas";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app-exception";

/** A 429 telling the client how many seconds to wait before trying again. */
export class TooManyAttempts extends AppException {
  constructor(retryAfter: number) {
    super(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY_ATTEMPTS, { retryAfter });
  }
}
