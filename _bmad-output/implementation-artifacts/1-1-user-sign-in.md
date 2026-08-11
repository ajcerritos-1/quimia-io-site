# Story 1.1: User Sign-In

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Dev execution for this story runs via SDD (openspec/changes/story-1-1-user-sign-in/), not bmad-dev-story. Task checkboxes below are kept in sync with openspec/changes/story-1-1-user-sign-in/tasks.md — that file is the source of truth for phase/subtask granularity. -->
<!-- sdd-verify (2026-08-11) FAILED: 3 CRITICAL findings, see openspec/changes/story-1-1-user-sign-in/verify-report.md. All 32/32 SDD tasks below are implemented and honestly checked, but AC-4 is violated on the public /api/auth/[...all] route (an account-state oracle distinguishes "inactive account" from "wrong password" there, even though the UI path is compliant), plus 2 untested uniqueness scenarios. Do NOT read the checkboxes below as "story done" — archive is blocked until the CRITICAL findings are fixed and this change is re-verified. -->

## Story

As a lab staff member (admin/recepcionista/químico),
I want to sign in with my nickname/email and password,
so that I can access only my tenant's data through a secure, tenant-scoped session.

## Acceptance Criteria

1. Given a valid nickname/email + password for an active user, when I submit the sign-in form, then I'm authenticated via Better Auth and a tenant-scoped session begins. [Source: epics.md#Story 1.1]
2. Given the tenant needs to be resolved before any session exists, when sign-in starts, then a bootstrap-mode lookup resolves `tenantId` from an RLS-exempt, narrowly-scoped table before the scoped session begins. [Source: ARCHITECTURE-SPINE.md#AD-3]
3. Given my session is established, when any subsequent request runs, then the Prisma wrapper's scoped mode opens the transaction with `SET LOCAL app.tenant_id`/`app.role` derived from my session, and Postgres RLS restricts every query to my tenant. [Source: ARCHITECTURE-SPINE.md#AD-2, AD-3]
4. Given an invalid password or inactive account, when I submit sign-in, then I see a generic authentication-failed message with no hint about which part was wrong. [Source: epics.md#Story 1.1]

## Tasks / Subtasks

- [ ] Task 1: Project & environment scaffolding (AC: all — this story is first in the project; no separate scaffolding story exists, see Dev Notes)
  - [x] Initialize Next.js `>=16.2.11` (App Router), TypeScript 6.x strict
  - [x] Configure Tailwind CSS v4 + shadcn/ui (Base UI)
  - [x] Set up `prisma.config.ts` (Prisma 7.x requirement — no more datasource `url` in schema), `@prisma/adapter-pg`, explicit generator `output` path
  - [x] Provision Neon project + database; wire connection string (pooled, pgbouncer) via typed env config (Zod, `src/shared/config/`)
  - [ ] Set up dev (local) → preview (Vercel + ephemeral Neon branch per PR) → production (Vercel + Neon main) pipeline per AD-9
- [x] Task 2: Core schema — `Tenant` and `User` models (AC: 1, 3)
  - [x] Create `Tenant` model (cuid2 id, subdomain/slug for `{lab}.quimiaio.com` resolution)
  - [x] Create `User` model (cuid2 id, `tenantId` FK, email/nickname, passwordHash via Better Auth, `role` field — see Dev Notes for the enum-vs-table decision this story must make)
  - [x] Migrate via the migration/owner role (never the app's runtime role — see AD-2)
- [x] Task 3: Neon RLS setup (AC: 3)
  - [x] Enable RLS + `FORCE ROW LEVEL SECURITY` on `User` (and every tenant-owned table going forward)
  - [x] Create the app's runtime Postgres role as non-owner, with only the grants its RLS policies need
  - [x] Write the RLS policy reading `current_setting('app.tenant_id')`
- [x] Task 4: Prisma Client Extension wrapper — `src/shared/db` (AC: 2, 3)
  - [x] Implement scoped mode: opens a transaction, runs `SET LOCAL app.tenant_id` / `app.role` from the authenticated session before any query (implemented as `set_config(..., true)` inside an array-form `$transaction`, per ARCHITECTURE-SPINE — same transaction-scoped guarantee, injection-safe)
  - [x] Implement bootstrap mode: narrowly-scoped lookup (subdomain → `tenantId`) against an RLS-exempt table/view, immediately followed by a scoped transaction
  - [x] Forbid direct `prisma.<model>` calls outside this wrapper (enforced via `eslint.config.mjs` blocking `src/generated/prisma` imports outside `src/shared/db`; confirmed by a planted-violation test — SDD Phase 5.5)
- [x] Task 5: Better Auth integration — `src/modules/auth` (AC: 1, 4)
  - [x] Configure Better Auth with the Prisma adapter — correction from this task's original wording: bound to the wrapper's **scoped-mode ambient proxy** (`authPrisma`, ALS-resolved), not the bootstrap-mode client; design.md is explicit that Better Auth never uses bootstrap mode
  - [x] Implement sign-in with nickname/email + password (server action + `sign-in-form.tsx` UI, `/sign-in` page — AC-1's actual entry point)
  - [x] Generic failure message on bad credentials or inactive account (no field-specific hint) — one `AUTH_INVALID_CREDENTIALS` envelope for wrong password, unknown identifier, inactive user, and inactive tenant alike, with a dummy password verify on unknown identifiers to avoid a timing oracle; confirmed byte-for-byte identical in the UI by Playwright e2e
- [x] Task 6: Structured logging & error envelope (AC: all — cross-cutting, established here for every later story to reuse)
  - [x] Structured JSON logging carrying `tenant_id`/`request_id` on every line
  - [x] API error envelope `{ error: { code, message, details? } }`

## Dev Notes

### This is Story 1.1 of the entire project — scaffolding has no separate story

The Implementation Readiness review (2026-08-02) flagged that no story owns project/environment scaffolding, since Architecture specifies no starter template. Per that review's own recommendation, this story absorbs it (Task 1) rather than leaving it homeless. Everything in Task 1 must exist before Tasks 2–6 can run.

### Schema decision this story must make: `User.role` is an enum, not a `Role` table

Architecture's Deferred section lists `User.roleId`/`Role` (RBAC model) as "needed for Phase 1 FRs... not yet drafted," explicitly deferred to "each module's own SPEC→SCHEMA time" [Source: ARCHITECTURE-SPINE.md#Deferred]. This story is that time. **Decision: use a simple Postgres/Prisma enum (`admin` | `recepcionista` | `quimico`), not a `Role` relation table.** Rationale: Phase 1 has exactly 3 fixed roles with no per-tenant customization (FR-2); a full RBAC table is Phase 2 territory (FR-70's granular per-module permissions, `administracion`/`gerente` roles). Building a `Role` table now would be solving a Phase 2 problem inside a Phase 1 story — reinventing complexity the PRD explicitly places later. Story 1.2 (user CRUD) and Story 1.3 (RBAC enforcement) both depend on this being an enum on `User`, not a join.

### AD-3's bootstrap mode is the crux of this story — read it exactly

[Source: ARCHITECTURE-SPINE.md#AD-3] Two modes, never a third invented:
1. **Scoped mode** (default, every authenticated request): opens a transaction, `SET LOCAL app.tenant_id`/`app.role` from the session, before any query.
2. **Bootstrap mode** (only to *resolve* a tenant before a session exists): the tenant-subdomain lookup at login (`{lab}.quimiaio.com` → `tenantId`, before Better Auth's session exists) is explicitly one of the three named bootstrap flows (the other two — portal-token, instrument-API-key — belong to later epics, not this story). Each bootstrap lookup reads from an RLS-exempt table/view scoped to exactly the columns needed to resolve `tenantId` — never a general unscoped query — and immediately opens a scoped transaction for everything after.

Direct `prisma.<model>` calls outside this wrapper, in either mode, are forbidden — this is the single most important rule in the entire architecture (AD-1, AD-3 both depend on it) and the rule every later epic's stories assume is already enforced by the time they run.

### RLS specifics (AD-2)

Every tenant-owned table needs `FORCE ROW LEVEL SECURITY` — without it, Postgres lets the connecting role's table *owner* bypass RLS entirely, silently voiding NFR-1 if the app ever connects as the owning/migration role. The app connects as a separate, non-owner role with only the grants its RLS policies need; a distinct migration role (never used by the running app) owns the schema. Get this role separation right in Story 1.1 — Epic 1's Story 1.2 (audit log) and every later epic's RLS depends on this exact pattern already existing correctly.

### Prisma 7 + Better Auth + `@prisma/adapter-pg`: the P1010 risk, resolved

Architecture flagged this as an open risk needing verification "before wiring auth" [Source: ARCHITECTURE-SPINE.md#Stack]. Verified via web (2026-08-02): there is no fundamental incompatibility. The P1010 "User was denied access" runtime error (CLI works, app doesn't) has two concrete causes to guard against:
1. **Prisma 7 no longer auto-loads env vars** — explicitly load them (dotenv or Next.js's own env handling) *before* the Prisma client is instantiated anywhere in the app, not just at CLI time.
2. **SSL certificate handling against Neon** — configure via `NODE_EXTRA_CA_CERTS` or `node --use-openssl-ca`; do **not** silently disable cert verification (`rejectUnauthorized: false`) as a shortcut — that's a real security regression, not a config nicety.

Also: Prisma 7 requires an explicit generator `output` path in `schema.prisma` (no default `@prisma/client` location) — Better Auth's Prisma adapter must import the client from that same custom path, not the package default, or it silently connects to a stale/wrong client instance.

### Source tree placement

[Source: ARCHITECTURE-SPINE.md#Source tree]
```
src/
  modules/
    auth/            # THIS STORY: login, session, role checks
  shared/
    db/              # THIS STORY: Prisma Client Extension wrapper (RLS context)
    config/          # THIS STORY: typed env (Zod)
```
Do not create files for other modules (`patients`, `orders`, etc.) in this story — they don't exist yet and shouldn't be scaffolded speculatively (Database/Entity Creation Principle: create only what's needed, when it's needed).

### Consistency conventions binding this story

[Source: ARCHITECTURE-SPINE.md#Consistency Conventions] Prisma models PascalCase singular (`User`, `Tenant`), fields camelCase. IDs = cuid2. Dates ISO-8601 UTC in the database (localize to Mexico time only at presentation — not relevant yet in this story, but set the convention correctly from row one). API errors: single envelope `{ error: { code, message, details? } }` — establish this now, every later epic's API stories assume it already exists. Zod validates typed env config (no raw `process.env` reads in business logic) — also applies to every request/response payload going forward, though this story's only payload is the sign-in form.

### Testing standards — gap in Architecture, recommendation only

Architecture Spine does not name a test framework (it's an invariants spine, not a tooling doc) — this is a genuine gap, not an oversight to route around silently. Recommendation, consistent with Winston's "boring technology" architecture principle already applied throughout: **Vitest** for unit/integration tests (native ESM, fast, standard for the Next.js 16 ecosystem), **Playwright** for the one true e2e path this story needs (sign-in happy path + invalid-credentials path). Confirm with the team before or during this story's implementation — don't treat this recommendation as already-decided architecture.

### Project Structure Notes

- Greenfield project — no existing code to preserve or conflict with. This is the literal first story.
- No sharded architecture/PRD/UX documents exist; this story was built from the whole-document versions only (see References).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Foundation, Story 1.1] — story text, acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-1] — vertical-slice module boundary
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-2] — Neon RLS, FORCE ROW LEVEL SECURITY, role separation
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-3] — Prisma wrapper, scoped/bootstrap modes
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-8] — Better Auth
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#AD-9] — dev/preview/production environments
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#Deferred] — User.roleId/Role deferred to this story's SPEC→SCHEMA time
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#Stack] — Next.js/TS/Prisma/Better Auth versions and gotchas
- [Source: _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md#Consistency Conventions] — naming, IDs, error envelope, logging
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#FR-1] — sign-in requirement
- [Source: _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md#NFR-1] — tenant isolation
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-quimiaio-2026-07-10/EXPERIENCE.md#Foundation] — multi-tenant shell (`{lab}.quimiaio.com`)
- Web verification (2026-08-02): [Prisma v7 + Better Auth + @prisma/adapter-pg: P1010 discussion](https://github.com/better-auth/better-auth/discussions/6529), [Better Auth Prisma adapter docs](https://better-auth.com/docs/beta/adapters/prisma), [Prisma ORM 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
