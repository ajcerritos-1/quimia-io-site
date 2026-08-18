/**
 * Story 1.4 Task 4 (AC 2, NOM-024-SSA3). Named constants, same pattern as
 * `MIN_PASSWORD_LENGTH` (`password-policy.ts`) — in this codebase
 * "configurable" has so far meant "one centralized named constant" (Better
 * Auth's own `minPasswordLength: MIN_PASSWORD_LENGTH` precedent), not an env
 * var; no other policy threshold in this project is env-configurable today.
 *
 * Unlike `password-policy.ts`, this file has no "zero other imports"
 * constraint — lockout state is server-only, never read in a client
 * component — but it stays small and focused regardless.
 *
 * Confirmed 2026-08-17 (product decision): 5 attempts / 15-minute lockout.
 * Used by `sign-in.action.ts` to decide when to set `User.lockedUntil` and
 * to compute how far in the future to set it.
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
