/**
 * Reactivate user (Story 1.2 Task 9, AC 7, code-review follow-up
 * 2026-08-16). Mirrors `deactivate-user.action.ts`'s structure exactly,
 * inverted: one `transaction()` call sets `User.isActive = true` and writes
 * the `AuditLog` row (`USER_REACTIVATED`, `before: { isActive: false }`,
 * `after: { isActive: true }`).
 *
 * No self-check needed here — `getCurrentActor()`'s `isActive` re-check
 * (Task 3) already makes it impossible for a deactivated actor to reach any
 * admin action (including this one) in the first place, so self-reactivation
 * can never arise.
 *
 * No-op guard: if the target is already active, skip the mutation + audit
 * write entirely and return the existing state — avoids a misleading
 * before==after `AuditLog` transition that never actually happened.
 */
import { z } from "zod";
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "./get-current-actor";
import { requireAdmin } from "./require-admin";

export const reactivateUserSchema = z.object({
  userId: z.string().min(1),
});

export type ReactivateUserInput = z.input<typeof reactivateUserSchema>;

export interface ReactivateUserOutput {
  userId: string;
}

export async function reactivateUser(
  input: ReactivateUserInput,
  request: CurrentActorRequest,
): Promise<ReactivateUserOutput> {
  const parsed = reactivateUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid input.", {
      status: 400,
      details: z.flattenError(parsed.error),
    });
  }
  const data = parsed.data;

  return requireAdmin(
    request,
    async (actor) => {
      return transaction({ tenantId: actor.tenantId, role: actor.role }, async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: data.userId } });
        if (!existing) {
          throw new AppError("NOT_FOUND", "User not found.", { status: 404 });
        }

        if (existing.isActive) {
          return { userId: data.userId };
        }

        await tx.user.update({
          where: { id: data.userId },
          data: { isActive: true },
        });

        await writeAuditLog(tx, {
          tenantId: actor.tenantId,
          entity: "User",
          entityId: data.userId,
          action: "USER_REACTIVATED",
          before: { isActive: existing.isActive },
          after: { isActive: true },
          actorUserId: actor.userId,
        });

        return { userId: data.userId };
      });
    },
    { attemptedAction: "USER_REACTIVATE", targetUserId: data.userId },
  );
}
