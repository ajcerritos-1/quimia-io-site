# Deferred Work

## Deferred from: code review of story-1-2-admin-manages-users-roles (2026-08-16)

- Case-sensitive email/nickname uniqueness now human-exercised for the first time via the Usuarios admin form — the `@@unique` constraints are plain Postgres text uniqueness (case-sensitive), inherited from Story 1.1's schema design, not introduced by Story 1.2. Deferred, pre-existing.
- Server Actions (`submitCreateUser`/`submitUpdateUserRole`/`submitDeactivateUser`) return a clear "you do not have permission" message to a non-admin caller who invokes them directly, while `/usuarios`'s page load hides behind a 404 for the same caller. Inherent to Next.js Server Actions being independently invocable regardless of page rendering; no tenant data or credentials are disclosed. Deferred, pre-existing platform characteristic.
- Story/Dev Notes wording ("Postgres-level immutability... enforced by Postgres privileges") is accurate only for the `quimia_app` runtime role (the only one on any request path) — the schema owner/migration role retains full DDL/DML by design, as is normal for a Postgres owner. Worth a wording clarification in a future docs pass. Deferred, documentation-only.
- No forced password reset / "must change password" flag on admin-created user accounts. Not in Story 1.2's Acceptance Criteria; reasonable Phase 2 candidate. Deferred, out of scope.

## Deferred from: code review of story-1-3-role-based-access-control-enforced-everywhere (2026-08-17)

- Self-action-disabled styling (`DisabledHint`) is inconsistent with `users-table.tsx`'s existing silent disables (`isPending`, `!user.isActive`) — different semantic cases (temporary/loading vs. "not allowed"), not a bug. Deferred, style-only.
- `DisabledHint` causes a layout shift between enabled/disabled states and silently drops `className` when `disabled=false`. Deferred, minor UI polish.
- Zero unit tests for `DisabledHint` — project has no React component-test framework installed; adding one is a separate dependency decision. Covered indirectly today via e2e. Deferred.
- `RequireRoleOptions.entity`/`action` are unconstrained strings with no cross-module collision protection — premature, only one module (`auth`) uses `requireRole` today. Revisit when a second module adopts it. Deferred.
- `auth-require-role.test.ts`'s multi-role coverage is narrow (one fixed 2-role shape, no 3+ roles, no explicit `entityId` case). AC 7 is satisfied; more cases are a nice-to-have. Deferred.
- `ownRow.getByRole("combobox")` e2e locator assumes exactly one combobox per row forever — speculative, no second combobox exists today. Deferred.
