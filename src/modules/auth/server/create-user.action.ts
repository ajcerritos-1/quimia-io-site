/**
 * Create user (Story 1.2 Task 4, AC 1/3/4). One `transaction()` call
 * creates the `User` row, the matching `Account` row (Better Auth's own
 * email/password shape — `providerId: "credential"`, `accountId` = the new
 * user's own id, `password` = the scrypt hash via `better-auth/crypto`'s
 * `hashPassword`, same function `sign-in.action.ts` already imports), and
 * the `AuditLog` row (`USER_CREATED`) — three inserts, one wrapper
 * transaction (AD-4's "one wrapper call" pattern).
 *
 * Deliberately does NOT use Better Auth's `admin` plugin (see story Dev
 * Notes) — that plugin's free-string `role` and `banned` fields conflict
 * with this project's fixed `UserRole` enum and `User.isActive` design.
 *
 * Password policy enforced here is the SAME `MIN_PASSWORD_LENGTH` Better
 * Auth itself is configured with (`auth.ts`) — no second, possibly-divergent
 * length check (AD-8).
 *
 * A duplicate email/nickname (code-review follow-up 2026-08-16) is caught
 * as Postgres's own unique-constraint violation (Prisma error code P2002,
 * raised by the `@@unique([tenantId, email])`/`@@unique([tenantId,
 * nickname])` constraints) and translated into a friendly 409 `AppError`
 * instead of propagating as a raw, unhandled Prisma error.
 */
import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import {
  transaction,
  writeAuditLog,
  UserRole,
  isUniqueConstraintViolation,
} from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import { MIN_PASSWORD_LENGTH } from "./auth";
import type { CurrentActorRequest } from "./get-current-actor";
import { requireAdmin } from "./require-admin";

export const createUserSchema = z.object({
  email: z.email(),
  nickname: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: z.enum(UserRole),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

export interface CreateUserOutput {
  userId: string;
}

export async function createUser(
  input: CreateUserInput,
  request: CurrentActorRequest,
): Promise<CreateUserOutput> {
  const parsed = createUserSchema.safeParse(input);
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
      const newUserId = createId();
      const passwordHash = await hashPassword(data.password);

      try {
        await transaction({ tenantId: actor.tenantId, role: actor.role }, async (tx) => {
          await tx.user.create({
            data: {
              id: newUserId,
              tenantId: actor.tenantId,
              email: data.email,
              nickname: data.nickname,
              name: data.name,
              role: data.role,
            },
          });
          await tx.account.create({
            data: {
              id: createId(),
              accountId: newUserId,
              providerId: "credential",
              userId: newUserId,
              password: passwordHash,
            },
          });
          await writeAuditLog(tx, {
            tenantId: actor.tenantId,
            entity: "User",
            entityId: newUserId,
            action: "USER_CREATED",
            before: null,
            after: {
              email: data.email,
              nickname: data.nickname,
              name: data.name,
              role: data.role,
            },
            actorUserId: actor.userId,
          });
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new AppError(
            "EMAIL_OR_NICKNAME_IN_USE",
            "A user with this email or nickname already exists.",
            { status: 409, cause: error },
          );
        }
        throw error;
      }

      return { userId: newUserId };
    },
    { attemptedAction: "USER_CREATE" },
  );
}
