/**
 * Deactivate user (Story 1.2 Task 6, AC 2/3/4/5).
 *
 * Self-deactivation guard (AC 5) runs BEFORE touching the database at all —
 * an admin can never deactivate their own account, ever, regardless of how
 * many other admins exist (a deliberate product rule to prevent an admin,
 * or every admin tenant-wide, from locking themselves out).
 *
 * One `transaction()` call: sets `User.isActive = false`, deletes ALL of
 * that user's `Session` rows (active revocation, AC 2 — not a passive
 * next-request check), and writes the `AuditLog` row (`USER_DEACTIVATED`).
 * This, together with Story 1.1's existing
 * `databaseHooks.session.create.before` (blocks the next sign-in) and Task
 * 3's `getCurrentActor` isActive re-check (defense-in-depth for any other
 * authenticated path), confirms AC 2 three ways.
 *
 * Deactivation, not deletion, stays the only mechanism — no hard-delete
 * action exists anywhere in this story.
 *
 * No-op guard (code-review follow-up 2026-08-16): if the target is already
 * inactive, skip the mutation + audit write entirely and return the
 * existing state — avoids a misleading before==after `AuditLog` transition
 * that never actually happened.
 */
import { z } from "zod";
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "./get-current-actor";
import { requireAdmin } from "./require-admin";

export const deactivateUserSchema = z.object({
  userId: z.string().min(1),
});

export type DeactivateUserInput = z.input<typeof deactivateUserSchema>;

export interface DeactivateUserOutput {
  userId: string;
}

export async function deactivateUser(
  input: DeactivateUserInput,
  request: CurrentActorRequest,
): Promise<DeactivateUserOutput> {
  const parsed = deactivateUserSchema.safeParse(input);
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
      if (data.userId === actor.userId) {
        throw new AppError(
          "SELF_DEACTIVATION_FORBIDDEN",
          "You cannot deactivate your own account.",
          { status: 403 },
        );
      }

      return transaction({ tenantId: actor.tenantId, role: actor.role }, async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: data.userId } });
        if (!existing) {
          throw new AppError("NOT_FOUND", "User not found.", { status: 404 });
        }

        if (!existing.isActive) {
          return { userId: data.userId };
        }

        await tx.user.update({
          where: { id: data.userId },
          data: { isActive: false },
        });
        await tx.session.deleteMany({ where: { userId: data.userId } });

        await writeAuditLog(tx, {
          tenantId: actor.tenantId,
          entity: "User",
          entityId: data.userId,
          action: "USER_DEACTIVATED",
          before: { isActive: existing.isActive },
          after: { isActive: false },
          actorUserId: actor.userId,
        });

        return { userId: data.userId };
      });
    },
    { attemptedAction: "USER_DEACTIVATE", targetUserId: data.userId },
  );
}
