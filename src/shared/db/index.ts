/**
 * The sole export surface of `src/shared/db` (AD-3, design.md). `client.ts`
 * (the base Prisma client) is module-private and deliberately NOT
 * re-exported here — every consumer goes through one of the two named modes
 * below, never a raw client.
 */
import "server-only";

export type { TenantContext } from "./types";
// Re-exports BOTH the runtime const object and the type (same name, same
// generated source) — callers that need to derive a Zod enum/label mapping
// from the real 3-value Prisma enum (code-review follow-up 2026-08-16, so a
// future 4th role only needs to change in the schema) use the value; callers
// that only need the type keep using `type UserRole` as before.
export { UserRole } from "../../generated/prisma/enums";
export { scoped, transaction, type ScopedClient } from "./scoped";
export { bootstrap } from "./bootstrap";
export { authPrisma } from "./ambient";
export { writeAuditLog, type AuditLogEntry } from "./audit";
export { isUniqueConstraintViolation } from "./errors";
