# Deferred Work

## Deferred from: code review of story-1-2-admin-manages-users-roles (2026-08-16)

- Case-sensitive email/nickname uniqueness now human-exercised for the first time via the Usuarios admin form — the `@@unique` constraints are plain Postgres text uniqueness (case-sensitive), inherited from Story 1.1's schema design, not introduced by Story 1.2. Deferred, pre-existing.
- Server Actions (`submitCreateUser`/`submitUpdateUserRole`/`submitDeactivateUser`) return a clear "you do not have permission" message to a non-admin caller who invokes them directly, while `/usuarios`'s page load hides behind a 404 for the same caller. Inherent to Next.js Server Actions being independently invocable regardless of page rendering; no tenant data or credentials are disclosed. Deferred, pre-existing platform characteristic.
- Story/Dev Notes wording ("Postgres-level immutability... enforced by Postgres privileges") is accurate only for the `quimia_app` runtime role (the only one on any request path) — the schema owner/migration role retains full DDL/DML by design, as is normal for a Postgres owner. Worth a wording clarification in a future docs pass. Deferred, documentation-only.
- No forced password reset / "must change password" flag on admin-created user accounts. Not in Story 1.2's Acceptance Criteria; reasonable Phase 2 candidate. Deferred, out of scope.
