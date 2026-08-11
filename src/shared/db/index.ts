/**
 * The sole export surface of `src/shared/db` (AD-3, design.md). `client.ts`
 * (the base Prisma client) is module-private and deliberately NOT
 * re-exported here — every consumer goes through one of the two named modes
 * below, never a raw client.
 */
export type { TenantContext } from "./types";
export { scoped, transaction, type ScopedClient } from "./scoped";
export { bootstrap } from "./bootstrap";
export { authPrisma } from "./ambient";
