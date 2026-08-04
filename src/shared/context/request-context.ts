/**
 * The single `AsyncLocalStorage<RequestContext>` for this codebase (D8).
 * Both `src/shared/db` (Phase 5 — reads `.tenant` to set `app.tenant_id`/
 * `app.role` before every scoped query) and `src/shared/logging` (Phase 4 —
 * reads `.requestId`/`.tenant.tenantId` onto every log line) consume THIS
 * store. Do not create a second store for either concern — D8 exists
 * specifically to prevent the two from drifting apart.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  // 'anonymous' covers requests before a session/role is resolved (e.g. the
  // sign-in bootstrap lookup, AD-3 mode 2). Once `src/shared/db` lands
  // (Phase 5), this narrows to `UserRole | 'anonymous'`.
  role: string;
}

export interface RequestContext {
  requestId: string;
  tenant: TenantContext;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the current request's context, or `undefined` outside of any
 * `runWithContext` call (e.g. module load time, a test that never entered
 * one). Callers that require a context to be present (e.g. the Better Auth
 * ambient proxy, Phase 5) are responsible for throwing themselves — this
 * function stays a plain, non-throwing getter.
 */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Runs `fn` with `context` bound for its entire synchronous AND asynchronous
 * extent (every `await` inside `fn` still sees this context — that is
 * `AsyncLocalStorage`'s whole purpose). Concurrent calls with different
 * contexts never leak into each other, even when interleaved.
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}
