# Delta for Supporting Catalogs

## RENAMED Requirements

### Requirement: AuditLog Mutation Actions Are Deferred to CRUD Changes → Catalog Mutations Write Per-Entity Audit Actions

(Reason: The audit write path is implemented in this CRUD change (2/6); "deferred" no longer describes the requirement.)
(Migration: Update any references, tests, or docs that point to the old heading. The requirement content is also modified below.)

## MODIFIED Requirements

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

## ADDED Requirements

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
