import { register } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { AlwaysOnSampler, BatchSpanProcessor } from "@opentelemetry/sdk-trace";
import { z } from "zod";
import { httpUrl, serverScope } from "./config/config";
import { parseOrExit } from "./config/report";
import { AllowListProcessor } from "./tracing/allow-list.processor";

/*
 * The tracing bootstrap, preloaded (`node --require ./dist/tracing.js`) so
 * http, express, pg and the AWS SDK are patched before anything requires
 * them. It owns the OTEL_* variables it reads; every other OTEL_* is the
 * SDK's. Unset endpoint: the SDK never starts, so nothing is exported.
 */

const EXPORT_TIMEOUT_MS = 1_000;
const SHUTDOWN_LIMIT_MS = 5_000;

// The server's scope is checked here too, so one failed boot names every
// offending variable, the endpoint included.
const { tracing } = parseOrExit({
  ...serverScope,
  tracing: z.object({ OTEL_EXPORTER_OTLP_ENDPOINT: httpUrl.optional() }),
});

const sdk = tracing.OTEL_EXPORTER_OTLP_ENDPOINT ? startSdk() : undefined;

function startSdk(): NodeSDK {
  // Nest's ESM packages import express: patching it needs the ESM loader hook.
  register(
    "@opentelemetry/instrumentation/hook.mjs",
    pathToFileURL(__filename),
  );
  const exporter = new OTLPTraceExporter({ timeoutMillis: EXPORT_TIMEOUT_MS });
  const sdk = new NodeSDK({
    // Incoming trace context is continued but cannot opt a request out.
    sampler: new AlwaysOnSampler(),
    spanProcessors: [
      new AllowListProcessor(new BatchSpanProcessor({ exporter })),
    ],
    // Traces only: the receiver rejects metrics and logs, whatever the env asks for.
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: [
      // The AWS SDK span already covers each S3 call.
      new HttpInstrumentation({ disableOutgoingRequestInstrumentation: true }),
      // One span per middleware would spend Railway's span budget on noise.
      new ExpressInstrumentation({
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
      }),
      new PgInstrumentation({ ignoreConnectSpans: true }),
      new AwsInstrumentation(),
    ],
  });
  sdk.start();
  return sdk;
}

/**
 * Exports the spans still pending, giving up after five seconds. A no-op
 * when tracing is off. Call it once the server has stopped taking requests.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  await Promise.race([
    sdk.shutdown(),
    sleep(SHUTDOWN_LIMIT_MS, undefined, { ref: false }),
  ]);
}
