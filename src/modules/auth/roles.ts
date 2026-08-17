/**
 * The ONE place role-comparison logic lives (Story 1.3 Task 1, AC 1/7).
 * Both `requireRole()` (server enforcement) and any UI disabled-state check
 * call THIS function — never re-implement `.includes()`/`role !== "x"`
 * inline anywhere else. This is the concrete mechanism that prevents the
 * classic RBAC bug where the UI and the API silently disagree about who's
 * allowed to do what.
 *
 * `import type` only, below — this file has ZERO runtime imports, so it is
 * safe to import from both server code and a `"use client"` component
 * without pulling in `src/shared/db`'s Prisma-backed module graph (which
 * requires `DATABASE_URL` etc. at import time and would break, e.g., a
 * plain unit-test environment that never provisions those vars).
 */
import type { UserRole } from "../../shared/db";

export function isRoleAllowed(
  role: UserRole,
  allowedRoles: UserRole[],
): boolean {
  return allowedRoles.includes(role);
}
