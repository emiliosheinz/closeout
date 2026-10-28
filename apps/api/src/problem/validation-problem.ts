import type { FieldError } from "@closeout/contracts/schemas";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app-exception";

/** A 400 naming each failing input field; the first field's message is the `detail`. */
export class ValidationProblem extends AppException {
  constructor(errors: FieldError[]) {
    super(HttpStatus.BAD_REQUEST, errors[0]?.detail ?? "", { errors });
  }
}
