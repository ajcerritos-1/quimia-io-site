/**
 * Shared types for `src/shared/db` (design.md "Wrapper API"). This file is
 * the only place outside `client.ts` that imports directly from the
 * generated Prisma client — both live inside `src/shared/db`, which is the
 * ESLint boundary's own exemption (eslint.config.mjs `ignores`).
 */
import type { UserRole } from "../../generated/prisma/enums";

/**
 * The session identity every scoped-mode query runs under. `role` starts as
 * `'anonymous'` before any user is resolved (AD-3 bootstrap-mode callers,
 * middleware before sign-in) and narrows to `UserRole` once a session's user
 * is loaded. `request-context.ts`'s own `TenantContext` keeps `role: string`
 * deliberately looser (D8's store is shared with `shared/logging`, which has
 * no reason to know about `UserRole`) — this is the DB layer's own, stricter
 * type, per design.md's `types.ts` snippet.
 */
export type TenantContext = {
  tenantId: string;
  role: UserRole | "anonymous";
};
