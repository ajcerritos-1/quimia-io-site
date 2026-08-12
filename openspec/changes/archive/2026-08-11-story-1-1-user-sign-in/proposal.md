# Proposal: Story 1.1 — User Sign-In

Ported from BMad Story 1.1 (`_bmad-output/implementation-artifacts/1-1-user-sign-in.md`, status `ready-for-dev`). Requirements are settled; this proposal frames scope, approach, and the open decisions blocking spec/design.

## Intent

Lab staff (admin/recepcionista/quimico) cannot access anything: the repo is empty. Story 1.1 delivers sign-in AND the tenant-isolation substrate every later epic assumes already works. Getting RLS role separation and the Prisma wrapper wrong here silently voids NFR-1 across all 12 epics.

## Scope

### In Scope
- Project scaffolding: Next.js `>=16.2.11` App Router, TS 6.x strict, Tailwind v4 + shadcn/ui, Prisma 7.x (`prisma.config.ts`, `@prisma/adapter-pg`, explicit generator `output`), Zod-typed env in `src/shared/config/`
- Environments per AD-9: dev -> preview (Vercel + ephemeral Neon branch per PR) -> production
- Schema: `Tenant` + `User` (cuid2). **`User.role` is a Prisma enum (`admin|recepcionista|quimico`), NOT a `Role` table** — Phase 1 has 3 fixed roles; RBAC tables are Phase 2 (FR-70)
- Neon RLS (AD-2): `FORCE ROW LEVEL SECURITY`, policy on `current_setting('app.tenant_id')`, non-owner app role, separate migration/owner role
- Prisma wrapper `src/shared/db` (AD-3): scoped mode (`SET LOCAL app.tenant_id`/`app.role`) + bootstrap mode (subdomain -> `tenantId`). No direct `prisma.<model>` outside it
- Better Auth sign-in in `src/modules/auth` (AD-8); generic failure on bad credentials or inactive account
- Cross-cutting: JSON logging with `tenant_id`/`request_id`; error envelope `{ error: { code, message, details? } }`

### Out of Scope
- User CRUD (1.2), RBAC enforcement (1.3), password policy/lockout (1.4), app shell (1.5)
- Portal-token and instrument-API-key bootstrap flows (later epics)
- Any `src/modules/*` other than `auth`

## Capabilities

### New Capabilities
- `auth-sign-in`: credential sign-in, session establishment, generic failure behavior
- `tenant-isolation`: Prisma wrapper two modes + Neon RLS enforcement contract
- `platform-foundation`: typed env, structured logging, API error envelope

### Modified Capabilities
- None (greenfield)

## Approach

Bottom-up: scaffolding -> schema -> RLS -> wrapper -> Better Auth -> observability. The wrapper is the seam: Better Auth's Prisma adapter binds to the wrapper's client, never a raw client. Prove isolation with an integration test that queries as tenant A and asserts zero tenant-B rows — RLS is untestable against mocks.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| repo root | New | Next.js + Prisma + Tailwind scaffolding, `prisma.config.ts` |
| `prisma/` | New | `Tenant`/`User` models, RLS + role-separation migrations |
| `src/shared/config/` | New | Zod-validated env |
| `src/shared/db/` | New | Prisma Client Extension wrapper (scoped + bootstrap) |
| `src/modules/auth/` | New | Better Auth config, sign-in route/form/session |
| `src/shared/logging/`, `src/shared/http/` | New | JSON logger, error envelope |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Better Auth session/account tables collide with FORCE RLS (token lookup has no tenant context) — see Open Decision 1 | High | Resolve in design before wrapper code |
| Email uniqueness scope conflicts with multi-tenancy — Open Decision 2 | High | Resolve in design |
| Prisma 7 P1010 "denied access" | Med | Load env before client instantiation; `NODE_EXTRA_CA_CERTS` (never `rejectUnauthorized: false`); Better Auth imports client from the custom generator `output` path |
| App connects as owner role, silently bypassing RLS | Med | Separate migration/owner vs runtime role; negative-path RLS test |
| Direct `prisma.<model>` bypasses the wrapper | Med | ESLint `no-restricted-imports` on the generated client outside `src/shared/db` |
| Neon free-tier branch cap vs branch-per-PR | Low | Monitor; cap concurrent preview branches |

## Open Decisions (need AJ before design closes)

1. **Better Auth internal tables under RLS.** Session lookup by token happens before any tenant context exists. That is effectively a fourth bootstrap flow, which AD-3 forbids. Either Better Auth's `session`/`account`/`verification` tables are RLS-exempt (token is the capability), or AD-3's bootstrap list gains an explicit fourth named flow. AD-3 as written does not cover this.
2. **Email/nickname uniqueness scope.** Better Auth assumes globally unique `email` on `User`; multi-tenancy wants unique per `(tenantId, email)` and `(tenantId, nickname)`. These conflict. Composite uniqueness requires overriding Better Auth's default model constraints.
3. **Test framework ratification + RLS test target.** Vitest + Playwright endorsed (matches `openspec/config.yaml`). Unresolved: RLS/wrapper tests need a real Postgres. Neon ephemeral branch, or local Docker Postgres for the TDD loop?

## Rollback Plan

Greenfield, single branch — `git revert` the merge or delete the branch; drop the Neon branch/database. No data or consumers exist. Once merged, rollback of RLS-only changes = re-run the down migration with the owner role.

## Dependencies

- Neon project + pooled connection string; Vercel project; domain/subdomain routing for `{lab}.quimiaio.com`
- Better Auth compatible with Prisma 7 + `@prisma/adapter-pg` (verified 2026-08-02)

## Success Criteria

- [x] Valid credentials sign in; a tenant-scoped session is established
- [x] Subdomain resolves `tenantId` via bootstrap mode before any scoped transaction opens
- [x] Integration test proves a tenant-A session returns zero tenant-B rows
- [x] Invalid password and inactive account return the identical generic message
- [x] Every log line carries `tenant_id` and `request_id`; errors use the single envelope
- [x] No direct `prisma.<model>` call exists outside `src/shared/db`
