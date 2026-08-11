/**
 * The single module allowed to read `process.env` for application config
 * (platform-foundation spec: "Raw `process.env` reads MUST NOT occur in
 * business logic"). Every other module imports the parsed `env` singleton
 * below instead of touching `process.env` directly.
 *
 * `loadEnv()` is exported separately (not just the singleton) so unit tests
 * can validate parsing behavior against arbitrary input without needing a
 * real process environment.
 *
 * P1010 guard (design.md): whatever entrypoint imports this module MUST run
 * `loadEnvConfig()` from `@next/env` (or equivalent) before anything reads
 * `process.env`, and BEFORE any Prisma client is instantiated — Prisma 7 no
 * longer auto-loads `.env` files.
 */
import { z } from "zod";

const envSchema = z.object({
  // Pooled connection (pgbouncer), used by the running app at runtime,
  // connecting as the non-owner `quimia_app` role (AD-2, D10). Never the
  // direct/owner connection string — that one is CLI-only (prisma.config.ts).
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Better Auth config (Phase 6, design.md "Better Auth Config"). Signs and
  // encrypts sessions/tokens — never a hardcoded default in this codebase
  // (Better Auth itself falls back to an insecure default when unset, which
  // is exactly the P1010-style footgun this schema exists to prevent).
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

let cachedEnv: Env | undefined;

function resolveEnv(): Env {
  cachedEnv ??= loadEnv(process.env);
  return cachedEnv;
}

// Lazy singleton: validation runs on FIRST property access, not at import
// time. This keeps merely importing this module side-effect-free (safe for
// unit tests, tooling, etc. that never read a property off `env`), while
// still guaranteeing validation happens before any real consumer's first
// `process.env` read — e.g. `shared/db/client.ts` reads `env.DATABASE_URL`
// exactly once, right when it builds the adapter, which is still "before
// any Prisma client is instantiated" (P1010 guard).
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    return resolveEnv()[prop as keyof Env];
  },
});
