/**
 * NFR-2, centralized here (AD-8) so both Better Auth's own config and any
 * other consumer (e.g. Story 1.2's create-user Zod schema) read THIS value
 * instead of hardcoding a second, possibly-divergent length check.
 *
 * Kept in its own file with ZERO other imports beyond `zod` (Story 1.3 fix —
 * see `1-3-role-based-access-control-enforced-everywhere.md` Debug Log):
 * `auth.ts` calls `betterAuth(...)` at module scope and transitively imports
 * `src/shared/db` (Prisma/`pg`) — importing ANYTHING from that file, even an
 * unrelated constant, pulls that entire module graph into whichever bundle
 * imports it. A "use client" component (`create-user-form.tsx`) that only
 * needs this constant must import it from here, never from `./auth`. `zod`
 * itself is client-safe (no `src/shared/db` in its own module graph) —
 * `create-user-form.tsx` already imports it directly — so it does not
 * reintroduce that bug.
 *
 * Story 1.4 Task 1 (AC 1): also centralizes the character-class complexity
 * rule NOM-024-SSA3 requires beyond plain length, and exports it together
 * with the length check as ONE shared Zod schema fragment
 * (`passwordPolicySchema`). Every password-set path (today: create-user;
 * tomorrow: any self-service reset/change-password path) imports this ONE
 * fragment instead of re-deriving the rule — closing the length-only
 * duplication `create-user.action.ts`/`create-user-form.tsx` had before this
 * story (Story 1.2/1.3 only shared the constant, not the full rule).
 */
import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 12;

// Confirmed 2026-08-17 (product decision): at least 3 of these 4 character
// classes must be present, on top of the 12-character minimum above.
const MIN_COMPLEXITY_CLASSES = 3;
const COMPLEXITY_CLASS_PATTERNS = [
  /[A-Z]/, // uppercase
  /[a-z]/, // lowercase
  /[0-9]/, // digit
  /[^A-Za-z0-9]/, // symbol
];

function meetsComplexity(password: string): boolean {
  const classCount = COMPLEXITY_CLASS_PATTERNS.filter((pattern) =>
    pattern.test(password),
  ).length;
  return classCount >= MIN_COMPLEXITY_CLASSES;
}

// AC 1's "specific reason" — Spanish UI copy, professional tone (UX-DR22,
// NFR-9). Reused for BOTH the length and complexity failures below so a
// caller never has to guess which specific message applies; both describe
// the same one policy.
const PASSWORD_POLICY_MESSAGE = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres e incluir mayúsculas, minúsculas, números o símbolos (al menos 3 de 4 tipos).`;

export const passwordPolicySchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_POLICY_MESSAGE)
  .refine(meetsComplexity, PASSWORD_POLICY_MESSAGE);
