# Proposal: Study Catalog Schema (Story 2.2, Slice 1/2)

> Change `study-schema` — the schema substrate only. The Study CRUD experience ships
> separately as `configuracion-study-crud` (slice 2/2), mirroring how Story 2.1 split
> `catalog-schema-supporting` from `configuracion-catalog-crud`.

## Intent

The `Study` model does not exist today, and nothing references the five Story 2.1 catalogs
(`Method`, `Technique`, `Equipment`, `Container`, `SampleType`). That absence blocks the
entire clinical/money path:

- Reception cannot add an order line item — `OrderItem.studyId` and `OrderItem.price`
  (defaulted from the study) have no referent.
- Epic 6 container-label printing (Story 6.4) cannot derive label color or cardinality from
  any study.
- The five shipped catalogs have no consumer at all; their own spec
  (`openspec/specs/supporting-catalogs/spec.md`) states their purpose is to be "referenced by
  FK" by Study.

`Study` is the hinge entity (AD-4): the lab's definition of a billable test — its operational
attributes plus the FKs into the five 2.1 catalogs and the MXN price/tax flag that make it
sellable.

**Why the schema ships separately from its CRUD UI.** Story 2.1 needed two changes for the
same reason: its schema change landed at 771 authored lines against a 320–380 forecast
(`openspec/changes/archive/2026-10-16-catalog-schema-supporting/tasks.md` line 52), and its
CRUD UI change forecast ~1,200–1,600 lines (5 chained PRs). Story 2.2 is strictly larger than
2.1's schema half (14 attributes + 5 FKs + money + a new M2M join vs 5 tiny tables) and at
least as large on the UI half. A single combined change would be ~1,400–2,000 lines and would
blow the 400-line review budget before any honest slicing. This change is the slice that
unblocks everything downstream; shipping it alone keeps both review budgets honest.

## Scope

### In Scope

- The `Study` model in `prisma/schema.prisma` (fields, FKs into the five 2.1 catalogs, RLS
  posture, constraints).
- Back-relation fields added to the five shipped catalog models where a relation requires the
  reverse side (`Method`, `Technique`, `Equipment`, `SampleType`, `Container`).
- A `color` column added to `Container` (D1 / AD-21).
- The `Study` ↔ `Container` many-to-many join (`StudyContainer`), because a study may require
  more than one tube (e.g. serum + EDTA).
- ONE hand-appended Prisma migration: generated DDL body + hand-appended `GRANT` /
  `ENABLE` + `FORCE ROW LEVEL SECURITY` / `CREATE POLICY tenant_isolation` for every NEW
  table, applied by the owner/migration role via `DIRECT_DATABASE_URL`.
- Ratifying AD-21 in `_bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md`
  (and correcting the ERD "not a new entity" note it contradicts) — see AD-21 section below.
- Integration tests proving RLS + constraints + FK resolution + M2M cardinality on a real
  ephemeral Neon branch.

### Out of Scope (slice 2/2 — must not leak into this change)

- **No UI**: no forms, dialogs, tables, or `/configuracion/estudios` route.
- **No server actions** and no `"use server"` wrappers.
- **No registry wiring**: how Study joins `CATALOGS` / `registry.ts` and the `/configuracion`
  hub card is a design-phase input (D11), solved in slice 2/2.
- **No audit writes**: no `STUDY_CREATED/UPDATED/DEACTIVATED/REACTIVATED` action constants and
  no AuditLog write path (AD-10 binds slice 2/2, not this DDL slice).
- **No Zod schemas, no admin guard, no typed queries.**
- **No `Study` ↔ `Analyte` link** (D10) — owned by Story 2.3.
- **No e2e** (no user-visible surface exists in this slice).
- **No seed data** (2.1 contract).

## Capabilities

> Contract with `sdd-spec`. The spec phase reads this to know which delta specs to author.

### New Capabilities

- `study-catalog`: the schema contract for the `Study` model and the `Study` ↔ `Container`
  many-to-many join (`StudyContainer`) — tenant isolation (RLS/FORCE), per-tenant `code`
  uniqueness, FK integrity into the five 2.1 catalogs, MXN `Decimal(10,2)` price + tax flag,
  the four print-option booleans, and the `isActive` lifecycle.

### Modified Capabilities

- `supporting-catalogs`: the "Five Catalog Models Follow the Locked Field Contract" requirement
  changes — `Container` gains a nullable `color` column (AD-21), which lifts the "No fields
  beyond this contract MAY be added" clause for `Container`. The catalog models also gain
  relation back-references to `Study`; these are relation-only (no column change) and do not
  alter the persisted field contract. This is the only spec-level behavior change to the 2.1
  catalog capability.

## Study Field List

Conventions mirror the 2.1 catalog contract (`supporting-catalogs/spec.md` lines 9–11) and
AD-4's ratified draft. `id String @id @default(cuid(2))`, bare `tenantId String` (no FK to
`Tenant` — `AuditLog` precedent, AD-2/AD-3).

| Epic attribute | Column | Type | Nullability / default | AD trace |
|---|---|---|---|---|
| code | `code` | `String` | required | FR-5; `@@unique([tenantId, code])` (AD-8 per-tenant uniqueness, D7) |
| name | `name` | `String` | required | FR-5; **not** unique (D7) |
| area | `area` | `String` | required | FR-5; free text, no area catalog exists (D6) |
| sample type | `sampleTypeId` | `String` + `@relation` → `SampleType` | required, `onDelete: Restrict` | 2.2 AC (select from catalog, no free text); AD-6 |
| method | `methodId` | `String` + `@relation` → `Method` | required, `onDelete: Restrict` | 2.2 AC |
| technique | `techniqueId` | `String` + `@relation` → `Technique` | required, `onDelete: Restrict` | 2.2 AC |
| equipment | `equipmentId` | `String?` + `@relation` → `Equipment` | **optional**, `onDelete: Restrict` | 2.2 AC; D8 — many studies run on no instrument |
| container(s) | — | `StudyContainer[]` (M2M) | required ≥1 at app layer | 2.2 AC; AD-6 (catalog lookup); **D1 / AD-21 M2M** |
| patient preconditions | `patientConditions` | `String?` | optional | FR-5; maestro `patientCond String?` (D4) |
| processing days | `processDays` | `Int` | `@default(1)` | FR-5/FR-8; maestro `@default(1)` (D5) |
| price | `price` | `Decimal @db.Decimal(10,2)` | required | FR-5/FR-19; NFR-9 MXN (D3) |
| tax flag | `tax` | `Boolean` | `@default(false)` | FR-5; tax-inclusive vs exclusive **deferred** (D3) |
| print options | `printMethod` | `Boolean` | `@default(false)` | FR-5; maestro print set (D2) |
| print options | `printTechnique` | `Boolean` | `@default(false)` | FR-5 (D2) |
| print options | `printEquipment` | `Boolean` | `@default(false)` | FR-5 (D2) |
| print options | `printSample` | `Boolean` | `@default(false)` | FR-5 (D2) |
| lifecycle | `isActive` | `Boolean` | `@default(true)` | deactivate-not-delete (2.1 spec line 65) |
| timestamps | `createdAt` / `updatedAt` | `DateTime` | `@default(now())` / `@updatedAt` | convention |

Tenant / RLS / constraint posture (all trace to AD-2/AD-3):

- `@@map("study")`, `@@index([tenantId])`, `@@unique([tenantId, code])` — **`code` only** (D7);
  `name` is NOT unique.
- FK `onDelete: Restrict` on every catalog relation, so the DB enforces deactivate-not-delete
  and cannot orphan or cascade-delete catalog rows a study references.
- A `Study` insert carries the scoped `tenantId` (WITH CHECK), and a referenced catalog row is
  itself RLS-hidden unless it belongs to the same tenant — cross-tenant FK resolution is
  structurally impossible.

### Container change + the M2M join (D1 / AD-21)

- `Container` gains `color String?` (D1). Adding a column needs no new `GRANT` (the existing
  `GRANT ... ON "container"` is table-level and covers new columns) and no new RLS policy.
- The join MUST be an **explicit model** `StudyContainer` (`@@map("study_container")`), not
  Prisma's implicit M2M. Rationale (AD-2): RLS policies compare against a `tenantId` column on
  the table itself; an implicit `_StudyToContainer` table has no tenant column, so it could not
  be RLS-protected. `StudyContainer` therefore carries `id`, `tenantId`, `studyId`,
  `containerId`, `@@unique([studyId, containerId])` (one link per distinct container),
  `@@index([tenantId])`, and hand-appended RLS.
- Cross-tenant link prevention (a study in tenant A linking a container in tenant B) is a
  design-phase structural choice between composite FKs on `(id, tenantId)` and RLS reliance;
  the design phase MUST pick and justify one.
- **Honest correction of the exploration's framing:** back-relations themselves require **no
  catalog migration**, but the `Container.color` addition is a real column change on an
  already-shipped table, so this migration DOES contain one `ALTER TABLE "container" ADD COLUMN
  "color"`. The migration touches already-reviewed DDL, without a data migration.

## AD-21 Ratification

This change ratifies a NEW architecture decision (AD-21), because D1 has been decided as
option 3 — the only shape that satisfies Epic 6.4's dedup-by-container rule and the real
two-tube study (e.g. a chemistry panel needing serum + fluoride/oxalate). AD-21 states:

1. `Container` is a real admin-managed catalog entity (per FR-9), not per-tube order identity.
2. `Container` carries a `color`.
3. `Study` ↔ `Container` is **many-to-many** — a study may require more than one tube.
4. Epic 6 prints **one deduplicated label per distinct container** required across the order's
   studies, each carrying its study attribution and the catalog color, with the folio barcode
   identical on every label (consistent with AD-6).

**Where it lands, and whether it ships here.** AD-21 MUST be appended to
`ARCHITECTURE-SPINE.md` **as part of this change**, not deferred. Reason: F7's whole finding
(`review-adversarial-incompatibility.md` lines 241–266) is that the tube/color decision sits in
limbo — "a binding-looking sentence with no ratification status" — absent from the spine
(which documents only AD-1..AD-12). If this change builds the schema on AD-21 but leaves the
spine un-updated, it reproduces exactly the limbo F7 flagged. Ratifying AD-21 in the same
change, and correcting/restating the ERD "not a new entity" note it contradicts, is the only
way to keep the spine the single source of truth. The spine edit is a small, self-contained
documentation append executed in the apply phase.

## Approach

Schema-first slice, mirroring `catalog-schema-supporting`:

1. Extend `prisma/schema.prisma`: add `Study` and `StudyContainer`; add `color` to `Container`;
   add the relation back-references on the five catalog models.
2. Generate the migration DDL body (`prisma migrate diff` over clean history, matching 2.1 —
   see drift note below), then hand-append the RLS/GRANT block for each NEW table
   (`study`, `study_container`) verbatim in shape to the 2.1 migration (lines 109–157).
3. Append AD-21 to `ARCHITECTURE-SPINE.md` and correct the contradicting ERD note.
4. Prove RLS + constraints with integration tests on a real Neon branch.

All runtime access goes through `scoped()`/`transaction()` from `src/shared/db` (AD-3); no
`prisma.<model>` call. The wrapper is model-agnostic (`$allModels.$allOperations`) and needs
**zero changes**.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` | Modified | Add `Study` + `StudyContainer`; add `color` to `Container`; add back-relations on `Method`/`Technique`/`Equipment`/`Container`/`SampleType` |
| `prisma/migrations/<ts>_study/migration.sql` | New | One migration: `CREATE TABLE study` + `CREATE TABLE study_container` + `ALTER TABLE container ADD COLUMN color` + FKs/indexes + hand-appended RLS/GRANT for the two new tables |
| `_bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md` | Modified | Append AD-21; correct/restate the ERD "not a new entity" note |
| `tests/integration/catalog/` | New | RLS + constraints + FK resolution + M2M cardinality tests on a real Neon branch |

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–650 (exploration estimate); healthy to assume the high end given 2.1's 320–380 → 771 overshoot |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 2 stacked slices (below) |
| Delivery strategy | auto-chain (pre-decided) |
| Chain strategy | pending — resolved by orchestrator before apply |

```
Decision needed before apply: No
Chained PRs recommended: Yes
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `schema.prisma` (Study + StudyContainer + `Container.color` + back-relations) + the single hand-appended migration + AD-21 spine ratification | PR 1 (base) | Structural deliverable; est. ~165–200 authored lines. A migration is one atomic unit — it cannot be split further. |
| 2 | Integration tests (RLS fail-closed, cross-tenant isolation, FORCE, grants, FK resolution, M2M cardinality, per-tenant `code` uniqueness, defaults/Decimal fidelity, deactivate-not-delete) | PR 2 (on PR 1) | Verifies PR 1; est. ~250–350 authored lines. |

**Honest assessment.** The whole slice does **not** fit one 400-line PR: even the exploration's
low end (450) exceeds the budget, and the peer 2.1 schema change overshot its own forecast by
~2×. The 2-slice split above keeps each slice under budget while preserving a clean dependency
(PR 2 proves PR 1, retargeted onto PR 1 so its diff is clean). **Caveat:** if unit 1 alone
exceeds 400 authored lines, no further cohesive split exists (a single Prisma migration + its
hand-appended RLS is not divisible), and a maintainer-accepted `size:exception` on that slice
would be required. The final count is confirmed by `sdd-tasks` before apply.

## Testing Strategy (strict TDD: RED first)

Strict TDD is active (`openspec/config.yaml` lines 13, 39; runner `vitest run`). For a schema
change, RED-first means authoring the failing integration test (table absent / RLS not enforced)
before the migration.

- **Integration only** (`vitest.integration.config.ts`, `fileParallelism: false`), against a
  real ephemeral Neon branch (`fileParallelism: false`, `testTimeout: 120_000`). A mocked Prisma
  client MUST NOT be accepted as RLS evidence (2.1 spec line 132).
  - RLS: unscoped query returns zero rows (fail-closed); tenant A cannot read tenant B rows;
    `pg_class.relforcerowsecurity` true on `study`/`study_container` (owner-bypass guard);
    `quimia_app` full CRUD within tenant.
  - Constraints: `(tenantId, code)` uniqueness per tenant (same code across tenants allowed);
    cuid2 ids unique per row; `equipmentId` NULL allowed; `processDays` default 1; `isActive`
    default true; `Decimal(10,2)` round-trips; FK resolution against all five catalogs.
  - M2M: a study linked to two distinct containers yields two `study_container` rows and one
    link per distinct container (`@@unique([studyId, containerId])`).
- **Unit**: N/A in this slice (no Zod schemas or domain logic ship here).
- **e2e**: N/A in this slice (no user-visible surface). e2e belongs to slice 2/2 and must be run
  manually on this machine (Windows Playwright hang — see Risks).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| D1 undecided would block Epic 6 label printing and Story 2.4 | Resolved | D1 decided as option 3; AD-21 ratified in this change — downstream unblocked |
| Implicit Prisma M2M join has no tenant column → RLS impossible on the join | High if not caught | Mandate an explicit `StudyContainer` model with `tenantId` + hand-appended RLS |
| `Container.color` alters an already-shipped, already-reviewed table | Med | Additive nullable column, no data migration; migration explicitly reviewed; rollback drops it |
| Migration drift (`migrate dev` reports drift) | Med | Use `prisma migrate diff` over clean history, as 2.1 did; LF pinned by `.gitattributes` (commit `c94c0a9`), checksums reconciled on both Neon branches |
| Missing `FORCE RLS` / `GRANT` hand-edit → silent leak or P4034 | Med | Integration tests assert FORCE RLS + app-role CRUD; copy the 2.1 block verbatim |
| Decimal ↔ client-form serialization papercut | Low here | No UI in this slice; flagged for slice 2/2 (Epic 6 will hit it too) |
| Neon free-tier branch cap (10) hit during integration run | Med | Reap leaked `test-*` branches via the Neon API before the run (`deferred-work.md` lines 11–12) |
| Windows Playwright hang blocks e2e | Certain (known) | e2e is N/A here; slice 2/2 must run manually via `npx tsx scripts/e2e/start-server.ts` + `E2E_REUSE_SERVER=1 npx playwright test` (`deferred-work.md` lines 10, 40) |

## Rollback Plan

Greenfield for the new tables; no consumers and no rows exist (no UI/actions ship here).

1. `git revert` the schema + migration + spine edits (or delete the ephemeral Neon branch,
   which removes the whole applied state).
2. On a shared/long-lived branch: with the owner role, drop `study_container` then `study`
   (`DROP TABLE`), and `ALTER TABLE "container" DROP COLUMN "color"`. The dropped tables carried
   no data, so there is no data-loss concern.
3. Remove the AD-21 append and restore the ERD note.

No other table is affected by a rollback; back-relations are schema-only. Safe to revert in a
single step.

## Dependencies

- `catalog_supporting_models` migration already applied (the five catalog tables + `quimia_app`
  role exist).
- Owner-role `DIRECT_DATABASE_URL` for the migration; `NEON_API_KEY` / `NEON_PROJECT_ID` /
  `NEON_PARENT_BRANCH_ID` for integration tests.
- No dependency on slice 2/2 — this change is the prerequisite for it, not the reverse.

## Open Items

- **Tax-inclusive vs tax-exclusive price (D3)** — deliberately deferred; affects Epic 6 order
  totals. Owner: Epic 6 / the client's accountant. AD-21 does not touch it. This proposal does
  not pick one.
- **`price` nullability** — proposed required (`Decimal @db.Decimal(10,2)`); D9's "price present
  + `isActive`" wording leaves open whether a study can exist without a price. Confirm during
  design/slice 2.
- **`Container.color` nullability + format** — proposed `String?` (non-tube containers such as
  "Frasco"/"Laminilla" have no tube colour); confirm the format (name vs hex) with the design
  phase.
- **D11 — how Study joins `/configuracion` and the 5-entry `CATALOGS` registry** — a design
  input for slice 2/2; the current `registry.ts` is a 5-kind-specific `Record` with a uniform
  `{ name }` contract that Study (~14 fields, FKs, money) does not fit. Not solved here.
- **Study ↔ Analyte link (D10)** — OUT of this story; owned by Story 2.3.

## Success Criteria

- [ ] `Study` and `StudyContainer` exist in `prisma/schema.prisma` with the field list above.
- [ ] `Container` gains a `color` column; the five catalog models carry the required
      back-relations (relation-only, no other column change).
- [ ] ONE migration creates `study` + `study_container` and adds `container.color`, with
      hand-appended `FORCE RLS` + `tenant_isolation` + `GRANT quimia_app` on both NEW tables.
- [ ] Integration tests pass on a real Neon branch: fail-closed RLS, cross-tenant isolation,
      FORCE RLS, `quimia_app` CRUD, `(tenantId, code)` uniqueness, FK resolution, M2M
      cardinality, defaults/Decimal fidelity, deactivate-not-delete.
- [ ] AD-21 is appended to `ARCHITECTURE-SPINE.md` and the contradicting ERD note is corrected.
- [ ] `vitest run` green.
- [ ] NON-goals confirmed by diff: no UI, no server actions, no route/hub card, no registry
      wiring, no audit writes, no seed data, no Study↔Analyte link.
