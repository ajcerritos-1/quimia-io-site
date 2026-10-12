# Supporting Catalogs Specification

## Purpose

Schema substrate for the five supporting-catalog models (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`) that Study (Story 2.2) references by FK. Ships models, one migration, RLS, and integration tests only — no UI, CRUD actions, nav entry, or seed data. Catalog UI lives under hub `/configuracion` (nav ships in the first UI change, 2/6). Traces to: BMad Story 2.1 ACs 1–2; AD-2, AD-3, AD-6, AD-8; FR-5, FR-9.

## Requirements

### Requirement: Five Catalog Models Follow the Locked Field Contract

The system MUST define models `Method`, `Technique`, `Equipment`, `Container`, `SampleType`, each with `id String @id @default(cuid(2))`, bare `tenantId String` (no FK relation to `Tenant` — AuditLog precedent), `name String`, `isActive Boolean @default(true)`, `createdAt`/`updatedAt`, `@@map` snake_case, `@@index([tenantId])`, `@@unique([tenantId, name])`. `Equipment` MUST additionally carry required `model`/`serialNumber` (descriptive, not unique) and nullable `calibrationDate DateTime?` (FR-9). No fields beyond this contract MAY be added.

#### Scenario: All five tables match the locked schema

- GIVEN migration `catalog_supporting_models` applied
- WHEN the schema is inspected
- THEN `method`, `technique`, `equipment`, `container`, `sample_type` exist with the exact fields above

#### Scenario: Duplicate name within a tenant rejected

- GIVEN tenant A has `Method` "QUIMICA SANGUINEA"
- WHEN tenant A creates another `Method` with the same name
- THEN creation fails with a `(tenantId, name)` uniqueness violation

#### Scenario: Same name across tenants allowed

- GIVEN tenant A has `Method` "QUIMICA SANGUINEA"
- WHEN tenant B creates a `Method` with the same name
- THEN tenant B's row is created — uniqueness is per tenant (AD-8)

#### Scenario: Equipment stores calibration data

- GIVEN a new `Equipment` row
- WHEN created with `model`, `serialNumber`, no `calibrationDate`
- THEN `calibrationDate` is NULL — uncalibrated equipment is valid

### Requirement: RLS Is Enforced on Every Catalog Table (AD-2/AD-3)

Each table MUST have `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy on `current_setting('app.tenant_id', true)`, applied by the owner/migration role via `DIRECT_DATABASE_URL` (never `quimia_app`). `quimia_app` MUST receive `GRANT SELECT, INSERT, UPDATE, DELETE` (User precedent; deactivate-not-delete is an app rule, not a grant revocation). Per AD-2/AD-3: these are tenant-owned tables; every runtime query must be scoped, and the non-owner app role prevents owner-bypass.

#### Scenario: Migration enables FORCE RLS per table

- GIVEN the migration applied via the owner role
- WHEN policies are listed per table
- THEN each of the five tables has RLS ENABLED + FORCE with a `tenant_isolation` policy

#### Scenario: Unscoped query is fail-closed

- GIVEN no `app.tenant_id` is set
- WHEN `quimia_app` selects from `method`
- THEN zero rows return — `tenantId = NULL` is NULL, never all rows

#### Scenario: Cross-tenant access is impossible

- GIVEN tenant A's scoped session and tenant B rows exist
- WHEN tenant A queries any catalog table
- THEN zero tenant-B rows appear

#### Scenario: Owner cannot bypass isolation

- GIVEN `FORCE ROW LEVEL SECURITY` is set
- WHEN the owner role queries without a tenant setting
- THEN it also sees zero rows — FORCE subjects the owner to RLS; missing FORCE is forbidden

### Requirement: Deactivate-Not-Delete Is the Lifecycle Contract

The app MUST deactivate catalog rows via `isActive = false` and MUST NOT hard-delete them; Study (Story 2.2) references these rows by FK. Full-CRUD grants remain; the no-delete rule is the semantic contract app code honors.

#### Scenario: Deactivated entry remains for FK reference

- GIVEN `Method` "ELISA" is deactivated
- WHEN a Study later references it
- THEN the row still exists with `isActive = false` — no hard delete occurred

### Requirement: Container Is a Catalog Lookup, Not Order Identity (AD-6)

The `Container` model MUST represent container types a Study can reference (e.g., "tubo lila EDTA") — same role as Method/Technique. It MUST NOT model per-tube Sample/Container order identity, the entity AD-6 forbids (barcode identical across every tube of one order; tube color is a phlebotomy draw-guide).

#### Scenario: Container row is a lookup value

- GIVEN `Container` "tubo lila EDTA" exists
- WHEN a Study references it by `containerId`
- THEN it resolves to the catalog row — no order/tube identity is modeled

### Requirement: No Seed Data

The migration SHOULD NOT insert seed rows; the lab configures its own catalogs.

#### Scenario: Fresh branch starts empty

- GIVEN a new ephemeral Neon branch after migration
- WHEN any catalog table is queried
- THEN it contains zero rows

### Requirement: Catalog Mutations Write Per-Entity Audit Actions

This change MUST implement the AuditLog write path for catalog mutations. Every catalog mutation MUST write an audit log entry atomically in the same transaction as the mutation (AD-10), using per-entity action constants: `{ENTITY}_CREATED`, `{ENTITY}_UPDATED`, `{ENTITY}_DEACTIVATED`, and `{ENTITY}_REACTIVATED`, where `{ENTITY}` ∈ {`METHOD`, `TECHNIQUE`, `EQUIPMENT`, `CONTAINER`, `SAMPLE_TYPE`}. Create MUST write `_CREATED`; update MUST write `_UPDATED` with `before`/`after` snapshots; deactivate MUST write `_DEACTIVATED`; reactivate MUST write `_REACTIVATED`.
(Previously: this change MUST NOT implement AuditLog write paths — mutation actions were a recorded commitment deferred to CRUD changes 2–6.)

#### Scenario: Create writes a created action

- GIVEN a catalog row is created
- WHEN the create mutation commits
- THEN a `{ENTITY}_CREATED` audit entry is written in the same transaction

#### Scenario: Update writes before/after snapshots

- GIVEN a catalog row is updated
- WHEN the update mutation commits
- THEN a `{ENTITY}_UPDATED` audit entry with `before`/`after` snapshots is written in the same transaction

#### Scenario: Deactivate writes a deactivated action

- GIVEN a catalog row is deactivated
- WHEN the deactivate mutation commits
- THEN a `{ENTITY}_DEACTIVATED` audit entry is written in the same transaction

#### Scenario: Reactivate writes a reactivated action

- GIVEN a catalog row is reactivated
- WHEN the reactivate mutation commits
- THEN a `{ENTITY}_REACTIVATED` audit entry is written in the same transaction

#### Scenario: Audit write is atomic with the mutation

- GIVEN a mutation that will fail
- WHEN the mutation rolls back
- THEN no audit entry is written — the audit write and the mutation commit or roll back together

### Requirement: Integration Tests Verify RLS and Constraints on a Real Neon Branch

Integration tests (`vitest.integration.config.ts`, `fileParallelism: false`) MUST run against a real ephemeral Neon branch and MUST prove: unscoped queries return zero rows; tenant A cannot read tenant B rows; `quimia_app` can SELECT/INSERT/UPDATE/DELETE; FORCE RLS blocks owner bypass; ids are cuid2, unique per row; `(tenantId, name)` uniqueness is per tenant. A mocked Prisma client MUST NOT be accepted as RLS evidence.

#### Scenario: Full grant surface works as app role

- GIVEN a scoped `quimia_app` connection on a Neon branch
- WHEN SELECT/INSERT/UPDATE/DELETE run against a catalog table
- THEN each succeeds within the tenant's own rows

#### Scenario: cuid2 ids are generated per row

- GIVEN rows inserted across the five tables
- WHEN ids are inspected
- THEN each is a cuid2 id, unique per row
### Requirement: Catalog Models Support Full CRUD Operations

The system MUST implement full CRUD operations on the five catalog models (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`): create, list (read), update, deactivate, and reactivate — each mutation writing its per-entity audit entry atomically (see Catalog Mutations Write Per-Entity Audit Actions). All operations MUST go through the tenant-scoped database wrapper so that `app.tenant_id` is set and RLS (AD-2/AD-3) applies. The deactivate-not-delete contract (`isActive` flag) MUST be honored by these operations; hard delete MUST NOT occur.

#### Scenario: Create persists a new row

- GIVEN an authorized create operation
- WHEN a catalog entry is created
- THEN the row is persisted with `isActive = true` by default

#### Scenario: List returns rows ordered by name

- GIVEN existing catalog rows
- WHEN the catalog is listed
- THEN rows are returned ordered by name ascending

#### Scenario: Update mutates a row without deleting

- GIVEN an existing catalog row
- WHEN it is updated
- THEN the row's fields change and the row is not replaced or deleted

#### Scenario: Deactivate flips the flag without deleting

- GIVEN an active catalog row
- WHEN it is deactivated
- THEN `isActive` is `false` and the row still exists

#### Scenario: Reactivate restores the flag

- GIVEN an inactive catalog row
- WHEN it is reactivated
- THEN `isActive` is `true`
