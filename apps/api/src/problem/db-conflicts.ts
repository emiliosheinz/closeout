import { HttpStatus } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { AppException } from "./app-exception";

const TRY_AGAIN = "Não foi possível salvar agora. Tente de novo.";

/** Turns the listed driver error codes, and a deadlock, into a 409. */
export async function withConflicts<T>(
  run: () => Promise<T>,
  messages: Record<string, string>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const code =
      err instanceof QueryFailedError
        ? (err.driverError as { code?: string }).code
        : undefined;
    const message = code === "40P01" ? TRY_AGAIN : code && messages[code];
    if (message) throw new AppException(HttpStatus.CONFLICT, message);
    throw err;
  }
}
