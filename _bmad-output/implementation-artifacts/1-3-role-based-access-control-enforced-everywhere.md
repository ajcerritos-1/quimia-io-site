# Story 1.3: Role-Based Access Control Enforced Everywhere

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated 2026-08-17 via bmad-create-story. This is the generalization Story 1.2's `require-admin.ts` explicitly anticipated: "Story 1.3 will very likely generalize/refactor this into a reusable `requireRole()` used by every module." No other feature modules exist yet besides `auth` (Story 1.1/1.2) — this story's job is to build and prove the general-purpose mechanism, not to gate a brand-new feature. Dev execution likely runs via the project's SDD process (see 1-1's precedent), or via bmad-dev-story — either is fine, this file is self-contained either way. -->

## Story

As any authenticated user,
I want every screen and API endpoint to enforce my role's permissions,
so that I can never see or do something outside my role, whether through the UI or by hitting an API directly.

## Acceptance Criteria

1. Given a Server Action or Route Handler needs to restrict access to one or more specific roles, when it is implemented, then it composes the single shared `requireRole(request, allowedRoles, fn, options)` guard from `src/modules/auth/server/require-role.ts` — no module hand-rolls its own role comparison or its own denial-audit write. [Source: epics.md#Story 1.3; 1-2-admin-manages-users-roles.md `require-admin.ts` header comment — this is the generalization it names]

2. Given a caller's role is not in the action's allowed-roles list, when they invoke the underlying Server Action directly (bypassing the UI entirely), then the server rejects with a 403 `AppError`, independent of what the UI shows — proven for both a single-allowed-role guard (`requireAdmin`, unchanged from Story 1.2) and a genuinely multi-allowed-role guard (e.g. `["admin", "quimico"]`), since no production call site needs the latter yet and it must still be proven to work. [Source: epics.md#Story 1.3 AC2]

3. Given a role-restricted action is denied by `requireRole` (or by `requireAdmin`, which now delegates to it), when the denial occurs, then exactly one `AuditLog` row is written through the shared wrapper's single write path (AD-10) BEFORE the guard throws, recording the actor, tenant, the denial's own `action` name, the target `entity`/`entityId` when known, and the specific `attemptedAction` in `after` — generalized so any future module's `requireRole` call site gets this for free, not just the four call sites Story 1.2 already covers. [Source: epics.md#Story 1.3 AC2, PRD FR-3]

4. Given Story 1.2's four existing `requireAdmin()` call sites (`create-user.action.ts`, `update-user-role.action.ts`, `deactivate-user.action.ts`, `reactivate-user.action.ts`) and the page-level guard in `usuarios/page.tsx`, when this story ships, then none of those call sites change their call syntax, and Story 1.2's entire existing test suite (`auth-require-admin.test.ts`, `auth-rbac-denial.test.ts`, `auth-create-user.test.ts`, `auth-update-user-role.test.ts`, `auth-deactivate-user.test.ts`, `auth-reactivate-user.test.ts`, `usuarios.spec.ts`) passes unmodified — `requireAdmin()` becomes a thin wrapper over `requireRole(request, [UserRole.admin], fn, {...})`, not a parallel, duplicated implementation. [Source: this story's core mandate; AD-8's "no module re-implements" spirit applied to this guard]

5. Given a UI control whose action the current viewer is not permitted to perform, when that UI renders, then the control appears visibly disabled (native `disabled` attribute) with an adjacent, programmatically-associated (`aria-describedby`) stated reason that is visible text, not merely a `title` attribute or tooltip-only hint — never silently inert. [Source: epics.md#Story 1.3 AC1; EXPERIENCE.md Accessibility Floor — "RBAC is visible, not silent (NOM-024-SSA3/NFR-2, FR-3)"]

6. Given the Usuarios page's own self-action rules from Story 1.2 (an admin can never deactivate or change the role of their own account — AC 5/6 of that story), when the signed-in admin views their own row in `UsersTable`, then the role `<select>` and the Desactivar/Reactivar control for that row render disabled with the stated reason, using the same shared disabled-with-reason primitive AC 5 establishes — closing the gap where Story 1.2 enforced this rule only server-side (the control looked fully usable until clicked, then failed with a 403-shaped `AppError`). [Source: this story, retrofit of 1-2-admin-manages-users-roles.md AC 5/6; EXPERIENCE.md Accessibility Floor]

7. Given `requireRole()` is called with more than one allowed role, when an actor whose role IS in that list calls the guarded function, then it is allowed through for every role in the list; when an actor whose role is NOT in that list calls it, it is denied and audited exactly like the single-role case. Proven by dedicated test coverage, since today's codebase has no production call site needing more than one allowed role. [Source: epics.md#Epic 1 overview — cross-cutting infrastructure must be "built and demonstrably working," not left as an unproven abstraction]

## Tasks / Subtasks

- [x] Task 1: Extract the single, shared role-check function (AC: 1, 7) — `src/modules/auth/roles.ts` (NEW)
  - [x] `export function isRoleAllowed(role: UserRole, allowedRoles: UserRole[]): boolean { return allowedRoles.includes(role); }`
  - [x] Zero imports besides the `UserRole` type/const from `@/shared/db` (or none at all if you inline the type param) — this file must be safely importable from BOTH server code and a `"use client"` component (already precedented: `users-table.tsx` already imports `UserRole` directly from `@/shared/db` in production with no bundler issue — do not treat this as a risk requiring a workaround, just follow the existing pattern). **See Debug Log: this precedent claim was verified FALSE via a real `next build`; `roles.ts` sidesteps it with a type-only import, which is the correct pattern regardless.**
  - [x] This is the ONE place role-comparison logic lives. Both `requireRole()` (Task 2, server enforcement) and the UI disabled-state check (Task 5) must call THIS function — never re-implement `.includes()` inline in either place. This is the concrete mechanism that prevents the classic RBAC bug where the UI and the API silently disagree about who's allowed to do what.

- [x] Task 2: Build `requireRole()`; refactor `requireAdmin()` into a thin wrapper over it (AC: 1, 2, 3, 4, 7) — `src/modules/auth/server/`
  - [x] New file `require-role.ts`. Signature: `requireRole<T>(request: CurrentActorRequest, allowedRoles: UserRole[], fn: (actor: Actor) => Promise<T>, options: RequireRoleOptions): Promise<T>`.
  - [x] `RequireRoleOptions { entity: string; action: string; attemptedAction?: string; entityId?: string }` — `entity` and `action` are REQUIRED (every future call site must be explicit about what it's protecting and how the denial audit row names itself; no generic fallback string that could collide across unrelated modules' audit trails).
  - [x] Implementation composes `getCurrentActor()` exactly like `require-admin.ts` does today, then checks `!isRoleAllowed(actor.role, allowedRoles)` (Task 1's helper — do not inline `actor.role !== "admin"` or any other ad-hoc comparison). On denial: write ONE `AuditLog` row via `transaction()` + `writeAuditLog` (same pattern as today's `require-admin.ts`) with `entity: options.entity`, `entityId: options.entityId ?? actor.userId`, `action: options.action`, `after: options.attemptedAction !== undefined ? { attemptedAction: options.attemptedAction } : null`, `actorUserId: actor.userId` — BEFORE throwing a 403 `AppError` (same code/message shape as today's `ADMIN_ACTION_DENIED`, e.g. rename the exported constant to something generic like `ROLE_ACTION_DENIED` since no test asserts on the constant's export name, only on `{ status: 403 }` and the resulting DB row — confirm this by reading the existing tests, listed in Task 3, before renaming anything).
  - [x] Refactor `require-admin.ts`: `requireAdmin<T>(request, fn, options?: RequireAdminOptions)` (keep this exact external signature, `RequireAdminOptions { attemptedAction: string; targetUserId?: string }` unchanged) now does: `return requireRole(request, [UserRole.admin], fn, { entity: "User", action: "USER_ADMIN_ACTION_DENIED", attemptedAction: options?.attemptedAction, entityId: options?.targetUserId });`. This MUST produce byte-identical `AuditLog` rows and 403 response bodies to what exists today — the two exact behaviors under test in `auth-require-admin.test.ts` (denial writes `action: "USER_ADMIN_ACTION_DENIED"` with `after: null` when no options given; denial writes `entityId`/`after.attemptedAction` correctly when options given).
  - [x] Do not touch `get-current-actor.ts` — it stays exactly as Story 1.2 built it.

- [x] Task 3: Multi-role proof tests (AC: 7) — `tests/integration/auth-require-role.test.ts` (NEW)
  - [x] Real ephemeral Neon branch, same seeding/sign-in pattern as `tests/integration/auth-require-admin.test.ts` (seed tenant + user via owner `pg.Client`, sign in via `auth.api.signInEmail`, build a real session-cookie `Headers`) — never a mocked client, per this project's `tenant-isolation` spec.
  - [x] `requireRole(request, [UserRole.admin, UserRole.quimico], fn, { entity: "TestEntity", action: "TEST_ACTION_DENIED", attemptedAction: "TEST_ACTION" })`: allows an `admin` actor through to `fn`; allows a `quimico` actor through to `fn`; denies a `recepcionista` actor with a 403 `AppError`, writes exactly one `AuditLog` row with the exact `entity`/`action`/`after.attemptedAction` supplied above; `fn` is never invoked for the denied caller.
  - [x] Read `auth-require-admin.test.ts` and `auth-rbac-denial.test.ts` FIRST (do not modify either) — re-run them as-is after Task 2's refactor as your regression proof. If any assertion in either file fails, the refactor broke backward compatibility (AC 4) and must be fixed in `require-role.ts`/`require-admin.ts`, never by editing the test.

- [x] Task 4: Shared "visibly disabled with reason" UI primitive (AC: 5) — `src/components/ui/` (NEW file, name at your discretion, e.g. `disabled-hint.tsx`)
  - [x] Lives under `src/components/ui/` (sibling to `button.tsx`/`field.tsx`/`input.tsx`) — this is generic, role-agnostic presentation infrastructure (`disabled: boolean; reason: string` — no `UserRole` import, no auth-module coupling), not something the `auth` module owns. Any future module (Epic 7's "Validar" gate, etc.) reuses this exact primitive.
  - [x] Must render: the wrapped control with the native `disabled` attribute, PLUS a visible reason string (an actual rendered `<p>`/`<span>`, not a `title` attribute alone), linked via `aria-describedby` (use React's `useId()` to generate a stable id) so screen readers announce the reason (EXPERIENCE.md Accessibility Floor's screen-reader requirement). Exact component API is your call — this is new, general-purpose infrastructure, not a retrofit of an existing pattern.

- [x] Task 5: Retrofit the self-action guard onto `/usuarios` using the new primitive (AC: 6) — `src/app/usuarios/page.tsx`, `src/modules/auth/ui/users-table.tsx`
  - [x] `page.tsx`'s `loadUsers()` already resolves `actor` inside its `requireAdmin` callback (see current code: `async (actor) => scoped(...).user.findMany(...)`). Capture `actor.userId` and return it alongside the list, e.g. `{ users, viewerUserId: actor.userId }`; pass `viewerUserId` as a new prop into `<UsersTable users={...} viewerUserId={...} />`.
  - [x] `users-table.tsx`: add a `viewerUserId: string` prop. For the row where `user.id === viewerUserId`, wrap the role `<select>` and the Desactivar button in Task 4's primitive: disabled, reason "No puedes cambiar tu propio rol." for the select, "No puedes desactivar tu propia cuenta." for Desactivar (Spanish UI copy, matching this screen's existing convention, UX-DR22/NFR-9). The Reactivar button can never actually appear on the viewer's own row in practice (a deactivated actor is rejected by `getCurrentActor()`'s `isActive` re-check before ever reaching this page, per Story 1.2's Task 9 dev note) — your call whether to also defensively disable it for row-level consistency or leave it untouched; document whichever you pick in this story's Completion Notes. **Decision: left untouched — see Completion Notes.**
  - [x] Do NOT change the page-level admission rule — `requireAdmin()` still gates the whole page, a non-admin still gets `notFound()`. This task is strictly additive: it only changes what an ADMIN sees on their OWN row. It does not expose the roster or any action to a new role.

- [x] Task 6: e2e coverage for the self-action disabled state (AC: 6) — `tests/e2e/usuarios.spec.ts` — **verified green 2026-08-17 after the orchestrator authorized and applied the blocking fix (see Debug Log).**
  - [x] Extend the existing "an admin can list, create, edit the role of, and deactivate a user" test (or add a new test in the same file): after signing in as the seeded admin, locate that admin's OWN row and assert its role `<select>` is disabled (`toBeDisabled()`) and the reason text ("No puedes cambiar tu propio rol.") is visible in the DOM near the control; same for the Desactivar button and its reason.
  - [x] Do NOT modify the existing "a non-admin cannot reach /usuarios" test (still expects a plain 404) — that behavior is untouched by this story.

- [x] Task 7: Full regression pass (AC: 4) — **all green 2026-08-17: unit 33/33, integration 78/78 (19 files), e2e 5/5, lint clean, tsc clean, `next build` clean.**
  - [x] Run `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run lint`, `tsc --noEmit`. Zero edits were needed to `create-user.action.ts`, `update-user-role.action.ts`, `deactivate-user.action.ts`, `reactivate-user.action.ts`, or any of Story 1.2's existing test files — confirmed unmodified in the final diff. Strict TDD followed for Tasks 3 and 6's new tests.

## Dev Notes

### This story's core deliverable is a refactor Story 1.2 explicitly asked for, not new business logic

`src/modules/auth/server/require-admin.ts`'s own header comment says it outright: "Story 1.3 will very likely generalize/refactor this into a reusable `requireRole()` used by every module... this lives in `src/modules/auth/server/` specifically so that story has something to extend rather than something to duplicate." Read that file (and `get-current-actor.ts`) completely before writing anything — Task 2 is a refactor of real, working, tested code, not greenfield. Treat the existing `auth-require-admin.test.ts` and `auth-rbac-denial.test.ts` assertions as the exact contract `requireRole`/`requireAdmin` must continue to satisfy byte-for-byte (see those files' exact `AuditLog` row assertions — `action: "USER_ADMIN_ACTION_DENIED"`, `entityId`, `after: { attemptedAction }`).

### Why `requireRole()` lives in `src/modules/auth/server/`, not a new top-level location

AD-1 (vertical-slice modular monolith) forbids a module reaching directly into another module's Prisma models or data, but explicitly permits "an explicit interface/service call" between modules — a plain exported function is exactly that interface. `auth` is the module that already owns "who is signed in and what's their role" (`getCurrentActor`); "is this role allowed to do X" is the natural, adjacent responsibility, not a separate concern needing its own module or a new `src/shared/` location. Every future module (`orders`, `results-capture`, etc.) importing `requireRole` from `@/modules/auth/server/require-role` is a normal cross-module interface call, not a boundary violation — same as how `kanban` will read order state through the `orders` module's own interface later. Do not invent a new `src/shared/rbac/` or similar location "to be more generic" — that would just be a second, parallel home for the same concern AD-1 already tells you where to put.

### The exact backward-compatibility contract for `requireAdmin()`

```ts
// require-role.ts
export interface RequireRoleOptions {
  entity: string;
  action: string;
  attemptedAction?: string;
  entityId?: string;
}
export async function requireRole<T>(
  request: CurrentActorRequest,
  allowedRoles: UserRole[],
  fn: (actor: Actor) => Promise<T>,
  options: RequireRoleOptions,
): Promise<T> { /* getCurrentActor -> isRoleAllowed check -> audit-then-throw or fn(actor) */ }

// require-admin.ts (refactored)
export async function requireAdmin<T>(
  request: CurrentActorRequest,
  fn: (actor: Actor) => Promise<T>,
  options?: RequireAdminOptions,
): Promise<T> {
  return requireRole(request, [UserRole.admin], fn, {
    entity: "User",
    action: "USER_ADMIN_ACTION_DENIED",
    attemptedAction: options?.attemptedAction,
    entityId: options?.targetUserId,
  });
}
```
This is a suggested shape, not a mandate to copy verbatim — but the resulting behavior (audit row shape, 403 body, zero call-site changes at `create-user.action.ts`/`update-user-role.action.ts`/`deactivate-user.action.ts`/`reactivate-user.action.ts`/`usuarios/page.tsx`) is non-negotiable per AC 4.

### Scope boundary: no real cross-role screen exists yet to demonstrate role-vs-role UI gating

Epics.md's own AC 1 example ("Recepcionista attempting to validate a study") describes a screen that doesn't exist until Epic 7. Today, the ENTIRE app has exactly one protected screen (`/usuarios`), and it is 100% admin-only — a non-admin gets `notFound()` before ever rendering anything, so there is no existing (or in-scope) surface where two different roles view the same screen with role-differentiated actions. Building one here would either (a) preempt Story 1.5's explicitly-owned scope ("showing only nav items my role permits" — the app shell doesn't exist yet, Story 1.2 deliberately deferred it), or (b) require reversing Story 1.2's deliberate non-admin-gets-404 information-disclosure decision to expose the roster to every role, which is a product/privacy call this story does not have a mandate to make unilaterally. Given that, this story proves the disabled-with-reason UI primitive (AC 5) using the one real, already-decided, non-role rule available on the one screen that exists: the self-action guard (AC 6, admin can't touch their own row). The general mechanism (`requireRole`'s multi-role support, Task 3) is proven independently via direct tests, so it is fully ready for whichever future epic first builds a real multi-role screen. See the Change Log/open questions if this scope call needs revisiting.

### RLS still does not enforce role — this remains pure application-layer authorization

Confirmed unchanged from Story 1.2: no RLS policy on `user` (or any table) references `current_setting('app.role')`. `requireRole()`/`requireAdmin()` are the only thing standing between a wrong-role caller and a mutation. Get the `isRoleAllowed()` check exactly right (Task 1) — the database will not save you here.

### Source tree placement

```
src/
  modules/
    auth/
      roles.ts                     # NEW (Task 1) — isRoleAllowed(), zero-dependency, safe for client import
      server/
        get-current-actor.ts       # existing — untouched
        require-role.ts            # NEW (Task 2) — the general guard
        require-admin.ts           # MODIFIED (Task 2) — thin wrapper over requireRole
        create-user.action.ts      # existing — UNCHANGED
        update-user-role.action.ts # existing — UNCHANGED
        deactivate-user.action.ts  # existing — UNCHANGED
        reactivate-user.action.ts  # existing — UNCHANGED
      ui/
        users-table.tsx            # MODIFIED (Task 5) — viewerUserId prop, self-row disabled state
        create-user-form.tsx       # existing — untouched
  components/
    ui/
      disabled-hint.tsx            # NEW (Task 4) — generic, role-agnostic disabled+reason primitive
app/
  usuarios/
    page.tsx                       # MODIFIED (Task 5) — thread actor.userId down as viewerUserId
```

### Testing standards (established by Story 1.1/1.2, unchanged)

**Vitest** (`npm run test`, `npm run test:integration`), **Playwright** (`npm run test:e2e`). Any test verifying RLS/Postgres-privilege or session/role behavior MUST run against a real ephemeral Neon branch (`tests/setup/neon-branch-lib.ts`) — never a mocked Prisma client. Strict TDD is active — write each new test failing-first. No React component-test framework (e.g. Testing Library) is installed in this project; prove UI behavior (Task 6) via Playwright e2e against the real rendered page, not a new unit-test dependency.

### Consistency conventions binding this story (unchanged)

Prisma/audit conventions unchanged from 1.1/1.2 (see those files) — this story adds no new Prisma model or migration. API errors stay the single `{ error: { code, message, details? } }` envelope (`src/shared/http/errors.ts`). Spanish UI copy, professional tone (UX-DR22, NFR-9) for any new user-facing text (Task 5's reason strings).

### Project Structure Notes

- No new Prisma models/migrations in this story — purely a refactor of existing server logic plus two small new files (`roles.ts`, a UI primitive) and one UI retrofit.
- Do not create files for other modules (`orders`, `catalog`, etc.) — same "create only what's needed" principle every prior story followed. `requireRole()` is written to be reusable by them later; it does not need a consumer today beyond `requireAdmin()`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation, Story 1.3] — story text, acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-1] — vertical-slice module boundary; cross-module access via explicit interface calls (why `requireRole` stays in `auth`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-8] — Better Auth sole session/role provider; "no module re-implements" spirit applied to this guard
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-10] — audit-log single write path, reused generically here
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#FR-3] — RBAC enforcement (screen + API)
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#NFR-2] — RBAC/audit traceability, NOM-024-SSA3
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-quimiaio-2026-07-10/EXPERIENCE.md#Accessibility Floor] — "RBAC is visible, not silent" — disabled-with-reason UI requirement (AC 5)
- [Source: _bmad-output/implementation-artifacts/1-2-admin-manages-users-roles.md] — previous story: `getCurrentActor()`/`requireAdmin()` build, exact audit-row shape, self-action rules (AC 5/6) this story retrofits into the UI
- [Source: _bmad-output/implementation-artifacts/1-1-user-sign-in.md] — role-as-enum decision, wrapper/RLS foundations
- Direct code verification (2026-08-17): `src/modules/auth/server/{auth,get-current-actor,require-admin}.ts`, `src/middleware.ts`, `src/shared/http/errors.ts`, `src/shared/context/request-context.ts`, `src/shared/db/{index,audit}.ts`, `src/app/usuarios/page.tsx`, `src/modules/auth/ui/{users-table,create-user-form,sign-in-form}.tsx`, `src/app/page.tsx` (confirmed still the untouched create-next-app placeholder — no authenticated home page exists yet), `src/app/layout.tsx`, `tests/integration/{auth-require-admin,auth-rbac-denial}.test.ts`, `tests/e2e/{usuarios.spec,seed}.ts`, `package.json` (confirmed no React component-testing library installed)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- **HALT — pre-existing, verified `next build` defect blocking Task 6 verification and Task 7's `npm run test:e2e` leg (not introduced by this story, not fixable within this story's explicit scope):**
  - While attempting Task 6's e2e run, `npx next build` failed with `Module not found: Can't resolve 'tls'` / `'util/types'` from `node_modules/pg`, traced through `src/modules/auth/ui/users-table.tsx` (a `"use client"` component) → `@/shared/db` → `bootstrap.ts` → `client.ts` → `@prisma/adapter-pg` → `pg`. Root cause: `src/shared/db/index.ts` is a single barrel; importing ANY name from it (even just the `UserRole` enum) executes every other re-exported module's top-level code too, including `client.ts`'s eager `new PrismaPg({ connectionString: env.DATABASE_URL })` — Node/webpack/Turbopack has no way to tree-shake this for a browser bundle, since `client.ts` is a plain module, not one Next recognizes as server-only.
  - This DIRECTLY contradicts this story's own Task 1 dev note ("`users-table.tsx` already imports `UserRole` directly from `@/shared/db` in production with no bundler issue") — verified false via `git stash` + a clean `npx next build` against the pre-Story-1.3 `dev` HEAD: the SAME failure reproduces with zero Story 1.3 changes applied. Root-caused further: Story 1.2's own code-review follow-up #7 ("`UserRole` duplication... now re-exports the runtime const, not just the type") is what turned `users-table.tsx`'s and `create-user-form.tsx`'s existing `import { UserRole } from "@/shared/db"` into a real runtime import for the first time — and Story 1.2's own Debug Log explicitly records "`npm run test:e2e` was not re-run for this patch," so this defect has been latent and unverified since 2026-08-16, not something this story's work caused.
  - **Fixed the part in this story's own scope:** `users-table.tsx` (Task 5's own file, already required to change) now imports `UserRole` as `import type` only, with `ROLE_LABELS` keyed by string literals instead of computed `[UserRole.admin]` — zero runtime import, same `Record<UserRole, string>` exhaustiveness, confirmed via `tsc --noEmit` + `eslint` + re-running `npx next build`.
  - **Re-running `next build` after that fix moves the SAME error to `create-user-form.tsx`** (`z.enum(UserRole)` and `defaultValue={UserRole.quimico}` are genuine runtime value uses of the same barrel import). The equivalent fix there is mechanical (derive `z.enum` from `Object.keys(ROLE_LABELS)`, use a literal `"quimico"` typed via `import type { UserRole }`) — but `create-user-form.tsx` is explicitly listed in this story's own Source Tree Placement notes as "existing — untouched," and my task instructions explicitly say "Do NOT modify Story 1.1 or 1.2's files." I did not apply this fix. **HALTING per instruction #9 (story instructions ambiguous/conflicting on something consequential) rather than unilaterally editing an out-of-scope Story 1.2 file.**
  - Net effect: `npm run test:e2e` cannot currently complete a build AT ALL (for either the pre-existing Story 1.2 e2e tests or this story's new assertions) — this is a repo-wide, pre-existing gap, not a regression caused by Story 1.3's own code.
- No other blocking failures. `NEON_API_KEY`/`NEON_PROJECT_ID`/`NEON_PARENT_BRANCH_ID`/`DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` were all present locally, so `npm run test:integration` ran against a real ephemeral Neon branch as required.
- Unit-test gotcha (Task 1): a first draft of `roles.test.ts` imported `UserRole` as a runtime VALUE from `@/shared/db`, which crashed the plain unit-test project (`vitest.config.ts` has no `DATABASE_URL`/`BETTER_AUTH_*` setup — those only exist in `tests/setup/env.ts`, wired into the INTEGRATION config) via the exact same eager-`client.ts` chain described above. Fixed by using `import type { UserRole }` plus plain string-literal values (`"admin"`, `"quimico"`, `"recepcionista"`) in the test — this is also why `roles.ts` itself uses `import type` rather than a value import.

### Completion Notes List

- Tasks 1-5 complete, TDD-verified (failing test confirmed before each implementation, passing after): `isRoleAllowed()` (unit, 4/4 new tests), `requireRole()` + `requireAdmin()` refactor (integration, 3 new + all 11 pre-existing Story 1.2 `requireAdmin`/RBAC-denial tests re-run unmodified and green), `DisabledHint` primitive, and the `/usuarios` self-action retrofit.
- Task 2: `require-admin.ts` is now a genuinely thin wrapper (`return requireRole(request, [UserRole.admin], fn, { entity: "User", action: "USER_ADMIN_ACTION_DENIED", ... })`); `ADMIN_ACTION_DENIED` is kept as an exported alias of `require-role.ts`'s new `ROLE_ACTION_DENIED` constant (same `{ code, message }` value) for backward compatibility, since nothing in Story 1.2 imports it by identity, only by shape (`{ status: 403 }` on the thrown `AppError`).
- Task 5: chose to leave the Reactivar button undecorated on the viewer's own row (rather than defensively wrapping it in `DisabledHint` too) — it is structurally unreachable in practice (a deactivated actor never reaches this page, per `getCurrentActor()`'s `isActive` re-check), and wrapping an unreachable branch in speculative UI risked implying a real product rule that doesn't exist yet.
- Task 6: the e2e assertions are written (extending the existing "an admin can list, create, edit the role of, and deactivate a user" test) and byte-match the copy/behavior Task 5 implements, but could not be run to a passing state — see the HALT in Debug Log References. They are NOT confirmed green.
- Task 7: `npm run test` (33/33), `npm run test:integration` (78/78 across 19 files), `npm run lint` (clean), `npx tsc --noEmit` (clean) all pass. `npm run test:e2e` did not complete — blocked at the `next build` step by the pre-existing defect described above, unrelated to and not caused by this story's implementation.
- **Orchestrator resolution (2026-08-17), post-HALT:** authorized fixing `create-user-form.tsx` as part of this story rather than a separate chore, since it blocked ALL e2e verification (old and new). The actual fix went one layer deeper than the dev agent's own diagnosis: `create-user-form.tsx`'s `UserRole` runtime import was ALREADY switched to a `ROLE_LABELS`-derived `z.enum` + `import type`, but `next build` then surfaced the SAME class of error via a second import in the same file — `import { MIN_PASSWORD_LENGTH } from "../server/auth"`. `auth.ts` calls `betterAuth(...)` at module scope and imports `authPrisma`/`scoped` from `src/shared/db`, so importing ANY name from it — even an unrelated constant — pulls Better Auth's full server-only config (and its Prisma/`pg` adapter) into the client bundle. Fix: extracted `MIN_PASSWORD_LENGTH` into a new zero-import file, `src/modules/auth/server/password-policy.ts`; `auth.ts` now imports and re-exports it (server-only consumers like `create-user.action.ts` are unaffected); `create-user-form.tsx` imports the constant from `password-policy.ts` directly instead of `auth.ts`. Verified via `npx next build` (clean), then the full suite: unit 33/33, integration 78/78, e2e 5/5, lint clean, tsc clean.

### File List

**New files:**
- `src/modules/auth/roles.ts`
- `src/modules/auth/roles.test.ts`
- `src/modules/auth/server/require-role.ts`
- `tests/integration/auth-require-role.test.ts`
- `src/components/ui/disabled-hint.tsx`

**Modified files:**
- `src/modules/auth/server/require-admin.ts` (refactored into a thin wrapper over `requireRole()`; external signature unchanged)
- `src/modules/auth/ui/users-table.tsx` (added `viewerUserId` prop; self-row role `<select>`/Desactivar wrapped in `DisabledHint`; `UserRole` import changed to `import type` + literal `ROLE_LABELS` keys to fix a pre-existing client-bundle build defect — see Debug Log)
- `src/app/usuarios/page.tsx` (`loadUsers()` now returns `{ users, viewerUserId }`; threads `viewerUserId` into `<UsersTable>`)
- `tests/e2e/usuarios.spec.ts` (added self-action disabled-state assertions to the existing admin test; verified green)
- `src/modules/auth/server/auth.ts` (orchestrator fix — `MIN_PASSWORD_LENGTH` extracted to `password-policy.ts`, re-exported here for existing server-only importers)
- `src/modules/auth/ui/create-user-form.tsx` (Story 1.2 file, orchestrator fix — `MIN_PASSWORD_LENGTH` now imported from `password-policy.ts` instead of `auth.ts`; role select derives from `ROLE_LABELS` keys with a `DEFAULT_ROLE` constant instead of a runtime `UserRole` import)

**New files (orchestrator fix):**
- `src/modules/auth/server/password-policy.ts` (`MIN_PASSWORD_LENGTH`, zero other imports — see Debug Log)
