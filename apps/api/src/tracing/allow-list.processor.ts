import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace";

/**
 * The span attributes that may leave the process: request method, route,
 * path and status; database system, operation and parameterized query text;
 * AWS service, operation and bucket. Everything else (headers, query
 * strings, user agent, peer addresses, bodies) is dropped.
 */
export const ALLOWED_ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  "http.request.method",
  "http.route",
  "url.path",
  "http.response.status_code",
  "db.system.name",
  "db.operation.name",
  "db.query.text",
  "rpc.system",
  "rpc.service",
  "rpc.method",
  "aws.s3.bucket",
]);

/**
 * Wraps the exporting processor and strips each span as it ends, before the
 * wrapped processor sees it: attributes outside the allow-list, every event
 * (exception messages and stacks) and link, and the status message (a
 * driver's message can echo bound values). Deny by default.
 */
export class AllowListProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this.inner.onStart(span, parentContext);
  }

  onEnding(span: Span): void {
    const attributes = span.attributes as Record<string, unknown>;
    for (const key of Object.keys(attributes)) {
      if (!ALLOWED_ATTRIBUTE_KEYS.has(key)) delete attributes[key];
    }
    span.events.length = 0;
    span.links.length = 0;
    if (span.status.message !== undefined) {
      (span as { status: Span["status"] }).status = { code: span.status.code };
    }
  }

  onEnd(span: ReadableSpan): void {
    this.inner.onEnd(span);
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}
