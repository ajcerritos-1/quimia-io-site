# Story 1.2: Admin Manages Users & Roles

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated 2026-08-16 via bmad-create-story, following Story 1.1's pattern (dev execution likely runs via the project's SDD process, not bmad-dev-story — see Story 1.1's file for that precedent). -->

## Story

As an Admin,
I want to create, edit, and deactivate users and assign one of the predefined roles (admin, recepcionista, químico),
so that I control who can access the system and what they can do.

## Acceptance Criteria

1. Given I am an Admin, when I create a new user with a role, then the user is created tenant-scoped with that role and can sign in. [Source: epics.md#Story 1.2]
2. Given I deactivate a user, when they attempt to sign in, then access is denied; and any of that user's currently active sessions are revoked immediately, not merely left to fail on their next request. [Source: epics.md#Story 1.2 — session revocation scope decided 2026-08-16]
3. Given I edit a user's role, when I save, then their permissions change on their next request, and every one of these actions (create/edit/deactivate) writes an `AuditLog` row (actor, timestamp, before/after) through the shared wrapper's single write path — the first end-to-end demonstration of the audit infrastructure in the project. [Source: epics.md#Story 1.2, ARCHITECTURE-SPINE.md#AD-10]
4. Given a non-Admin attempts any of these actions (create/edit/deactivate) via direct API call, when the request arrives, then it is rejected and the attempt itself is logged. [Source: epics.md#Story 1.2, PRD FR-3]
5. Given I am an Admin, when I attempt to deactivate my own account, then the action is rejected — an admin can never lock themselves (and potentially every admin) out. [Source: product decision 2026-08-16]
6. Given I am an Admin, when I attempt to change my own role, then the action is rejected — same rule as AC 5, for the same reason. [Source: product decision 2026-08-16, code review follow-up]
7. Given I am an Admin, when I reactivate a previously-deactivated user, then that user can sign in again, and the action writes an `AuditLog` row. [Source: product decision 2026-08-16, code review follow-up]

## Tasks / Subtasks

- [x] Task 1: `AuditLog` schema + immutability at the Postgres level (AC: 3) — **deferred infrastructure from Story 1.1/Epic 1, not yet built; this story is where it must land per epics.md's Epic 1 overview**
  - [x] Add `AuditLog` model to `prisma/schema.prisma` with the minimum shape AD-10 mandates: `id, tenantId, entity, entityId, action, before, after, actorUserId, createdAt`. Suggested types: `entity String`, `action String` (not an enum — action names will keep growing across every later epic; an enum here would need editing per-module), `before Json?`, `after Json?`, `actorUserId String`, `createdAt DateTime @default(now())`. cuid2 id, PascalCase model / camelCase fields (Consistency Conventions).
  - [x] Hand-written migration (owner/migration role only, same pattern as `20260803061701_rls_roles`): `ALTER TABLE "audit_log" ENABLE/FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy identical in shape to `user`'s (tenant-owned table, AD-2).
  - [x] In that same migration: `GRANT SELECT, INSERT ON "audit_log" TO quimia_app` — **deliberately no UPDATE/DELETE grant**. This is the actual immutability mechanism (AD-10, NFR-7): enforced by Postgres privileges, not application code that could be bypassed by a bug or a future dev.
  - [x] Integration test (real ephemeral Neon branch — see Testing Standards below, never a mocked client) proving `quimia_app` gets a permission-denied error attempting `UPDATE`/`DELETE` on `audit_log`. This is the "demonstrably immutable" proof the Epic 1 overview requires before any other epic's stories may claim "writes to audit log" as done.

- [x] Task 2: Audit-log write entrypoint in the wrapper (AC: 3) — `src/shared/db`
  - [x] Add a write helper (e.g. `src/shared/db/audit.ts`, exported from `index.ts` alongside `scoped`/`transaction`/`bootstrap`/`authPrisma`) that inserts one `AuditLog` row given `(tx, entry)`. It must be callable **inside** an existing `transaction()` callback so the audit row commits in the exact same Postgres transaction as the mutation it's recording (AD-4's established pattern: "one wrapper call", not two separate operations that could diverge).
  - [x] This is the "single write path" AD-10 requires — every later epic that writes an audit entry must reuse this same helper, not invent its own insert.

- [x] Task 3: Session/role resolution for authenticated actions (AC: 3, 4) — `src/modules/auth` — **this story is the first authenticated action beyond sign-in itself; there is currently no helper that turns "an existing session cookie" into "a resolved tenantId + role" for a Server Action to use**
  - [x] Build a helper (e.g. `getCurrentActor()`) that: reads the session cookie, calls `auth.api.getSession(...)` wrapped in `runWithContext({ tenant: { tenantId, role: "anonymous" }, ... })` (tenantId already resolved by middleware's `x-tenant-id` header) to fetch the session's `user` row (this is a normal scoped-mode read — the `user` RLS policy filters by `tenantId` only, not by role, so an "anonymous"-role scoped client can still read it), then re-enters `runWithContext` a second time with the **real** resolved `role` for everything that follows.
  - [x] **Critical, not optional:** re-check `user.isActive` here too, not only at sign-in. Story 1.1's `databaseHooks.session.create.before` only rejects an inactive user at session-**creation** time (i.e. at their next sign-in) — an already-existing session for a user who gets deactivated mid-session is never re-checked anywhere else today (`cookieCache: { enabled: false }` only means the row is re-fetched fresh each time, not that anything rejects on `isActive: false`). Without this check here, AC 2's "access is denied" only half-holds: it blocks future sign-ins but a currently-logged-in deactivated user keeps working until their session naturally expires. Reject with a generic, non-informative error (consistent with AC-4's own "no hint" posture from Story 1.1) if the resolved user is inactive.
  - [x] Build a narrow `requireAdmin()` guard on top of the above: if the resolved role isn't `admin`, throw an `AppError` (403) **and** write an `AuditLog` row recording the denied attempt (`entity: "User"`, `action: "USER_ADMIN_ACTION_DENIED"` or similar, `actorUserId` = the caller's own id) before throwing — this satisfies AC 4's "the attempt itself is logged." Keep this guard scoped to this story's own admin-only actions; do not attempt to build Story 1.3's general everywhere-RBAC framework here — Story 1.3 will very likely generalize/refactor this into a reusable `requireRole()` used by every module. Build this one in `src/modules/auth/server/` specifically so Story 1.3 has something to extend rather than something to duplicate.

- [x] Task 4: Create user (AC: 1, 3, 4)
  - [x] Zod-validated input: email, nickname, name, an initial password, role (`admin | recepcionista | quimico`).
  - [x] Enforce the SAME password policy Better Auth is already configured with (`minPasswordLength: 12` in `src/modules/auth/server/auth.ts`) — do not hardcode a second, possibly-divergent length check (AD-8: "no module re-implements password-policy checks").
  - [x] Inside one `transaction()` call (admin's own resolved tenant/role context): create the `User` row, create the matching `Account` row (`providerId: "credential"`, `accountId: <new user's id>`, `password: await hashPassword(initialPassword)` from `better-auth/crypto` — same function `sign-in.action.ts` already imports for its dummy-hash timing guard), and write the `AuditLog` row (`action: "USER_CREATED"`, `before: null`, `after:` the created user's public fields, no password/hash). Three inserts, one wrapper transaction.
  - [x] **Do not use Better Auth's `admin` plugin** for this (see Dev Notes — it's schema-incompatible with this project's fixed `UserRole` enum and would reintroduce the same "wrong assumption" problem D7 already rejected the `username` plugin for).
  - [x] Verify AC 1's "and can sign in": the created user must be able to sign in with the initial password via the existing `signIn()` flow unmodified — this is what proves the `Account` row shape (`providerId`/`accountId`/`password`) was built correctly.

- [x] Task 5: Edit user role (AC: 3, 4, 6)
  - [x] Admin-only (via `requireAdmin()`), Zod-validated `{ userId, role }`.
  - [x] One transaction: update `User.role`, write `AuditLog` (`action: "USER_ROLE_CHANGED"`, `before`/`after` carrying the old/new role).
  - [x] AC 3's "permissions change on their next request" is already satisfied by Story 1.1's `cookieCache: { enabled: false }` (the user row, including `role`, is re-read fresh every request) — confirm this holds rather than building a second mechanism (e.g. forced session invalidation) to achieve the same thing.
  - [x] **Self-role-change guard (AC 6, code review follow-up 2026-08-16):** if `targetUserId === actor.userId`, reject with an `AppError` (e.g. `SELF_ROLE_CHANGE_FORBIDDEN`, 403) before touching the database — same pattern and same placement as Task 6's self-deactivation guard. An admin can never change their own role, regardless of how many other admins exist.

- [x] Task 6: Deactivate user (AC: 2, 3, 4, 5)
  - [x] **Self-deactivation guard (AC 5):** if `targetUserId === actor.userId` (the resolved actor from Task 3's `getCurrentActor()`), reject with an `AppError` before touching the database — do not let an admin deactivate their own account, ever, regardless of how many other admins exist.
  - [x] Admin-only, one `transaction()` call: set `User.isActive = false`, **delete all of that user's `Session` rows** (`tx.session.deleteMany({ where: { userId: targetUserId } })` — active revocation, not a passive next-request check), and write `AuditLog` (`action: "USER_DEACTIVATED"`). All three in the same transaction as every other task's writes.
  - [x] Confirms AC 2 three ways: (a) the deactivated user's next sign-in attempt is blocked by Story 1.1's existing `databaseHooks.session.create.before` check (already built — do not duplicate it), (b) this task's session deletion immediately kills any session they're using right now, and (c) Task 3's `isActive` re-check remains as defense-in-depth for any future authenticated path that doesn't go through this exact deactivation flow.

- [x] Task 7: Minimal admin UI — Usuarios (AC: 1, 2, 3)
  - [x] A directly-navigable route (e.g. `src/app/usuarios/page.tsx`) listing users (name, nickname/email, role, active/inactive) with create/edit-role/deactivate actions, gated by `requireAdmin()` at the page/action level.
  - [x] **Do not build sidebar/topbar navigation for this** — the app shell is Story 1.5's scope; this page just needs to exist and be reachable by URL for now. Story 1.5 will wire it into the shell later.
  - [x] Spanish-language UI copy, professional tone (UX-DR22, NFR-9) — same as every other Phase 1 screen.
  - [x] Follow `src/modules/auth/ui/sign-in-form.tsx`'s existing component conventions (shadcn/ui + Tailwind v4) for consistency.

- [x] Task 8: RBAC-denial test coverage (AC: 4)
  - [x] Integration test: a `recepcionista`/`quimico`-role session calls the create/edit-role/deactivate server actions directly (bypassing the UI entirely, simulating a "direct API call") → rejected with a 403 `AppError`, and one `AuditLog` row is written recording the denied attempt.
  - [x] **Extend to `reactivateUser` (code review follow-up 2026-08-16):** same denial coverage for the new Task 9 action.

- [x] Task 9: Reactivate user (AC: 7, code review follow-up 2026-08-16)
  - [x] Admin-only (via `requireAdmin()`), Zod-validated `{ userId }`. No self-check needed — `getCurrentActor()`'s `isActive` re-check already makes it impossible for a deactivated actor to call any admin action, so self-reactivation can never arise.
  - [x] One transaction: set `User.isActive = true`, write `AuditLog` (`action: "USER_REACTIVATED"`, `before: { isActive: false }`, `after: { isActive: true }`). Mirrors Task 6's `deactivateUser` structure exactly, inverted.
  - [x] UI: add a "Reactivar" action in `users-table.tsx`, shown only when `!user.isActive` (mirrors the existing "Desactivar" button, shown only when `user.isActive`).

### Review Findings

- [x] [Review][Decision→Patch] Self-role-change guard — resolved 2026-08-16: block admin self-role-edit entirely (same rule as self-deactivation). See AC 6, Task 5.
- [x] [Review][Decision→Patch] Reactivate-user action — resolved 2026-08-16: add it now, in this story. See AC 7, Task 9.
- [x] [Review][Patch] `createUser` doesn't catch a duplicate email/nickname unique-constraint violation — crashes with a raw unhandled Prisma error instead of a friendly 409 [src/modules/auth/server/create-user.action.ts]
- [x] [Review][Patch] `USER_ADMIN_ACTION_DENIED` audit rows don't record which action was attempted or against which target [src/modules/auth/server/require-admin.ts]
- [x] [Review][Patch] No-op deactivate/role-edit still writes a misleading before==after `AuditLog` transition [src/modules/auth/server/deactivate-user.action.ts, update-user-role.action.ts]
- [x] [Review][Patch] `AuditLog` has no index on `entityId`, the column every "history of this record" query (including this story's own tests) filters by [prisma/schema.prisma, prisma/migrations/20260816231455_audit_log/migration.sql]
- [x] [Review][Patch] `UserRole` re-typed as a raw string-literal tuple in 4 places instead of deriving from the generated Prisma enum [create-user.action.ts, update-user-role.action.ts, create-user-form.tsx, users-table.tsx]
- [x] [Review][Patch] Client-side password validation doesn't enforce `MIN_PASSWORD_LENGTH`, and the server's rejection message never maps back to the password field [src/modules/auth/ui/create-user-form.tsx]
- [x] [Review][Patch] Dead `!tenantId` check in page/action files should compare against the `UNRESOLVED_TENANT` sentinel instead (middleware never sends an empty string) [src/app/usuarios/page.tsx and 3 submit-*.action.ts files]
- [x] [Review][Defer] Case-sensitive email/nickname uniqueness now human-exercised for the first time — pre-existing design from Story 1.1, not introduced here — deferred, pre-existing
- [x] [Review][Defer] Server Actions leak a clear 403 message to a non-admin caller who invokes them directly, while the page itself hides behind a 404 — inherent to how Next.js Server Actions are always independently invocable; low severity, no data disclosed — deferred, pre-existing platform characteristic
- [x] [Review][Defer] Story/Dev Notes wording overstates Postgres-level audit-log immutability — true for the `quimia_app` role (the only one on any request path), not for the owner/migration role, which is expected (schema owners always have full DDL/DML) but worth a wording clarification later — deferred, documentation-only
- [x] [Review][Defer] No forced password reset / "must change password" flag on admin-created accounts — not in this story's ACs, reasonable Phase 2 candidate — deferred, out of scope

## Dev Notes

### Critical: this story must also build Epic 1's still-missing audit-log infrastructure

Story 1.1's own tasks (re-read: Task 6 was "structured logging & error envelope" only) never created the `AuditLog` table — checked directly against the current schema (`prisma/schema.prisma`) and it genuinely doesn't exist yet. The Architecture Spine's `Deferred` section explicitly lists `AuditLog` as deferred "to each module's own SPEC→SCHEMA authoring time" [Source: ARCHITECTURE-SPINE.md#Deferred], and epics.md's Epic 1 overview is explicit that this table + its write path + the Postgres-level immutability grant must be "built and demonstrably immutable before any other epic's stories claim 'writes to audit log' as an acceptance criterion" [Source: epics.md#Epic 1]. Story 1.2's own AC 3 is the first story to need it. **Do not treat this as optional or as "someone already did it."** Task 1/2 above are not padding — they are load-bearing for this story's own ACs and for every later epic (2.4, 3.3, 6.2, 6.6, 7.4, etc. all assume this already works).

### Do not adopt Better Auth's `admin` plugin

Verified via web research (2026-08-16): Better Auth's `admin` plugin manages its own `role` field as a **free string column** (with an optional access-control/statement system for multi-role composition) and adds `banned`/`banReason`/`banExpires` fields to `User`. This directly conflicts with two decisions already locked in by Story 1.1: (1) `User.role` is a fixed 3-value Postgres/Prisma **enum**, not a free string — a Phase 1 decision made specifically to avoid building Phase 2's granular-permission RBAC early [Source: this file's previous story, 1-1-user-sign-in.md#Schema decision]; (2) deactivation already uses `User.isActive` (checked in `auth.ts`'s `databaseHooks.session.create.before`), not a competing `banned` flag. Adopting the admin plugin would mean either a schema fork or silently running two parallel "is this user allowed in" mechanisms. This is the same category of mistake AD-8/D7 already rejected once (Better Auth's `username` plugin, for reintroducing global-unique-username assumptions Story 1.1's schema had already corrected) — don't repeat it here. Build user CRUD as plain scoped-wrapper calls instead (Tasks 4–6 above), using only Better Auth's low-level `hashPassword`/`verifyPassword` primitives (`better-auth/crypto`) that `sign-in.action.ts` already imports.

Confirmed via web research: Better Auth's email/password `Account` row shape is `providerId: "credential"`, `accountId` = the user's own id, `password` = the scrypt hash. Use exactly this shape when hand-creating the `Account` row in Task 4 — a wrong `providerId`/`accountId` here would silently break sign-in for every admin-created user, and there is no existing code path exercising this yet to catch the mistake other than the sign-in-after-create check in Task 4's last subtask.

### Role enum spelling: `quimico`, not `químico`

The Prisma enum (`prisma/schema.prisma`) is `admin | recepcionista | quimico` — no accent (Postgres enum/TS identifiers can't carry one). The Spanish accented spelling ("químico") is UI-copy-only, never a code identifier. Story 1.1 already made this call; Story 1.2 just needs to not accidentally reintroduce the accented form anywhere in code.

### RLS does not enforce role — authorization here is purely application-layer

The existing `tenant_isolation` policy on `user` (`prisma/migrations/20260803061701_rls_roles/migration.sql`) filters only on `"tenantId" = current_setting('app.tenant_id')` — it does **not** reference `current_setting('app.role')` anywhere, even though the wrapper's `scoped()` mode always sets both. This means Postgres RLS today enforces tenant isolation only; **no RLS policy currently blocks a non-admin from writing to `user`.** All of this story's admin-only enforcement (Task 3's `requireAdmin()`) is therefore pure application code — get that guard right, because the database will not save you here. (This may change in a later epic if role-scoped RLS policies get added, but that is not this story's job.)

### Product decisions confirmed 2026-08-16 (were open questions during story creation)

- **Active session revocation on deactivation:** deactivating a user deletes their `Session` rows immediately (Task 6), not just relying on the next-request `isActive` check. `Session` (`prisma/schema.prisma`) has `userId` + `tenantId` columns and is already a tenant-owned, wrapper-only table — `tx.session.deleteMany({ where: { userId } })` inside the same transaction as the `isActive` update is all this needs; no Better Auth admin-API call required.
- **No self-deactivation:** an admin can never deactivate their own account (AC 5, Task 6) — a deliberate product rule to prevent an admin (or every admin, tenant-wide) from locking themselves out. This does not extend to self role-edits in this story; that's a separate, un-scoped concern if it comes up later.
- **Deactivation, not deletion, stays the only mechanism:** confirmed — no hard-delete action for users in this story. Matches PRD FR-52's "deletion" audit-event language loosely (deactivation is the practical equivalent here), and avoids FK/cascade-delete hazards: `AuditLog.actorUserId` and every other table that will eventually reference `User` needs that row to keep existing so historical records stay resolvable. Do not add a delete action to Task 6 or anywhere else in this story.

### Session/role resolution is new — there is no existing "who is signed in" helper

Every piece of code that exists today either runs with `role: "anonymous"` (middleware, sign-in's own pre-auth lookups) or is Better Auth's own internal session-creation hook. Nothing yet turns "an incoming request with a session cookie" into "a resolved `{tenantId, userId, role}` for a Server Action to act as." Task 3 is genuinely new ground, not a copy of an existing pattern — read `src/modules/auth/server/auth.ts`'s `databaseHooks.session.create.before` closely before writing it, since it's the only existing example of resolving a session's user under `runWithContext`, and reuses `scoped()` directly (not `authPrisma`) for exactly the same reason: you don't have a role yet to hand the ambient proxy.

### Source tree placement

```
src/
  modules/
    auth/
      server/
        auth.ts                  # existing — Better Auth config, do not duplicate isActive-at-signin check
        sign-in.action.ts         # existing — reference for runWithContext + hashPassword/verifyPassword usage
        submit-sign-in.action.ts  # existing
        get-current-actor.ts      # NEW (Task 3) — session -> {tenantId, userId, role}, isActive re-check
        require-admin.ts          # NEW (Task 3) — admin-only guard + denied-attempt audit log
        create-user.action.ts     # NEW (Task 4)
        update-user-role.action.ts # NEW (Task 5)
        deactivate-user.action.ts # NEW (Task 6)
      ui/
        sign-in-form.tsx          # existing — component-style reference
        users-table.tsx           # NEW (Task 7)
        create-user-form.tsx      # NEW (Task 7)
  shared/
    db/
      index.ts                   # add `writeAuditLog` export (Task 2)
      audit.ts                   # NEW (Task 2)
app/
  usuarios/
    page.tsx                     # NEW (Task 7) — no sidebar/shell yet, Story 1.5's job
```

Exact file names above are suggestions, not mandates — follow whatever naming the existing `auth` module already uses if it differs once you're in the code.

### Testing standards (established by Story 1.1, unchanged)

- **Vitest** for unit/integration (`npm run test`, `npm run test:integration`), **Playwright** for e2e (`npm run test:e2e`) — both already wired up (`vitest.config.ts`, `vitest.integration.config.ts`, `tests/e2e/`).
- Per the project's own `tenant-isolation` spec (`openspec/specs/tenant-isolation/spec.md`): **any test verifying RLS or Postgres-privilege behavior (Task 1's UPDATE/DELETE-denied test included) MUST run against a real ephemeral Neon branch** (`tests/setup/neon-branch-lib.ts`, `neon-global-setup.ts` already provide this harness) — a mocked/stubbed Prisma client is explicitly not accepted as evidence for this kind of requirement.
- Strict TDD is active for this project — write the failing test before the implementation for each task above.

### Consistency conventions binding this story (unchanged from Story 1.1)

Prisma models PascalCase singular, fields camelCase, IDs = cuid2, dates ISO-8601 UTC in DB. API errors: single envelope `{ error: { code, message, details? } }` (`src/shared/http/errors.ts` — reuse `AppError`/`toErrorResponse`, don't hand-roll a new shape). Structured JSON logging carries `tenant_id`/`request_id` on every line (`src/shared/logging/logger.ts` — already works automatically via `AsyncLocalStorage` once you're inside `runWithContext`). Zod validates every request payload — no raw, unvalidated input into a scoped-wrapper call.

### Project Structure Notes

- No conflicts with existing code — this story only adds new files under `src/modules/auth/` and `src/shared/db/`, plus one new Prisma model and one new hand-written migration. Nothing in Story 1.1's existing files needs to change except possibly a re-export in `src/shared/db/index.ts`.
- Do not create files for other modules (`patients`, `catalog`, etc.) — same "create only what's needed" principle Story 1.1 already followed.
- No sharded architecture/PRD/UX documents exist for this project; everything below is sourced from whole-document versions plus direct reads of the current `src/`/`prisma/` state (per this workflow's mandate to verify actual code, not just prose).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation, Story 1.2] — story text, acceptance criteria, and the Epic 1 overview's audit-log-infrastructure mandate
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-1] — vertical-slice module boundary (this story stays inside `src/modules/auth`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-2] — RLS/FORCE ROW LEVEL SECURITY pattern to replicate for `audit_log`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-3] — the wrapper is the only DB access path; no third mode
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-8] — Better Auth is the sole session/role provider; no re-implemented password rules
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-10] — audit-log single write path, no UPDATE/DELETE grant, minimum column shape
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#Deferred] — `AuditLog`/`User.roleId`/`Role` explicitly deferred to this story's SPEC→SCHEMA time
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#FR-2, FR-3, FR-52] — user CRUD/role assignment, RBAC enforcement, audit event catalog
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#NFR-2] — RBAC/audit traceability mandatory for NOM-024-SSA3
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-quimiaio-2026-07-10/EXPERIENCE.md#6.1, Navigation Map] — "Usuarios y Roles" admin-only sidebar entry (Phase 1: CRUD + role/branch assignment; permission matrix is Phase 2/UX-DR24)
- [Source: _bmad-output/implementation-artifacts/1-1-user-sign-in.md] — previous story: enum-vs-table decision, wrapper contract, Better Auth config, testing conventions, all verified still current against live code on 2026-08-16
- Direct code verification (2026-08-16): `prisma/schema.prisma`, `prisma/migrations/20260803061701_rls_roles/migration.sql`, `src/shared/db/*`, `src/modules/auth/server/*`, `src/middleware.ts`, `src/shared/http/errors.ts`, `src/shared/logging/logger.ts`, `src/shared/context/request-context.ts`, `openspec/specs/platform-foundation/spec.md`, `openspec/specs/tenant-isolation/spec.md`
- Web verification (2026-08-16): [Better Auth admin plugin docs](https://better-auth.com/docs/plugins/admin) (role/ban schema conflicts with this project's enum+isActive design), [Better Auth email/password Account shape](https://better-auth.com/docs/authentication/email-password) (`providerId: "credential"`, `accountId` = userId)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- No blocking failures. All required env vars (`NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) were present locally, so both `npm run test:integration` and `npm run test:e2e` ran against real ephemeral Neon branches as required by the testing standards (never mocked).
- One dead-end during Task 1 TDD: an added test asserting the schema-owner role is itself subject to `FORCE ROW LEVEL SECURITY` failed — this Neon project's owner/migration role evidently carries `BYPASSRLS` (or equivalent), which Postgres honors even under `FORCE ROW LEVEL SECURITY` (`FORCE` only matters for roles *without* that bypass). The `"user"` table has the identical `FORCE ROW LEVEL SECURITY` treatment and no equivalent test exists for it either, so this was an over-reaching test asserting something not guaranteed by this environment — removed rather than "fixed", since the actual mandated requirement (`quimia_app` gets a permission-denied error on UPDATE/DELETE) was unaffected and still passes.
- One build-time dead-end during Task 7 UI wiring: co-locating a Server Action with an inline per-function `"use server"` directive inside the same module as `createUser()`/`updateUserRole()`/`deactivateUser()` (which import `transaction`/`writeAuditLog`/the Prisma client) caused Turbopack's `next build` to fail trying to resolve Node built-ins (`tls`, `util/types`) into the CLIENT bundle — the whole module's dependency graph got pulled in rather than being tree-shaken to a server reference stub. Fixed by moving each UI-facing wrapper into its own dedicated file with a **file-level** `"use server"` directive (`submit-create-user.action.ts`, `submit-update-user-role.action.ts`, `submit-deactivate-user.action.ts`), matching this codebase's own existing `submit-sign-in.action.ts` precedent exactly. The plain, directly-testable core functions (`createUser`, `updateUserRole`, `deactivateUser`) were left untouched and un-decorated, so Task 8's direct-call RBAC tests still bypass the UI wrapper entirely, as the story requires.

### Completion Notes List

- Tasks 1-8 all complete; all Acceptance Criteria (1-5) covered by integration/e2e tests, none skipped.
- Task 1: `AuditLog` model + hand-written migration `20260816231455_audit_log` (RLS + `tenant_isolation` policy identical in shape to `"user"`'s, plus `GRANT SELECT, INSERT` only — no `UPDATE`/`DELETE` grant to `quimia_app`, the actual Postgres-level immutability mechanism). Migration applied to the shared dev database via `prisma migrate deploy`; the ephemeral per-test-run Neon branches pick it up automatically through their own `prisma migrate deploy` step in `neon-global-setup.ts`.
- Task 2: `writeAuditLog(tx, entry)` added to `src/shared/db/audit.ts`, re-exported from `src/shared/db/index.ts` — the single write path every later epic must reuse.
- Task 3: `getCurrentActor()` and `requireAdmin()` compose as higher-order functions (`(request, fn) => Promise<T>`) rather than returning a bare actor object — this was a judgment call, not explicitly dictated by the story text, made to mirror `sign-in.action.ts`'s own established `runWithContext`-wrapping style ("re-enters runWithContext a second time... for everything that follows" reads most naturally as "the caller's downstream logic runs under the resolved role context", which only works cleanly as a callback-style API). `requireAdmin()` composes on top of `getCurrentActor()` the same way.
- Task 4-6: each of create/edit-role/deactivate is a plain, directly-testable function (no `"use server"`) taking `(input, request: CurrentActorRequest)` — Zod-validated, `requireAdmin()`-gated, one `transaction()` call per action. `MIN_PASSWORD_LENGTH` was extracted as a named export from `auth.ts` (previously an inline `12` literal) so Task 4's Zod schema references the exact same value instead of a second hardcoded number (AD-8).
- Task 7: minimal `/usuarios` page, no app shell (Story 1.5's scope, explicitly out of scope here). Non-admin visitors get a 404 (not a differentiated "forbidden" message) — deliberately not revealing the route's existence to an unauthorized caller, consistent with this story's general "no hint" posture. Native `<select>` elements used for role pickers rather than building a new shadcn/Base UI `Select` wrapper (`@base-ui/react/select` is available in the already-installed `@base-ui/react` package but wiring a new compound component was judged out of scope for a "minimal" admin UI); no new dependency was added.
- Task 8: dedicated cross-cutting RBAC-denial test file covering all three actions (create/edit-role/deactivate) against both non-admin roles (`recepcionista`, `quimico`). This task's own tests passed immediately (no RED phase was possible) since `requireAdmin()` from Task 3, composed into every Task 4-6 action, already fully implements the behavior being asserted — Task 8 is a test-coverage task, not an implementation task.
- Full suite results (pre-patch): unit `29/29` pass, integration `64/64` pass across 17 files (including 6 new files added by this story), e2e `5/5` pass (including 2 new tests), `npm run lint` clean, `tsc --noEmit` clean.

### Code-review follow-up patch (2026-08-16)

Nine fixes applied from a code review of the above implementation — AC 6/7 additions followed strict TDD (failing integration test first, then minimal implementation); the other seven were mechanical/unambiguous fixes with test coverage added or extended in the story's existing test files.

1. **Self-role-change guard (AC 6, Task 5):** `update-user-role.action.ts` now throws `SELF_ROLE_CHANGE_FORBIDDEN` (403) before the transaction when `data.userId === actor.userId`, mirroring `deactivate-user.action.ts`'s self-deactivation guard exactly. Covered by a new test in `auth-update-user-role.test.ts`.
2. **Reactivate user (AC 7, Task 9):** new `reactivate-user.action.ts` mirrors `deactivate-user.action.ts` inverted (sets `isActive = true`, writes `USER_REACTIVATED`), no self-check needed (`getCurrentActor`'s isActive re-check already makes self-reactivation unreachable). New `submit-reactivate-user.action.ts` wrapper (own file, file-level `"use server"`, same Turbopack-tree-shaking reason as the other `submit-*` files). New "Reactivar" button in `users-table.tsx`, shown only when `!user.isActive`. New `tests/integration/auth-reactivate-user.test.ts` (modeled on `auth-deactivate-user.test.ts`) plus two new cases in `auth-rbac-denial.test.ts` covering `reactivateUser` denial for both non-admin roles.
3. **Duplicate email/nickname crash:** `create-user.action.ts` now catches `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` around the transaction and throws `EMAIL_OR_NICKNAME_IN_USE` (409) instead of letting the raw Prisma error propagate. New test in `auth-create-user.test.ts`.
4. **Denied-attempt audit detail:** `requireAdmin()` gained an optional third parameter, `RequireAdminOptions { attemptedAction, targetUserId? }`. The denied-attempt `AuditLog` row now sets `entityId` to the known target (falling back to the actor's own id when no target exists yet, e.g. `createUser`) and `after: { attemptedAction }`. All three (now four, including `reactivateUser`) call sites pass their own options (`USER_CREATE`, `USER_ROLE_CHANGE`, `USER_DEACTIVATE`, `USER_REACTIVATE`). Updated/extended assertions in `auth-require-admin.test.ts` and `auth-rbac-denial.test.ts`.
5. **No-op audit noise:** `update-user-role.action.ts`, `deactivate-user.action.ts`, and the new `reactivate-user.action.ts` all skip the mutation + audit write and return the existing state when the requested change matches the current state (role unchanged / already inactive / already active). New/extended tests proving no `AuditLog` row is written in each no-op case.
6. **Missing index:** added `@@index([entityId])` to the `AuditLog` model in `prisma/schema.prisma` and hand-appended the matching `CREATE INDEX "audit_log_entityId_idx"` to the not-yet-deployed `20260816231455_audit_log/migration.sql` (no second migration needed). `prisma generate`/`prisma validate` confirm schema and client stay in sync; the integration harness applies the updated migration.sql fresh to each ephemeral Neon branch.
7. **`UserRole` duplication:** `src/shared/db/index.ts` now re-exports the runtime `UserRole` const object (previously type-only) from the generated Prisma enum. `create-user.action.ts` and `update-user-role.action.ts` use `z.enum(UserRole)` instead of a hand-typed tuple. `users-table.tsx`'s `UserRow["role"]` and `ROLE_LABELS` (now exported) are typed against the real `UserRole` enum (`Record<UserRole, string>` forces exhaustiveness); `create-user-form.tsx` imports and reuses that same `ROLE_LABELS` mapping and `z.enum(UserRole)` instead of a second hardcoded option list.
8. **Client-side password validation:** `create-user-form.tsx` imports `MIN_PASSWORD_LENGTH` from `../server/auth` (same source `create-user.action.ts` already uses) for its client-side Zod schema instead of a bare `.min(1)`. `submitCreateUser` now forwards a `VALIDATION_ERROR`'s flattened Zod `fieldErrors` back to the caller, and the form maps them onto the corresponding field's own error display instead of a generic top-level banner.
9. **Dead `tenantId` check:** `src/app/usuarios/page.tsx` and all four `submit-*.action.ts` files (the pre-existing three plus the new `submit-reactivate-user.action.ts`) now compare against `UNRESOLVED_TENANT` (imported from `src/middleware.ts`) in addition to the null/empty check, since middleware always sends a non-empty header (a real tenant id or the `"unresolved"` sentinel) and the old `!tenantId` check could never actually fire.

Full suite results (post-patch): unit `29/29` pass, integration `75/75` pass across 18 files (one initial run had a single transient timeout on a Neon cold start, documented pre-existing behavior per `scoped.ts`'s own comments — re-ran in isolation and it passed), `npm run lint` clean, `tsc --noEmit` clean. `npm run test:e2e` was not re-run for this patch (not requested; no e2e coverage was required by the review findings).

### File List

**Schema / migrations:**
- `prisma/schema.prisma` (modified — added `AuditLog` model; code-review follow-up: added `@@index([entityId])`)
- `prisma/migrations/20260816231455_audit_log/migration.sql` (new — hand-written, RLS + grants appended to the auto-generated `CREATE TABLE`; code-review follow-up: appended `CREATE INDEX "audit_log_entityId_idx"`)

**Application code:**
- `src/shared/db/audit.ts` (new — `writeAuditLog`)
- `src/shared/db/index.ts` (modified — export `writeAuditLog`, `AuditLogEntry`, `UserRole`; code-review follow-up: `UserRole` now re-exports the runtime const, not just the type; also exports `isUniqueConstraintViolation`)
- `src/shared/db/errors.ts` (new, orchestrator fix post-patch — `isUniqueConstraintViolation()`. The patch agent's original P2002 fix imported `Prisma` directly from `src/generated/prisma/client` inside `create-user.action.ts`, tripping the AD-3 ESLint boundary rule (`no-restricted-imports`) that a prior story planted a test specifically to catch. Moved the Prisma-error check behind this wrapper-owned helper instead.)
- `src/modules/auth/server/auth.ts` (modified — extracted `MIN_PASSWORD_LENGTH` constant)
- `src/modules/auth/server/get-current-actor.ts` (new)
- `src/modules/auth/server/require-admin.ts` (new; code-review follow-up: optional `RequireAdminOptions` third parameter, richer denied-attempt audit detail)
- `src/modules/auth/server/create-user.action.ts` (new; code-review follow-up: P2002 duplicate-email/nickname handling, `z.enum(UserRole)`, `requireAdmin` options)
- `src/modules/auth/server/update-user-role.action.ts` (new; code-review follow-up: self-role-change guard, no-op skip, `z.enum(UserRole)`, `requireAdmin` options)
- `src/modules/auth/server/deactivate-user.action.ts` (new; code-review follow-up: no-op skip, `requireAdmin` options)
- `src/modules/auth/server/reactivate-user.action.ts` (new — code-review follow-up, Task 9)
- `src/modules/auth/server/submit-create-user.action.ts` (new — file-level `"use server"` UI wrapper; code-review follow-up: `UNRESOLVED_TENANT` check, forwards field-level validation errors)
- `src/modules/auth/server/submit-update-user-role.action.ts` (new — file-level `"use server"` UI wrapper; code-review follow-up: `UNRESOLVED_TENANT` check)
- `src/modules/auth/server/submit-deactivate-user.action.ts` (new — file-level `"use server"` UI wrapper; code-review follow-up: `UNRESOLVED_TENANT` check)
- `src/modules/auth/server/submit-reactivate-user.action.ts` (new — file-level `"use server"` UI wrapper, code-review follow-up, Task 9)
- `src/modules/auth/ui/users-table.tsx` (new; code-review follow-up: `UserRole`-derived types/`ROLE_LABELS` (now exported), "Reactivar" button)
- `src/modules/auth/ui/create-user-form.tsx` (new; code-review follow-up: `MIN_PASSWORD_LENGTH`-enforced password field, server field-error mapping, `UserRole`-derived role select)
- `src/app/usuarios/page.tsx` (new; code-review follow-up: `UNRESOLVED_TENANT` check)

**Tests:**
- `tests/integration/audit-log-immutable.test.ts` (new)
- `tests/integration/db-audit-write.test.ts` (new)
- `tests/integration/auth-get-current-actor.test.ts` (new)
- `tests/integration/auth-require-admin.test.ts` (new; code-review follow-up: richer denied-audit-detail test)
- `tests/integration/auth-create-user.test.ts` (new; code-review follow-up: duplicate-email 409 test)
- `tests/integration/auth-update-user-role.test.ts` (new; code-review follow-up: self-role-change and no-op tests)
- `tests/integration/auth-deactivate-user.test.ts` (new; code-review follow-up: no-op test)
- `tests/integration/auth-rbac-denial.test.ts` (new; code-review follow-up: `reactivateUser` denial coverage, richer-detail assertions)
- `tests/integration/auth-reactivate-user.test.ts` (new — code-review follow-up, Task 9)
- `tests/e2e/usuarios.spec.ts` (new)
- `tests/e2e/seed.ts` (modified — `seedUser` gained an optional `role` parameter, backward-compatible default `"admin"`)

## Change Log

| Date | Change |
| --- | --- |
| 2026-08-16 | Implemented Story 1.2 end-to-end (Tasks 1-8): `AuditLog` schema + Postgres-level immutability, the shared `writeAuditLog` wrapper helper, session/role resolution (`getCurrentActor`/`requireAdmin`), create/edit-role/deactivate user actions, the minimal `/usuarios` admin UI, and dedicated RBAC-denial test coverage. Status moved `ready-for-dev` → `review`. |
