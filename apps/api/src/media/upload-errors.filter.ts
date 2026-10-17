import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { Response } from "express";
import { MAX_FILE_BYTES, MAX_FILES_PER_REQUEST } from "./upload-limits";

const FILE_TOO_LARGE = `Cada foto pode ter até ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
const FIELDS_NOT_ALLOWED = "Envie apenas fotos, sem outros campos.";
export const TOO_MANY_PHOTOS = `Envie até ${MAX_FILES_PER_REQUEST} fotos por vez.`;

/**
 * Nest turns Multer limit errors into English messages; upload routes
 * answer them in Portuguese like every other validation error.
 */
@Catch(PayloadTooLargeException, BadRequestException)
export class UploadErrorsFilter implements ExceptionFilter {
  /**
   * @param unexpectedFileMessage Multer reports both extra files and a wrong
   *   field name as "Unexpected file field"; each route says what it expects.
   */
  constructor(private readonly unexpectedFileMessage: string) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const original = exception.getResponse();
    const body =
      typeof original === "object" && original !== null
        ? (original as { message?: unknown; error?: unknown })
        : {};
    const message = body.message ?? exception.message;
    const translated: Record<string, string> = {
      "File too large": FILE_TOO_LARGE,
      "Too many files": this.unexpectedFileMessage,
      "Too many parts": this.unexpectedFileMessage,
      "Too many fields": FIELDS_NOT_ALLOWED,
      "Unexpected file field": this.unexpectedFileMessage,
    };
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message:
          typeof message === "string"
            ? // Nest appends " - <field>" to some Multer messages.
              (translated[message.split(" - ")[0] ?? message] ?? message)
            : message,
        error: body.error,
      });
  }
}
