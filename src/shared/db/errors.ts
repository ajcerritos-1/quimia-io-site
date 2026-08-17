/**
 * Prisma error classification, kept here (not in a caller module) because
 * only `src/shared/db` may import the generated Prisma client directly
 * (AD-3) — a caller needing to distinguish "duplicate row" from any other
 * database failure calls this instead of importing `Prisma` itself.
 */
import { Prisma } from "../../generated/prisma/client";

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
