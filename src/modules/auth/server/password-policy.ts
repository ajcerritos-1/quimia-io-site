/**
 * NFR-2, centralized here (AD-8) so both Better Auth's own config and any
 * other consumer (e.g. Story 1.2's create-user Zod schema) read THIS value
 * instead of hardcoding a second, possibly-divergent length check.
 *
 * Kept in its own file with ZERO other imports (Story 1.3 fix — see
 * `1-3-role-based-access-control-enforced-everywhere.md` Debug Log): `auth.ts`
 * calls `betterAuth(...)` at module scope and transitively imports
 * `src/shared/db` (Prisma/`pg`) — importing ANYTHING from that file, even an
 * unrelated constant, pulls that entire module graph into whichever bundle
 * imports it. A "use client" component (`create-user-form.tsx`) that only
 * needs this constant must import it from here, never from `./auth`.
 */
export const MIN_PASSWORD_LENGTH = 12;
