/**
 * Edit user role (Story 1.2 Task 5, AC 3/4/6). One `transaction()` call
 * updates `User.role` and writes the `AuditLog` row (`USER_ROLE_CHANGED`,
 * before/after carrying the old/new role).
 *
 * AC 3's "permissions change on their next request" is already satisfied by
 * Story 1.1's `cookieCache: { enabled: false }` (the user row, including
 * `role`, is re-read fresh every request) — no second mechanism (e.g.
 * forced session invalidation) is built here to achieve the same thing.
 *
 * Self-role-change guard (AC 6, code-review follow-up 2026-08-16): if
 * `data.userId === actor.userId`, reject BEFORE touching the database —
 * same pattern and placement as `deactivate-user.action.ts`'s
 * self-deactivation guard. An admin can never change their own role,
 * regardless of how many other admins exist.
 *
 * No-op guard (code-review follow-up 2026-08-16): if the requested role is
 * already the user's current role, skip the mutation + audit write entirely
 * and return the existing state — avoids a misleading before==after
 * `AuditLog` transition that never actually happened.
 */
import "server-only";
import { z } from "zod";
import { transaction, writeAuditLog, UserRole } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "./get-current-actor";
import { requireAdmin } from "./require-admin";

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(UserRole),
});

export type UpdateUserRoleInput = z.input<typeof updateUserRoleSchema>;

export interface UpdateUserRoleOutput {
  userId: string;
}

export async function updateUserRole(
  input: UpdateUserRoleInput,
  request: CurrentActorRequest,
): Promise<UpdateUserRoleOutput> {
  const parsed = updateUserRoleSchema.safeParse(input);
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
          "SELF_ROLE_CHANGE_FORBIDDEN",
          "You cannot change your own role.",
          { status: 403 },
        );
      }

      return transaction({ tenantId: actor.tenantId, role: actor.role }, async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: data.userId } });
        if (!existing) {
          throw new AppError("NOT_FOUND", "User not found.", { status: 404 });
        }

        if (existing.role === data.role) {
          return { userId: data.userId };
        }

        await tx.user.update({
          where: { id: data.userId },
          data: { role: data.role },
        });

        await writeAuditLog(tx, {
          tenantId: actor.tenantId,
          entity: "User",
          entityId: data.userId,
          action: "USER_ROLE_CHANGED",
          before: { role: existing.role },
          after: { role: data.role },
          actorUserId: actor.userId,
        });

        return { userId: data.userId };
      });
    },
    { attemptedAction: "USER_ROLE_CHANGE", targetUserId: data.userId },
  );
}
