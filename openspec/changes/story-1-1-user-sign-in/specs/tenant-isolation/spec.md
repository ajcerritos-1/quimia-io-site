# Tenant Isolation Specification

## Purpose

Prisma Client Extension wrapper (`src/shared/db`) with exactly two entry modes, plus Neon RLS enforcement, guaranteeing NFR-1 tenant isolation for every module that reads or writes application data.

Traces to: BMad Story 1.1 ACs 2, 3; AD-2, AD-3, AD-9 (`ARCHITECTURE-SPINE.md`).

## Requirements

### Requirement: The Prisma Wrapper Is the Sole Database Access Path

The system MUST route every database access through `src/shared/db`. Direct `prisma.<model>` calls outside this wrapper, in either mode, MUST NOT exist.

#### Scenario: No direct model access outside the wrapper

- GIVEN the codebase
- WHEN any module needs database access
- THEN it goes exclusively through `src/shared/db`
- AND no direct `prisma.<model>` import/call exists anywhere else

#### Scenario: Scoped mode sets session context before any query

- GIVEN an authenticated request with a resolved `tenantId` and `role`
- WHEN the wrapper opens scoped mode
- THEN it opens a transaction and runs `SET LOCAL app.tenant_id`/`app.role` from the session BEFORE any query executes

### Requirement: Bootstrap Mode Is Limited to Named, Narrowly-Scoped Flows

The system MUST restrict bootstrap-mode lookups to the tenant-subdomain resolution flow (this story) reading only an RLS-exempt tenant-resolution table/view, and MUST immediately open a scoped transaction afterward. No unscoped general query MAY be issued in bootstrap mode.

#### Scenario: Sign-in bootstrap lookup is narrowly scoped

- GIVEN sign-in needs `tenantId` resolved from the subdomain
- WHEN the wrapper's bootstrap mode runs
- THEN it queries only the columns needed to resolve `tenantId` from an RLS-exempt table/view
- AND it immediately opens a scoped transaction (scoped mode) for everything after

### Requirement: Neon RLS Enforces Isolation on Tenant-Owned Application Data

The system MUST enable `FORCE ROW LEVEL SECURITY` with a `current_setting('app.tenant_id')` policy on every tenant-owned table, and the running app MUST connect as a non-owner role distinct from the migration/owner role.

#### Scenario: FORCE RLS enabled via the migration/owner role

- GIVEN the `User` table (tenant-owned)
- WHEN the migration runs using the migration/owner role
- THEN `FORCE ROW LEVEL SECURITY` is enabled with a policy reading `current_setting('app.tenant_id')`

#### Scenario: Runtime connects as a non-owner role

- GIVEN the running app's Postgres connection
- WHEN any query executes at runtime
- THEN the app connects as a separate, non-owner role with only the grants its RLS policies need
- AND that role is never the schema owner, so the owner-bypass-RLS loophole cannot apply

### Requirement: Better Auth's Own Tables Are RLS-Exempt by Design

Better Auth's `session`, `account`, and `verification` tables MUST NOT carry RLS policies expecting tenant enforcement. Isolation happens one hop later, at the `User`/application-data layer. (Threat-model addendum, AD-2, resolved 2026-08-02.)

#### Scenario: Session/account/verification queried by token, not tenant context

- GIVEN Better Auth's `session`, `account`, and `verification` tables
- WHEN they are queried by session token before any tenant context exists
- THEN no RLS policy on those tables is expected or required to enforce isolation

#### Scenario: Token is the capability gate, not RLS

- GIVEN an actor without a valid session token
- WHEN they attempt to reach Better Auth's own tables
- THEN the token itself gates access — the absence of RLS there does not leak tenant data, because every row these tables produce still resolves to a `tenantId`-scoped `User` before any tenant data is touched

### Requirement: RLS Isolation MUST Be Verified Against a Real Postgres Branch

Every test that verifies wrapper or RLS behavior MUST run against a real Postgres instance — an ephemeral Neon branch, the same mechanism used for PR previews (AD-9). A mocked/stubbed Prisma client MUST NOT be accepted as verification evidence for this requirement.

#### Scenario: Integration test proves isolation on a real Neon branch

- GIVEN Tenant A and Tenant B each have their own `User` rows on a real ephemeral Neon branch
- WHEN an integration test runs a scoped-mode query as Tenant A's session against that branch
- THEN the result set contains zero Tenant-B rows

#### Scenario: A mocked Prisma client is rejected as RLS evidence

- GIVEN a test suite claims to verify RLS isolation
- WHEN that test uses a mocked or stubbed Prisma client instead of a real Postgres connection
- THEN it MUST NOT be accepted as satisfying this requirement — a mock proves the mock works, not that Postgres enforces the policy
