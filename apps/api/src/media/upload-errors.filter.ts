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

const MULTER_MESSAGES: Record<string, string> = {
  "File too large": `Cada foto pode ter até ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
  "Too many files": `Envie até ${MAX_FILES_PER_REQUEST} fotos por vez.`,
  "Unexpected field": `Envie até ${MAX_FILES_PER_REQUEST} fotos por vez.`,
};

/**
 * Nest turns Multer limit errors into English messages; upload routes
 * answer them in Portuguese like every other validation error.
 */
@Catch(PayloadTooLargeException, BadRequestException)
export class UploadErrorsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const original = exception.getResponse();
    const message =
      typeof original === "object" && original !== null && "message" in original
        ? (original as { message: unknown }).message
        : exception.message;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message:
          typeof message === "string"
            ? (MULTER_MESSAGES[message] ?? message)
            : message,
      });
  }
}
