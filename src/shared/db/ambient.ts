/**
 * The Better Auth binding (design.md "Wrapper API", D1). Better Auth's
 * `prismaAdapter(client)` takes a client ONCE at module scope — but the
 * client that resolves a given request's data depends on THAT request's
 * tenant, which is only known per-request (D8's `AsyncLocalStorage`). A
 * `Proxy` is the only way to give a module-scope-bound adapter a per-request
 * identity: every property access re-resolves `scoped()` against whatever
 * context is active for the CURRENT async execution at the moment of access.
 *
 * Throws if accessed outside `runWithContext` — there is no context-free
 * fallback (AD-3 forbids a third, unscoped mode here).
 */
import "server-only";
import { getContext } from "../context/request-context";
import { scoped, type ScopedClient } from "./scoped";
import type { TenantContext } from "./types";

function resolveScopedClient(): ScopedClient {
  const context = getContext();
  if (!context) {
    throw new Error(
      "shared/db: authPrisma accessed outside runWithContext — no tenant " +
        "context is available. AD-3 forbids an unscoped fallback here; " +
        "callers must resolve tenant context (bootstrap mode) and enter " +
        "runWithContext before touching authPrisma.",
    );
  }
  // request-context.ts's own `TenantContext.role` stays `string` (D8's store
  // is shared with shared/logging, which has no reason to know `UserRole`).
  // This is the one place that narrows it back to the DB layer's stricter
  // type before handing off to `scoped()`.
  const tenantContext: TenantContext = {
    tenantId: context.tenant.tenantId,
    role: context.tenant.role as TenantContext["role"],
  };
  return scoped(tenantContext);
}

export const authPrisma = new Proxy({} as ScopedClient, {
  get(_target, prop) {
    return Reflect.get(resolveScopedClient(), prop);
  },
});
