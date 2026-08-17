/**
 * Audit-log write entrypoint (Story 1.2 Task 2, AD-10). THE single write
 * path every module must reuse to record an `AuditLog` row — no later epic
 * (2.4, 3.3, 6.2, 6.6, 7.4, ...) may invent its own insert. Callable INSIDE
 * an existing `transaction()` callback so the audit row commits in the exact
 * same Postgres transaction as the mutation it is recording (AD-4: "one
 * wrapper call", not two separate operations that could diverge).
 */
import "server-only";
import { Prisma } from "../../generated/prisma/client";

export interface AuditLogEntry {
  tenantId: string;
  entity: string;
  entityId: string;
  action: string;
  /**
   * `null` is a valid, meaningful value (e.g. "no previous state" on
   * create) — translated to `Prisma.JsonNull` below, since Prisma's `Json?`
   * fields reject a bare JS `null` at the client layer. Omit the property
   * entirely (`undefined`) to leave the column NULL without asserting
   * anything about "no previous state" being semantically intended.
   */
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  actorUserId: string;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditLogEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      ...(entry.before !== undefined && {
        before: entry.before === null ? Prisma.JsonNull : entry.before,
      }),
      ...(entry.after !== undefined && {
        after: entry.after === null ? Prisma.JsonNull : entry.after,
      }),
      actorUserId: entry.actorUserId,
    },
  });
}
