# Deferred Work

## Deferred from: code review of story-1-4-password-policy-enforcement-nom-024-ssa3 (2026-08-18)

- **Timing side-channel on the lockout threshold-crossing attempt** — the 5th (crossing) failed-attempt does one extra `AuditLog` insert the prior attempts don't, making it measurably slower than attempts 1-4. A narrow instance of the timing oracle Story 1.1's dummy-verify pattern otherwise closes. Product decision 2026-08-18: not worth the engineering cost to fully equalize branch timings right now, given this app's threat model (single-tenant lab staff, not a public high-value target). Revisit if that changes.
- **Unresolved migration drift on Story 1.2's `20260816231455_audit_log` migration.** The dev/test database recorded a checksum for this migration from before its code-review edit (added `@@index([entityId])`); Story 1.4's implementation routed around this by creating a new migration + `prisma migrate resolve --applied` rather than fixing the underlying drift. **Needs a real fix**: reconcile the recorded migration checksum (or the migration history) so `prisma migrate deploy` doesn't require manual `resolve` workarounds on fresh environments going forward. Worth its own small chore/story before this compounds further.
- The `"anonymous"` scoped role (used by sign-in's pre-session lookups and now by lockout bookkeeping) performs privileged writes that work only because current RLS policies are tenant-only, not role-based. Premature to guard against today; revisit if/when role-scoped RLS policies are introduced.
- Once a lockout window expires, the next wrong-password attempt immediately re-locks the account (the failed-attempt counter only resets on a successful sign-in, not on lockout expiry) — an accepted, intentional stricter posture; epics.md doesn't require a fresh-attempts grace period after expiry.

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
