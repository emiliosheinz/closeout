import { STATUS_CODES } from "node:http";
import {
  BAD_REQUEST,
  FORBIDDEN,
  GENERIC_500,
  NOT_FOUND,
  PAYLOAD_TOO_LARGE,
  SERVICE_UNAVAILABLE,
  TOO_MANY_ATTEMPTS,
  UNAUTHORIZED,
} from "@closeout/contracts/schemas";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AppException } from "./app-exception";

const COPY_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: FORBIDDEN,
  [HttpStatus.NOT_FOUND]: NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: PAYLOAD_TOO_LARGE,
  [HttpStatus.TOO_MANY_REQUESTS]: TOO_MANY_ATTEMPTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: SERVICE_UNAVAILABLE,
};

function fallbackCopy(status: number): string {
  return (
    COPY_BY_STATUS[status] ??
    (status < HttpStatus.INTERNAL_SERVER_ERROR ? BAD_REQUEST : GENERIC_500)
  );
}

/**
 * Writes every error as an RFC 9457 problem document. Only an
 * `AppException` speaks for itself; any other HTTP exception (router 404,
 * framework or library errors) gets pt-BR copy for its status, and anything
 * else is a logged 500 that reveals nothing.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const problem = this.toAppException(exception);
    const response = http.getResponse<Response>();
    const status = problem.getStatus();
    if (problem.retryAfter !== undefined) {
      response.setHeader("Retry-After", String(problem.retryAfter));
    }
    response
      .status(status)
      .type("application/problem+json")
      .json({
        type: "about:blank",
        title: STATUS_CODES[status],
        status,
        detail: problem.detail,
        requestId: String(http.getRequest<Request>().id),
        ...(problem.errors && { errors: problem.errors }),
        ...(problem.checks && { checks: problem.checks }),
      });
  }

  private toAppException(exception: unknown): AppException {
    if (exception instanceof AppException) return exception;
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return new AppException(status, fallbackCopy(status));
    }
    this.logger.error({ err: exception }, "Unhandled error");
    return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, GENERIC_500);
  }
}
