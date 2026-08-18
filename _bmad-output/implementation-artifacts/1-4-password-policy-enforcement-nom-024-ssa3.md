# Story 1.4: Password Policy Enforcement (NOM-024-SSA3)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated 2026-08-17 via bmad-create-story. Verified against live code (not just prose) on 2026-08-17: MIN_PASSWORD_LENGTH=12 already exists (src/modules/auth/server/password-policy.ts) and is already wired into Better Auth's own `minPasswordLength` config (auth.ts) plus create-user.action.ts's Zod schema and create-user-form.tsx's client-side check (Story 1.2/1.3 work) — this story's actual net-new scope is (a) character-class complexity beyond length, and (b) account lockout after repeated failed sign-in attempts, since NEITHER exists anywhere in the codebase today. Confirmed via web research (2026-08-17) that Better Auth ^1.6.26 provides ONLY length validation for emailAndPassword (minPasswordLength/maxPasswordLength) — no built-in character-class complexity hook — and its only account-lockout feature is scoped to the `twoFactor` plugin (not used by this project); its rate-limiting is per-IP, not per-account, so it cannot substitute for AC 2's per-account lockout. Both gaps require custom application code in this story. -->

## Story

As an Admin,
I want password complexity enforced on every account,
so that the system complies with NOM-024-SSA3 and no account can be created with a weak password.

## Acceptance Criteria

1. Given a new user is created or resets their password, when the password is submitted, then it must meet the configured complexity policy (minimum length, character-class mix) or the action is rejected with a specific reason. [Source: epics.md#Story 1.4] — **scope note:** the only password-set path that exists in this codebase today is admin-created-user (`create-user.action.ts`); there is no self-service password-reset/change feature anywhere in the PRD's FR inventory or in the codebase (verified: no `resetPassword`/`changePassword`/`sendResetPassword` config or action exists). Do NOT build a new password-reset flow as part of this story — that would be scope creep not authorized by any FR. Implement the complexity check ONCE, centrally, so it already covers create-user today and will automatically cover any future reset/change-password path the moment one is built, without that future story needing to re-derive the policy.

2. Given repeated failed sign-in attempts on one account, when a configurable threshold is crossed, then the account is temporarily locked and the lockout event is audit-logged. [Source: epics.md#Story 1.4]

## Tasks / Subtasks

- [ ] Task 1: Define the complexity policy centrally (AC: 1) — `src/modules/auth/server/password-policy.ts` (MODIFIED, not new — this file already exists and already exports `MIN_PASSWORD_LENGTH = 12`)
  - [ ] Add a character-class complexity rule alongside the existing length constant. **Confirmed 2026-08-17 (product decision):** require at least 3 of 4 character classes (uppercase `A-Z`, lowercase `a-z`, digit `0-9`, symbol) in addition to the existing 12-character minimum.
  - [ ] Keep this file's existing "ZERO other imports" constraint (its own header comment explains why — importing anything from `src/shared/db` here would pull the entire Prisma/`pg` module graph into any client bundle that imports this file, e.g. `create-user-form.tsx`). A plain regex or hand-rolled character-counting predicate needs no imports — do not reach for a validation library.
  - [ ] Export a single shared Zod schema fragment from this file (e.g. `passwordPolicySchema = z.string().min(MIN_PASSWORD_LENGTH, "...").refine(meetsComplexity, "...")`) rather than just the raw constant — `create-user.action.ts` and `create-user-form.tsx` both currently duplicate `.min(MIN_PASSWORD_LENGTH, ...)` independently (Story 1.2/1.3 only shared the constant, not the full rule). Have both consumers import and reuse this ONE schema fragment going forward, closing that duplication gap as part of this story rather than leaving a fourth divergence point.
  - [ ] Rejection message must be specific (AC 1's "specific reason") — e.g. "La contraseña debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas, números o símbolos (al menos 3 de 4 tipos)." Spanish UI copy, professional tone (UX-DR22, NFR-9), matching this screen's existing error-message convention exactly.

- [ ] Task 2: Wire the complexity rule into every existing password-set path (AC: 1)
  - [ ] `src/modules/auth/server/create-user.action.ts`: replace its own `password: z.string().min(MIN_PASSWORD_LENGTH)` with Task 1's shared schema fragment.
  - [ ] `src/modules/auth/ui/create-user-form.tsx`: replace its own `.min(MIN_PASSWORD_LENGTH, ...)` with the same shared schema fragment, so a client-side rejection surfaces the identical specific message as the server (same pattern Story 1.2's code-review follow-up already established for length — extend it to complexity).
  - [ ] `src/modules/auth/server/auth.ts`: `minPasswordLength: MIN_PASSWORD_LENGTH` in the `emailAndPassword` config stays as-is (Better Auth's own length gate) — note in a comment that this only guards a Better Auth-native sign-up/reset path, which does not exist yet in this app (user creation goes through `create-user.action.ts`'s own hand-built `Account` row, never `auth.api.signUpEmail`); it is forward-looking protection, not the active enforcement point today. Better Auth has no built-in hook for the character-class rule, so that half of AC 1 cannot be delegated to Better Auth config at all — it MUST live in the shared Zod schema from Task 1.
  - [ ] Integration test: `createUser()` rejects a 12+ character password that fails the character-class rule (e.g. all-lowercase) with a `VALIDATION_ERROR` (400) carrying the specific message; accepts a password meeting both length and complexity.

- [ ] Task 3: Schema — add lockout-tracking columns to `User` (AC: 2)
  - [ ] Add two columns to the existing `User` model in `prisma/schema.prisma`: `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime?`.
  - [ ] **This is NOT the same migration ceremony as Story 1.2's new `AuditLog` table.** `User` already has `FORCE ROW LEVEL SECURITY` and `quimia_app` already holds `GRANT SELECT, INSERT, UPDATE, DELETE ON "user"` (from `prisma/migrations/20260803061701_rls_roles/migration.sql`) — adding columns to an already-RLS'd, already-granted table needs no new policy, no new grant, no hand-written RLS block. A normal `prisma migrate dev` (schema-owner/migration role) generating a plain `ALTER TABLE "user" ADD COLUMN ...` is sufficient. Do not duplicate Story 1.2's RLS/grant ceremony here — that ceremony is only needed for a genuinely NEW tenant-owned table, which this is not.
  - [ ] Confirm via `prisma migrate diff`/a quick read of the generated SQL that no RLS/grant statements were silently dropped or altered — just verify, don't add anything.

- [ ] Task 4: Define the lockout policy centrally (AC: 2) — new file, e.g. `src/modules/auth/server/account-lockout.ts`
  - [ ] Named constants, same pattern as `MIN_PASSWORD_LENGTH`: `MAX_FAILED_LOGIN_ATTEMPTS` and `LOCKOUT_DURATION_MINUTES` — epics.md calls this "a configurable threshold"; in this codebase "configurable" has so far meant "one centralized named constant" (Better Auth's own `minPasswordLength: MIN_PASSWORD_LENGTH` precedent), not an env var — no other policy threshold in this project is env-configurable today (`src/shared/config/env.ts` has no precedent for this). Follow that same convention.
  - [ ] **Confirmed 2026-08-17 (product decision):** `MAX_FAILED_LOGIN_ATTEMPTS = 5`, `LOCKOUT_DURATION_MINUTES = 15`.
  - [ ] This file does not need the zero-import constraint `password-policy.ts` has (lockout state is server-only, never read in a client component) — but keep it small and focused regardless.

- [ ] Task 5: Track failed attempts and lock the account in `sign-in.action.ts` (AC: 2) — `src/modules/auth/server/sign-in.action.ts` (MODIFIED — read this file completely before touching it; it already has careful timing-safe anti-enumeration logic from Story 1.1 that must not regress)
  - [ ] **Read `resolveIdentifierToEmail` closely.** It currently `findFirst`s the `user` row by email/nickname and selects only `email`. Extend it (or add a sibling lookup in the same scoped `transaction({tenantId, role: "anonymous"}, ...)` call) to also select `id`, `isActive`, `failedLoginAttempts`, `lockedUntil`, and to join/independently fetch the matching `Account` row's `password` hash (`providerId: "credential"`) — this is the same `user`/`account` shape `create-user.action.ts` already writes and `signIn()` already imports `verifyPassword` for (its own dummy-hash trick).
  - [ ] **Recommended approach (do not rely on message-sniffing Better Auth's internal APIError — see Dev Notes for why that's fragile):** once a real user row is resolved, BEFORE calling `auth.api.signInEmail`:
    1. If `lockedUntil` is set and still in the future: still run the existing dummy-verify timing guard, then return the SAME generic `genericFailure()` used everywhere else in this file — do **not** invent a distinct "account locked" message (see the architectural constraint below).
    2. Otherwise, verify the submitted password directly against the resolved `Account.password` hash using `verifyPassword` (already imported in this file for the dummy-hash case) — this is the SAME primitive Better Auth's own `signInEmail` will use internally, so there is no behavioral divergence, just an earlier, explicit checkpoint this story can act on.
    3. If verification fails: increment `failedLoginAttempts` by 1 in the same scoped transaction. If the NEW count reaches `MAX_FAILED_LOGIN_ATTEMPTS`, also set `lockedUntil = now + LOCKOUT_DURATION_MINUTES` and write ONE `AuditLog` row (`entity: "User"`, `entityId: user.id`, `action: "USER_ACCOUNT_LOCKED"`, `actorUserId: user.id` — there is no "acting admin" here, the account locks itself) via the shared `writeAuditLog` wrapper (AD-10's single write path — do not hand-roll a second insert). Return `genericFailure()` regardless of whether this attempt crossed the threshold or not — same message either way.
    4. If verification succeeds: reset `failedLoginAttempts = 0` and `lockedUntil = null` in the same transaction (a successful login clears the counter), then proceed to call `auth.api.signInEmail` exactly as today (this still goes through Better Auth's own `databaseHooks.session.create.before` `isActive` re-check, unchanged).
  - [ ] **Do NOT count a deactivated (`isActive: false`) user's sign-in attempt toward the lockout threshold.** Deactivation (Story 1.2) is already a stronger, permanent block; conflating it with brute-force lockout risks a confusing "why is this account locked AND deactivated" state and isn't what AC 2 is describing ("repeated failed sign-in attempts" means wrong-password guessing, not a known-deactivated account being hit). Check `isActive` before the password-verify step in the new logic above; an inactive user always returns the generic failure without touching the lockout counters, same as it does today via the existing `databaseHooks` path.
  - [ ] Unknown identifier / unknown tenant continue to go through the existing dummy-verify branch UNCHANGED — there is no real `User` row to update in either case, so nothing about this story touches that code path.

- [ ] Task 6: Lockout integration tests (AC: 2) — extend `tests/integration/auth-sign-in.test.ts` (existing file from Story 1.1, or a new sibling file if that one is getting large — dev's call)
  - [ ] Real ephemeral Neon branch (project convention — never a mocked client for anything touching session/credential behavior).
  - [ ] `MAX_FAILED_LOGIN_ATTEMPTS` consecutive wrong-password attempts against one seeded user → the account's `lockedUntil` is set, exactly one `AuditLog` row with `action: "USER_ACCOUNT_LOCKED"` exists, and the response is `genericFailure()` — byte-identical shape to every other failure case in this file (assert this explicitly, to guard against a future regression reintroducing a distinct lockout message).
  - [ ] A subsequent sign-in attempt with the CORRECT password while still locked is still rejected with the same generic failure (the lock, not the password, is what's blocking).
  - [ ] A successful sign-in resets `failedLoginAttempts` back to 0 for a user who had some (but not all) failed attempts recorded.
  - [ ] A deactivated user's failed sign-in attempts do NOT increment `failedLoginAttempts` (Task 5's isActive-before-lockout ordering).
  - [ ] Fewer-than-threshold failed attempts do not set `lockedUntil` and do not write an `AuditLog` row (only the crossing itself is audited, not every failed attempt below threshold — matches AC 2's literal wording, "when a configurable threshold is crossed").

## Dev Notes

### The single architectural rule this story must not violate: lockout must stay INSIDE the existing anti-enumeration envelope

Story 1.1 (AC-4) deliberately made wrong-password, unknown-identifier, inactive-user, and unknown/inactive-tenant all resolve to the exact same `AUTH_INVALID_CREDENTIALS` generic message, with a timing-safe dummy-hash verify for the no-real-user cases specifically so an attacker cannot distinguish "this account doesn't exist" from "this account exists but you got something wrong." **A distinct "your account is temporarily locked, try again in N minutes" message would reopen exactly the oracle Story 1.1 closed** — it tells an attacker the account exists AND that their guesses are landing close enough to trigger a defensive control, which is itself useful reconnaissance. epics.md's AC 2 says the lockout event must be *audit-logged*, not that the *user* must be told why they're blocked. Keep the external response identical to every other failure in `sign-in.action.ts` (`genericFailure()`); do all lockout-specific signaling only in the `AuditLog` row, which only an Admin can ever see (Epic 11's audit viewer, FR-53). If this tradeoff needs revisiting (e.g., product wants a user-visible "too many attempts" message), that's a product decision to raise explicitly, not something to default into silently.

### Why manual pre-verification is recommended over catching Better Auth's own APIError

`sign-in.action.ts`'s existing `catch` block around `auth.api.signInEmail` already funnels TWO distinct internal failures — Better Auth's own wrong-password rejection, and this app's own `databaseHooks.session.create.before` inactive-user rejection (which throws only AFTER the password already matched) — into the same generic response, by design (Story 1.1's AC-4). That's correct for the EXTERNAL response. But this story's lockout counter needs to know INTERNALLY which of those two happened (an inactive user with a correct password must NOT count as a failed-password attempt — see Task 5). Distinguishing them after the fact would mean pattern-matching on `error.message`/`error.code` between Better Auth's own internal wrong-password error and this app's own `AUTH_INVALID_CREDENTIALS`-shaped hook error — fragile, and liable to silently break on a Better Auth version bump that changes its internal error copy. Verifying the password directly (via `verifyPassword`, already imported in this file, against the `Account.password` hash already fetched) BEFORE calling `signInEmail` gives an unambiguous, explicit signal with no string-matching, at the cost of one extra scrypt verify on the login path (negligible — this is not a hot loop).

### AC 1's "specific reason" vs. sign-in's generic message are NOT in tension

These are two different surfaces with two different, already-established conventions: password-creation validation errors (Story 1.2's Zod `fieldErrors` pattern in `create-user-form.tsx`) are always specific and field-scoped — that convention is unchanged and this story's complexity rule slots into it exactly like the existing length check does. Sign-in failures (Story 1.1's AC-4) are always generic — also unchanged, see above. Do not let AC 1's "specific reason" wording tempt you into making sign-in-time lockout messaging specific too; they are different ACs governing different screens.

### Open spec gap: exact complexity rule and lockout threshold/duration are not pinned by any project document

Checked directly: neither `prd.md`'s NFR-2 (`"password complexity are mandatory system behaviors, not options"`) nor `ARCHITECTURE-SPINE.md`'s AD-8 (`"Better Auth's password policy is configured once, centrally... no module re-implements"`) nor epics.md's Story 1.4 text specify which character classes or how many are required, nor the exact failed-attempt threshold/lockout duration. Web research (2026-08-17) into NOM-024-SSA3-2012's own public summaries confirms the norm requires *that* RBAC/audit/backup/password-complexity controls exist, but published Spanish-language summaries do not surface a specific numeric/character-class rule (the norm's own DOF text would need direct review for that level of technical specificity, which is outside a story-creation research pass). Treat this story's suggested defaults (3-of-4 character classes on top of the existing 12-char minimum; 5 attempts / 15-minute lockout) as reasonable, OWASP-ASVS-aligned placeholders to ship absent other guidance — not as values discovered in this project's own source-of-truth documents. Flagged as an open question below.

### `MIN_PASSWORD_LENGTH` / `password-policy.ts` already exist — read them before writing anything

`src/modules/auth/server/password-policy.ts` currently exports only `MIN_PASSWORD_LENGTH = 12`, with a header comment explicitly reserving this file for exactly this kind of centralization ("Kept in its own file with ZERO other imports... so both Better Auth's own config and any other consumer read THIS value instead of hardcoding a second, possibly-divergent length check"). This story extends that same file/pattern for complexity — it does not need a parallel file. Verified current consumers: `auth.ts` (`minPasswordLength`), `create-user.action.ts` (Zod `.min()`), `create-user-form.tsx` (client Zod `.min()`). All three need to move to the new shared schema fragment from Task 1.

### No password-reset feature exists anywhere in this codebase or the PRD's FR inventory

Confirmed by direct search across `prd.md`, `epics.md`, and `src/modules/auth/`: there is no `resetPassword`/`sendResetPassword`/`onPasswordReset` Better Auth config, no forgot-password action, no change-password UI. `FR-1` through `FR-53` (the full Phase 1 FR list) contains no self-service password-reset requirement. AC 1's "or resets their password" clause is forward-looking wording carried over from the epic's own phrasing, not a request to build that feature now. Centralizing the complexity rule in `password-policy.ts` (Task 1) is what makes this safe to defer — whichever future story eventually builds password reset/change will import the same shared schema fragment and get complexity enforcement for free, with zero risk of it inventing a second, divergent rule (the exact AD-8 failure mode this project has guarded against twice already, per Stories 1.2/1.3).

### RLS/migration guidance — do not over-build this

Unlike Story 1.2's `AuditLog` table (a genuinely new tenant-owned table needing its own `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy + explicit `GRANT`), this story only adds two columns to the ALREADY fully-RLS'd, already-granted `User` table (`prisma/migrations/20260803061701_rls_roles/migration.sql` already grants `quimia_app` full `SELECT, INSERT, UPDATE, DELETE` on `"user"`). A plain Prisma-generated migration is correct and sufficient — do not hand-write a second RLS/grant block for columns on a table that already has both.

### `AuditLog.actorUserId` for a self-triggered lockout

Every other `AuditLog` write in this codebase (Stories 1.2/1.3) has a real acting admin (`actor.userId` from `getCurrentActor()`/`requireAdmin()`). A lockout event has no acting admin — the account is locking itself out from an unauthenticated sign-in attempt. Use the locked-out user's own `id` as `actorUserId` (there is no better candidate; this is consistent with how the schema models "who this action is about" when there's no separate actor). Do not invent a new nullable `actorUserId` just for this one case — that would ripple into every other query/report that assumes `actorUserId` is always populated.

### Source tree placement

```
src/
  modules/
    auth/
      server/
        password-policy.ts       # MODIFIED (Task 1) — add complexity rule + shared Zod schema fragment
        account-lockout.ts       # NEW (Task 4) — MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES
        sign-in.action.ts        # MODIFIED (Task 5) — pre-verify password, track/check lockout state
        create-user.action.ts    # MODIFIED (Task 2) — use shared password schema fragment
      ui/
        create-user-form.tsx     # MODIFIED (Task 2) — use shared password schema fragment
prisma/
  schema.prisma                  # MODIFIED (Task 3) — User.failedLoginAttempts, User.lockedUntil
  migrations/
    <timestamp>_user_lockout_columns/migration.sql  # NEW (Task 3) — plain ALTER TABLE, Prisma-generated
```

### Testing standards (established by Stories 1.1-1.3, unchanged)

**Vitest** (`npm run test`, `npm run test:integration`), **Playwright** (`npm run test:e2e`). Any test touching session/credential/RLS behavior MUST run against a real ephemeral Neon branch (`tests/setup/neon-branch-lib.ts`) — never a mocked Prisma client, per this project's `tenant-isolation` spec and every prior story's own testing notes. Strict TDD is active for this project — write each new/modified test failing-first. No e2e coverage is strictly required for this story (no new UI screen; the existing `create-user-form.tsx`/`sign-in-form.tsx` UI is unchanged in structure, only their Zod schemas change) — a couple of extended Playwright assertions in the existing `usuarios.spec.ts` (complexity-rejection message shows in the create-user form) are a reasonable nice-to-have, not mandatory.

### Consistency conventions binding this story (unchanged from Stories 1.1-1.3)

Prisma fields camelCase (`failedLoginAttempts`, `lockedUntil`), IDs = cuid2 (unaffected — no new model). API errors stay the single `{ error: { code, message, details? } }` envelope (`src/shared/http/errors.ts`). Spanish UI copy, professional tone (UX-DR22, NFR-9) for the new complexity rejection message. `writeAuditLog` is the ONLY audit-insert path (AD-10) — do not hand-roll a second insert for the lockout event.

### Project Structure Notes

- No new modules or top-level directories — this story stays entirely inside `src/modules/auth/` plus one schema/migration change, consistent with every prior Epic 1 story.
- Do not create files for other modules — same "create only what's needed" principle Stories 1.1-1.3 all followed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation, Story 1.4] — story text, acceptance criteria
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#FR-4] — "Password policy and account controls comply with NOM-024-SSA3 (complexity, no shared accounts)"
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#NFR-2] — "RBAC, full audit traceability, periodic backups, password complexity are mandatory, not optional"
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#Regulatory Compliance Matrix] — NOM-024-SSA3-2012 → NFR-2 mapping
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-8] — Better Auth sole session/role/password-policy provider; "no module re-implements password-policy checks"
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-2] — RLS/`FORCE ROW LEVEL SECURITY` pattern (already applied to `User`, not re-applied here)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-10] — audit-log single write path, reused for the lockout event
- [Source: _bmad-output/implementation-artifacts/1-1-user-sign-in.md] — AC-4 anti-enumeration design (`AUTH_INVALID_CREDENTIALS`, dummy-hash timing guard) — the invariant this story must preserve
- [Source: _bmad-output/implementation-artifacts/1-2-admin-manages-users-roles.md] — `MIN_PASSWORD_LENGTH` extraction, `writeAuditLog` wrapper, Review Findings item "No forced password reset / 'must change password' flag on admin-created accounts — deferred, out of scope" (still out of scope here too)
- [Source: _bmad-output/implementation-artifacts/1-3-role-based-access-control-enforced-everywhere.md] — `server-only` package precedent, client/server bundle-boundary gotchas relevant to any file `create-user-form.tsx` imports
- Direct code verification (2026-08-17): `src/modules/auth/server/{auth,password-policy,create-user.action,sign-in.action}.ts`, `src/modules/auth/ui/create-user-form.tsx`, `src/modules/auth/ui/sign-in-form.tsx`, `src/modules/auth/server/submit-sign-in.action.ts`, `prisma/schema.prisma` (`User`/`Account`/`Session`/`Verification` models), `prisma/migrations/20260803061701_rls_roles/migration.sql`, `package.json` (`better-auth: ^1.6.26`), `src/shared/config/env.ts` (confirmed no existing env-configurable policy-threshold precedent)
- Web verification (2026-08-17): [Better Auth email/password config reference](https://www.better-auth.com/docs/authentication/email-password) (confirms `minPasswordLength`/`maxPasswordLength` are the ONLY built-in password rules, no character-class hook), [Better Auth rate-limit reference](https://www.better-auth.com/docs/concepts/rate-limit) (confirms rate-limiting is per-IP, not per-account, so it cannot implement AC 2's per-account lockout), [Better Auth two-factor account-lockout PR](https://github.com/better-auth/better-auth/pull/10240) (confirms Better Auth's only built-in account-lockout mechanism is scoped to the `twoFactor` plugin, which this project does not use), general NOM-024-SSA3-2012 summaries (confirm the norm mandates RBAC/audit/backup/password-complexity controls but published summaries do not surface the exact numeric/character-class specification — see Dev Notes open question)

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
