/**
 * Structured JSON logging (platform-foundation spec: "Every log line MUST
 * be structured JSON and MUST carry `tenant_id` and `request_id`"). Reads
 * the same `AsyncLocalStorage` store as `src/shared/db` (D8) via `mixin` —
 * pino calls `mixin()` synchronously on every log call, which is exactly
 * how `AsyncLocalStorage.getStore()` needs to be read.
 *
 * `tenant_id`/`request_id` default to `"unknown"` rather than being omitted
 * when no request context is active (e.g. app startup, background jobs) —
 * the spec requires every line to CARRY these keys, not only lines emitted
 * during request handling.
 */
import pino, { type DestinationStream } from "pino";
import { getContext } from "../context/request-context";

export type Logger = pino.Logger;

export function createLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      mixin() {
        const ctx = getContext();
        return {
          request_id: ctx?.requestId ?? "unknown",
          tenant_id: ctx?.tenant.tenantId ?? "unknown",
        };
      },
    },
    destination,
  );
}

export const logger: Logger = createLogger();
