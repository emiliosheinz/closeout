import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  PayloadTooLargeException,
} from "@nestjs/common";
import { AppException } from "@/problem/app-exception";
import { ProblemFilter } from "@/problem/problem.filter";
import { MAX_FILE_BYTES, MAX_FILES_PER_REQUEST } from "./upload-limits";

const FILE_TOO_LARGE = `Cada foto pode ter até ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
const FIELDS_NOT_ALLOWED = "Envie apenas fotos, sem outros campos.";
export const TOO_MANY_PHOTOS = `Envie até ${MAX_FILES_PER_REQUEST} fotos por vez.`;

/**
 * Nest turns Multer limit errors into English messages; upload routes
 * answer them in Portuguese like every other validation error. Every other
 * error is written as the global problem filter writes it.
 */
@Catch()
export class UploadErrorsFilter extends ProblemFilter {
  /**
   * @param unexpectedFileMessage Multer reports both extra files and a wrong
   *   field name as "Unexpected file field"; each route says what it expects.
   */
  constructor(private readonly unexpectedFileMessage: string) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(this.translate(exception) ?? exception, host);
  }

  private translate(exception: unknown): AppException | undefined {
    if (
      !(exception instanceof PayloadTooLargeException) &&
      !(exception instanceof BadRequestException)
    ) {
      return undefined;
    }
    const translated: Record<string, string> = {
      "File too large": FILE_TOO_LARGE,
      "Too many files": this.unexpectedFileMessage,
      "Too many parts": this.unexpectedFileMessage,
      "Too many fields": FIELDS_NOT_ALLOWED,
      "Unexpected file field": this.unexpectedFileMessage,
    };
    // Nest appends " - <field>" to some Multer messages.
    const detail = translated[exception.message.split(" - ")[0] ?? ""];
    return detail === undefined
      ? undefined
      : new AppException(exception.getStatus(), detail);
  }
}
