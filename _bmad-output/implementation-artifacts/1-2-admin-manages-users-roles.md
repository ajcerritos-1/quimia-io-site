# Story 1.2: Admin Manages Users & Roles

Status: ready-for-dev

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

## Tasks / Subtasks

- [ ] Task 1: `AuditLog` schema + immutability at the Postgres level (AC: 3) — **deferred infrastructure from Story 1.1/Epic 1, not yet built; this story is where it must land per epics.md's Epic 1 overview**
  - [ ] Add `AuditLog` model to `prisma/schema.prisma` with the minimum shape AD-10 mandates: `id, tenantId, entity, entityId, action, before, after, actorUserId, createdAt`. Suggested types: `entity String`, `action String` (not an enum — action names will keep growing across every later epic; an enum here would need editing per-module), `before Json?`, `after Json?`, `actorUserId String`, `createdAt DateTime @default(now())`. cuid2 id, PascalCase model / camelCase fields (Consistency Conventions).
  - [ ] Hand-written migration (owner/migration role only, same pattern as `20260803061701_rls_roles`): `ALTER TABLE "audit_log" ENABLE/FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy identical in shape to `user`'s (tenant-owned table, AD-2).
  - [ ] In that same migration: `GRANT SELECT, INSERT ON "audit_log" TO quimia_app` — **deliberately no UPDATE/DELETE grant**. This is the actual immutability mechanism (AD-10, NFR-7): enforced by Postgres privileges, not application code that could be bypassed by a bug or a future dev.
  - [ ] Integration test (real ephemeral Neon branch — see Testing Standards below, never a mocked client) proving `quimia_app` gets a permission-denied error attempting `UPDATE`/`DELETE` on `audit_log`. This is the "demonstrably immutable" proof the Epic 1 overview requires before any other epic's stories may claim "writes to audit log" as done.

- [ ] Task 2: Audit-log write entrypoint in the wrapper (AC: 3) — `src/shared/db`
  - [ ] Add a write helper (e.g. `src/shared/db/audit.ts`, exported from `index.ts` alongside `scoped`/`transaction`/`bootstrap`/`authPrisma`) that inserts one `AuditLog` row given `(tx, entry)`. It must be callable **inside** an existing `transaction()` callback so the audit row commits in the exact same Postgres transaction as the mutation it's recording (AD-4's established pattern: "one wrapper call", not two separate operations that could diverge).
  - [ ] This is the "single write path" AD-10 requires — every later epic that writes an audit entry must reuse this same helper, not invent its own insert.

- [ ] Task 3: Session/role resolution for authenticated actions (AC: 3, 4) — `src/modules/auth` — **this story is the first authenticated action beyond sign-in itself; there is currently no helper that turns "an existing session cookie" into "a resolved tenantId + role" for a Server Action to use**
  - [ ] Build a helper (e.g. `getCurrentActor()`) that: reads the session cookie, calls `auth.api.getSession(...)` wrapped in `runWithContext({ tenant: { tenantId, role: "anonymous" }, ... })` (tenantId already resolved by middleware's `x-tenant-id` header) to fetch the session's `user` row (this is a normal scoped-mode read — the `user` RLS policy filters by `tenantId` only, not by role, so an "anonymous"-role scoped client can still read it), then re-enters `runWithContext` a second time with the **real** resolved `role` for everything that follows.
  - [ ] **Critical, not optional:** re-check `user.isActive` here too, not only at sign-in. Story 1.1's `databaseHooks.session.create.before` only rejects an inactive user at session-**creation** time (i.e. at their next sign-in) — an already-existing session for a user who gets deactivated mid-session is never re-checked anywhere else today (`cookieCache: { enabled: false }` only means the row is re-fetched fresh each time, not that anything rejects on `isActive: false`). Without this check here, AC 2's "access is denied" only half-holds: it blocks future sign-ins but a currently-logged-in deactivated user keeps working until their session naturally expires. Reject with a generic, non-informative error (consistent with AC-4's own "no hint" posture from Story 1.1) if the resolved user is inactive.
  - [ ] Build a narrow `requireAdmin()` guard on top of the above: if the resolved role isn't `admin`, throw an `AppError` (403) **and** write an `AuditLog` row recording the denied attempt (`entity: "User"`, `action: "USER_ADMIN_ACTION_DENIED"` or similar, `actorUserId` = the caller's own id) before throwing — this satisfies AC 4's "the attempt itself is logged." Keep this guard scoped to this story's own admin-only actions; do not attempt to build Story 1.3's general everywhere-RBAC framework here — Story 1.3 will very likely generalize/refactor this into a reusable `requireRole()` used by every module. Build this one in `src/modules/auth/server/` specifically so Story 1.3 has something to extend rather than something to duplicate.

- [ ] Task 4: Create user (AC: 1, 3, 4)
  - [ ] Zod-validated input: email, nickname, name, an initial password, role (`admin | recepcionista | quimico`).
  - [ ] Enforce the SAME password policy Better Auth is already configured with (`minPasswordLength: 12` in `src/modules/auth/server/auth.ts`) — do not hardcode a second, possibly-divergent length check (AD-8: "no module re-implements password-policy checks").
  - [ ] Inside one `transaction()` call (admin's own resolved tenant/role context): create the `User` row, create the matching `Account` row (`providerId: "credential"`, `accountId: <new user's id>`, `password: await hashPassword(initialPassword)` from `better-auth/crypto` — same function `sign-in.action.ts` already imports for its dummy-hash timing guard), and write the `AuditLog` row (`action: "USER_CREATED"`, `before: null`, `after:` the created user's public fields, no password/hash). Three inserts, one wrapper transaction.
  - [ ] **Do not use Better Auth's `admin` plugin** for this (see Dev Notes — it's schema-incompatible with this project's fixed `UserRole` enum and would reintroduce the same "wrong assumption" problem D7 already rejected the `username` plugin for).
  - [ ] Verify AC 1's "and can sign in": the created user must be able to sign in with the initial password via the existing `signIn()` flow unmodified — this is what proves the `Account` row shape (`providerId`/`accountId`/`password`) was built correctly.

- [ ] Task 5: Edit user role (AC: 3, 4)
  - [ ] Admin-only (via `requireAdmin()`), Zod-validated `{ userId, role }`.
  - [ ] One transaction: update `User.role`, write `AuditLog` (`action: "USER_ROLE_CHANGED"`, `before`/`after` carrying the old/new role).
  - [ ] AC 3's "permissions change on their next request" is already satisfied by Story 1.1's `cookieCache: { enabled: false }` (the user row, including `role`, is re-read fresh every request) — confirm this holds rather than building a second mechanism (e.g. forced session invalidation) to achieve the same thing.

- [ ] Task 6: Deactivate user (AC: 2, 3, 4, 5)
  - [ ] **Self-deactivation guard (AC 5):** if `targetUserId === actor.userId` (the resolved actor from Task 3's `getCurrentActor()`), reject with an `AppError` before touching the database — do not let an admin deactivate their own account, ever, regardless of how many other admins exist.
  - [ ] Admin-only, one `transaction()` call: set `User.isActive = false`, **delete all of that user's `Session` rows** (`tx.session.deleteMany({ where: { userId: targetUserId } })` — active revocation, not a passive next-request check), and write `AuditLog` (`action: "USER_DEACTIVATED"`). All three in the same transaction as every other task's writes.
  - [ ] Confirms AC 2 three ways: (a) the deactivated user's next sign-in attempt is blocked by Story 1.1's existing `databaseHooks.session.create.before` check (already built — do not duplicate it), (b) this task's session deletion immediately kills any session they're using right now, and (c) Task 3's `isActive` re-check remains as defense-in-depth for any future authenticated path that doesn't go through this exact deactivation flow.

- [ ] Task 7: Minimal admin UI — Usuarios (AC: 1, 2, 3)
  - [ ] A directly-navigable route (e.g. `src/app/usuarios/page.tsx`) listing users (name, nickname/email, role, active/inactive) with create/edit-role/deactivate actions, gated by `requireAdmin()` at the page/action level.
  - [ ] **Do not build sidebar/topbar navigation for this** — the app shell is Story 1.5's scope; this page just needs to exist and be reachable by URL for now. Story 1.5 will wire it into the shell later.
  - [ ] Spanish-language UI copy, professional tone (UX-DR22, NFR-9) — same as every other Phase 1 screen.
  - [ ] Follow `src/modules/auth/ui/sign-in-form.tsx`'s existing component conventions (shadcn/ui + Tailwind v4) for consistency.

- [ ] Task 8: RBAC-denial test coverage (AC: 4)
  - [ ] Integration test: a `recepcionista`/`quimico`-role session calls the create/edit-role/deactivate server actions directly (bypassing the UI entirely, simulating a "direct API call") → rejected with a 403 `AppError`, and one `AuditLog` row is written recording the denied attempt.

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

_To be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
