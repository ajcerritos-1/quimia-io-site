/**
 * Single API error envelope (platform-foundation spec, ARCHITECTURE-SPINE.md
 * Consistency Conventions): every API error response body matches
 * `{ error: { code, message, details? } }`, across every module — no
 * module invents its own error shape.
 */

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AppErrorOptions {
  /** HTTP status the route handler should respond with. Defaults to 500. */
  status?: number;
  /** Extra machine-readable context (e.g. which field failed validation). */
  details?: unknown;
  /** Preserve the original cause for logging (never serialized to clients). */
  cause?: unknown;
}

/**
 * The one error type every module throws for an expected, client-facing
 * failure. Anything that reaches `toErrorResponse` as a plain `Error` (or a
 * non-Error thrown value) is treated as unexpected and mapped to a generic
 * envelope — never re-serialized as-is, to avoid leaking internals (stack
 * traces, raw driver messages) to API consumers.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

const GENERIC_ENVELOPE: ErrorEnvelope = {
  error: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  },
};

export function toErrorResponse(err: unknown): ErrorEnvelope {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }
  return GENERIC_ENVELOPE;
}
