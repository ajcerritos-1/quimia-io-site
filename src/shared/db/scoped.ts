/**
 * Scoped mode — MODE 1 (design.md "Wrapper API", D5, D6). Every query that
 * runs through a scoped client (or `transaction()`) carries `app.tenant_id`
 * and `app.role` into the SAME Postgres transaction as the query itself,
 * via `SELECT set_config(..., TRUE)`. `set_config` (not `SET LOCAL`) is used
 * because `SET LOCAL` cannot be parameterized — string-interpolating a
 * tenant id into SQL would be an injection vector (D5). `set_config(...,
 * TRUE)` is transaction-scoped (equivalent to `SET LOCAL`) and IS
 * parameterizable, which also makes it pgbouncer/transaction-pooling safe.
 *
 * `scoped(ctx)` gives per-operation auto-wrap (D6: array-form `$transaction`
 * inside `$allOperations`, because `query(args)` cannot be re-routed onto a
 * different `tx` handle — the array form is the only shape that keeps
 * `set_config` and the query on one connection). `transaction(ctx, fn)`
 * gives an interactive transaction for callers that need several statements
 * to share one context (e.g. Phase 6's nickname->email resolve). Both are
 * the SAME contract over the SAME `set_config` mechanism — not a third mode.
 */
import type { Prisma } from "../../generated/prisma/client";
import { base } from "./client";
import type { TenantContext } from "./types";

function buildScopedClient(ctx: TenantContext) {
  return base.$extends({
    name: `scoped:${ctx.tenantId}:${ctx.role}`,
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, , result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, TRUE)`,
            base.$executeRaw`SELECT set_config('app.role', ${ctx.role}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type ScopedClient = ReturnType<typeof buildScopedClient>;

// Keyed `${tenantId}:${role}` (design.md) — a request that resolves the same
// tenant/role pair reuses the same extended client instance rather than
// re-building the extension on every call.
const cache = new Map<string, ScopedClient>();

function cacheKey(ctx: TenantContext): string {
  return `${ctx.tenantId}:${ctx.role}`;
}

export function scoped(ctx: TenantContext): ScopedClient {
  const key = cacheKey(ctx);
  let client = cache.get(key);
  if (!client) {
    client = buildScopedClient(ctx);
    cache.set(key, client);
  }
  return client;
}

async function setConfigOnTx(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, TRUE)`;
  await tx.$executeRaw`SELECT set_config('app.role', ${ctx.role}, TRUE)`;
}

/**
 * Interactive scoped transaction — same `set_config` contract as `scoped()`,
 * but every statement inside `fn` runs on the SAME `tx` handle (unlike
 * `$allOperations`, an interactive transaction's callback IS allowed to
 * reuse its own `tx` across multiple awaited statements).
 */
export function transaction<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return base.$transaction(async (tx) => {
    await setConfigOnTx(tx, ctx);
    return fn(tx);
  });
}
