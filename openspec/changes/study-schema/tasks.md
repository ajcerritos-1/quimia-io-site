# Tasks: Study Catalog Schema (Story 2.2, Slice 1/2)

Change: `study-schema` · Artifact store: hybrid (Engram `sdd/study-schema/tasks` + this file) · Delivery strategy: auto-chain · Review budget: 400 changed lines (`additions + deletions`)

Scope: schema substrate only — `Study`, `StudyContainer`, `Container.color`, composite tenant-scoped keys, one hand-appended migration, AD-21 spine ratification, integration tests on a real ephemeral Neon branch. Slice 2/2 (`configuracion-study-crud`) is OUT and has no tasks here.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~580 total (range 500–660). PR 1 ~320 (280–360); PR 2 ~260 (220–300) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (base: schema + migration + AD-21 spine + structural tests) → PR 2 (behavioral integrity tests, on PR 1) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Notes:
- `Decision needed before apply: No` follows from `auto-chain`. The chain strategy is NOT chosen in this artifact. The orchestrator or user must resolve it before PR 1 is opened or PR 2 is based on PR 1. Local apply of PR 1 is not blocked by it.
- Why High: the proposal forecast was 165–200 (unit 1) + 250–350 (unit 2). The composite key set (six composite FKs and six composite unique keys) and the hand-appended migration push PR 1 toward the budget. Story 2.1 overshot its 320–380 forecast at 771 lines.
- PR 1 cannot be split further. The migration is one atomic file, and splitting it would separate the schema from the DDL that backs it. If PR 1 measures above 400 after one honest pass, the recommendation is `size:exception` for PR 1. Do not shrink code, tests, or comments to fit the budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema models, `Container.color`, composite keys, one migration (DDL + RLS/GRANT for the two new tables), AD-21 spine, structural tests | PR 1 (base) | `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-schema.test.ts tests/integration/catalog/study-schema.test.ts tests/integration/catalog/container-color.test.ts` | `npx prisma validate`, then `prisma migrate deploy` with the owner role (`DIRECT_DATABASE_URL`) on one ephemeral Neon branch, then the focused run above on that same branch | Revert the migration folder, the `prisma/schema.prisma` hunks, the AD-21 append and ERD correction, and the three test files. No `src/` file is touched. |
| 2 | Behavioral proofs: RLS + FORCE, composite cross-tenant rejection (23503), `onDelete: Restrict`, M2M duplicate guard | PR 2 (on PR 1) | `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/study-rls.test.ts tests/integration/catalog/study-fk.test.ts tests/integration/catalog/study-m2m.test.ts` | Same ephemeral-branch run against the PR 1 migration, plus the mutant runs in tasks 4.2, 4.3, 4.4, and 4.5 | Test-only files. Removing PR 2 leaves PR 1 fully working. |

Base boundaries by chain strategy (set once the user decides):
- `stacked-to-main`: PR 1 → main; PR 2 is retargeted to main after PR 1 merges.
- `feature-branch-chain`: PR 1 base = tracker branch; PR 2 base = PR 1 branch. The tracker is draft/no-merge until both are integrated.
- `size-exception`: a single PR, only if PR 1 or PR 2 is over budget and a maintainer accepts it.

### Scope Boundary (slice 2/2 — excluded from every task below)

No task touches: UI, the `/configuracion/estudios` route, server actions or `"use server"`, registry or `CATALOGS` wiring (D11), `STUDY_*` audit constants or AuditLog writes (AD-10), Zod schemas, admin guards, typed queries, the Study ↔ Analyte link (D10, Story 2.3), seed data, or any `src/**` file.

- **e2e: N/A.** No user-visible surface ships in this slice. No e2e task exists.
- **Threat matrix: N/A** per the design (no command routing, subprocess, VCS/PR automation, or executable classification). No threat-matrix RED task is generated.
- **Tax semantics (D3): not decided here.** `price Decimal(10,2)` and `tax Boolean @default(false)` only.
- Settled decisions D1–D11 are not reopened.

### Items Checked Against Sources (for the orchestrator)

- Design ADR-5 says `migrate diff --from-migrations` needs no shadow database. That is incorrect: the flag replays migration history into a shadow database. Task 2.4 accounts for this.
- Design Disagreement 2 (the `supporting-catalogs` delta must enumerate `@@unique([id, tenantId])`) is already resolved. Line 7 of `specs/supporting-catalogs/spec.md` enumerates it on all five models. No spec edit is needed.
- The design's `equipment Equipment?` on `[equipmentId, tenantId]` is probably not expressible in Prisma (see task 2.3). This is the one structural risk that can change the schema shape.

## TDD Order Rules

- Per behavioral unit: the RED test file is authored and run first, and its failure reason is recorded. The failure must be the stated reason (missing table, missing column, no 23503), not a syntax or import error.
- PR 1 RED tests (phase 1) are all written and failing before any schema or migration edit (phase 2).
- PR 2 tests are characterization plus mutation-RED. Each guarantee is shown to fail when the guarantee is removed on a mutant branch, then shown green on the real PR 1 migration. Mutant edits are temporary, are never committed, and their branches are deleted.
- Commit rule (work-unit-commits): each commit holds tests together with the code they verify. RED failures are recorded as apply evidence, not as failing commits. Each PR must be green on its own.

## Phase 1: Preflight and RED Tests (PR 1)

- [x] 1.1 Preflight the Neon project. Delete leaked `test-*` branches (see the deferred-work notes, lines 11–12) until at least 2 free slots remain under the free-tier cap of 10 (one for the PR 1 run, one for a PR 2 mutant). Verify: branch count before and after is recorded, and the `dev` branch lists all 5 existing migrations in `_prisma_migrations`, the latest being `20260907234515_catalog_supporting_models`.
- [x] 1.2 Record the LF baseline. Run `git ls-files --eol prisma/migrations` (read-only). Verify: every existing migration file reports `i/lf`, with no `crlf` entries. Record the output as evidence before any new migration is written.
- [x] 1.3 RED (existing test). Edit `tests/integration/catalog/catalog-schema.test.ts`: the Container column-set test (currently "Container carries only the locked catalog columns") must expect `color` as an additional nullable column, and its title must change to match. Do not change the other 2.1 assertions. Run the focused PR 1 command. Verify: the Container test FAILS with a message naming the missing `color` column; the other 2.1 tests are unchanged.
- [x] 1.4 RED (structure). Create `tests/integration/catalog/study-schema.test.ts`, section "structure": `study` has exactly the 20 spec R1 columns (`id`, `tenantId`, `code`, `name`, `area`, `sampleTypeId`, `methodId`, `techniqueId`, `equipmentId`, `patientConditions`, `processDays`, `price`, `tax`, `printMethod`, `printTechnique`, `printEquipment`, `printSample`, `isActive`, `createdAt`, `updatedAt`). `study_container` has exactly `id`, `tenantId`, `studyId`, `containerId`. Required/nullable split matches spec R1. The join is `study_container`, and no `_StudyToContainer` table exists. Run. Verify: FAILS because the tables are absent.
- [x] 1.5 RED (uniqueness and money). Add to `study-schema.test.ts`, section "uniqueness and money": a duplicate `(tenantId, code)` within one tenant is rejected with 23505; the same `code` in another tenant is allowed; a duplicate `name` with a different code is allowed; `price` `1234.56` round-trips as `Decimal(10,2)`. Use a per-tenant catalog fixture seeded through the owner role with `set_config('app.tenant_id', …)`, because `FORCE RLS` applies to the owner. Run. Verify: FAILS because `study` is absent. The fixture helper itself must not be the failure reason.
- [x] 1.6 RED (defaults, nullables, identity, no seed). Add to `study-schema.test.ts`, section "defaults and identity": `processDays` = 1, `isActive` = true, `tax` = false, and the four print flags = false on insert without explicit values; `equipmentId` NULL and `patientConditions` NULL accepted; ids created through the existing `scoped()` wrapper (read-only: `src/shared/db`) are cuid2 and unique per row; the migration folder contains no `INSERT` or `COPY` statements (static check, spec R10). Run. Verify: FAILS (tables absent; migration file absent).
- [x] 1.7 RED (color). Create `tests/integration/catalog/container-color.test.ts`: a `Container` "tubo lila EDTA" with `color` = "lila" persists the value; a `Container` "Frasco" created without `color` stores NULL; `quimia_app` can read and write `color` with no new GRANT. Run. Verify: FAILS because the `color` column is absent.
- [x] 1.8 Gate: all phase-1 RED failures are recorded with their exact failure reasons. No schema or migration file has been edited yet. Verify: `git diff --name-only` lists only the test files.

## Phase 2: Schema and Migration GREEN (PR 1)

- [x] 2.1 GREEN (catalog keys). Edit `prisma/schema.prisma`: add `color String?` to `Container` with an AD-21 comment (nullable because non-tube containers have no tube colour). Add `@@unique([id, tenantId])` to `SampleType`, `Method`, `Technique`, `Equipment`, and `Container`. These are index-only and add no persisted column. Verify: `npx prisma validate` exits 0.
- [x] 2.2 GREEN (Study models). Edit `prisma/schema.prisma`:
  - Add `model Study` with the exact spec R1 fields. Add four composite relations, each `fields: [xId, tenantId]`, `references: [id, tenantId]`, `onDelete: Restrict`, with distinct `map` names: `study_sample_type_fkey`, `study_method_fkey`, `study_technique_fkey`, `study_equipment_fkey`. Add `@@unique([tenantId, code])`, `@@unique([id, tenantId])`, `@@index([tenantId])`, and `@@map("study")`. `name` is not unique.
  - Add `model StudyContainer` (`id`, `tenantId`, `studyId`, `containerId`, no timestamps). Add composite relations `study_container_study_fkey` and `study_container_container_fkey`, both `onDelete: Restrict`. Add `@@unique([studyId, containerId])`, `@@index([tenantId])`, and `@@map("study_container")`.
  - Add back-relations: `studies Study[]` on `SampleType`, `Method`, `Technique`, and `Equipment`; `studyContainers StudyContainer[]` on `Container`.
  Verify: the file matches design "Prisma Model Definitions" except where task 2.3 forces a change.
- [x] 2.3 GATE (Prisma expressibility). Run `npx prisma validate`, then `npx prisma generate`. Both must exit 0. KNOWN RISK: Prisma requires an optional relation field to have all of its FK scalars optional. `equipment Equipment?` over `[equipmentId, tenantId]` mixes an optional scalar with a required one, so validate is likely to reject it. The other five composite relations have required scalars and are expected to validate.
  If validate fails: STOP. Save the exact validator output as evidence. Do NOT hand-write the equipment FK in SQL to get around the validator, do NOT make `equipmentId` required (that breaks D8 and spec scenario "equipmentId may be NULL"), and do NOT drop the composite guarantee for equipment without a decision. Escalate to the orchestrator and user with these options, and wait for a decision:
  (a) re-enter sdd-design to find a Prisma-expressible equipment guarantee;
  (b) accept a single-column `equipmentId` FK for equipment only, which reopens the cross-tenant gap for that one relation and contradicts spec R2, and needs explicit approval;
  (c) amend spec R2 and R5 for the equipment case.
  Verify: validate and generate both exit 0, or the escalation is recorded and no FK was hand-written.
- [x] 2.4 GREEN (DDL body). Generate the DDL into a new `prisma/migrations/<timestamp>_study/migration.sql` (timestamp chosen at generation, after `20260907234515`). Use `npx prisma migrate diff --from-config-datasource <ephemeral-branch-url-env> --to-schema-datamodel prisma/schema.prisma --script`, run against an ephemeral branch that already has the 5 migrations applied. Do NOT use `--from-migrations` without a shadow database: it replays history into a shadow DB, which contradicts design ADR-5 ("no shadow database"). Do NOT use `migrate dev`. Verify: the emitted body contains only: `ALTER TABLE "container" ADD COLUMN "color" TEXT`; `CREATE TABLE "study"` and `CREATE TABLE "study_container"`; the six composite `CREATE UNIQUE INDEX` statements (`study_id_tenantId_key`, `method_id_tenantId_key`, `technique_id_tenantId_key`, `equipment_id_tenantId_key`, `container_id_tenantId_key`, `sample_type_id_tenantId_key`); `study_tenantId_code_key`; the two `_idx` indexes; `study_container_studyId_containerId_key`; and six `ADD CONSTRAINT … FOREIGN KEY ("…", "tenantId") … ON DELETE RESTRICT` statements. There must be no DROP and no change to any other table.
- [x] 2.5 GREEN (hand-appended RLS/GRANT). Append to the same `prisma/migrations/<timestamp>_study/migration.sql` the block for `study` and `study_container` only: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO quimia_app`; `ENABLE ROW LEVEL SECURITY`; `FORCE ROW LEVEL SECURITY`; `CREATE POLICY tenant_isolation` with `USING` and `WITH CHECK` both on `"tenantId" = current_setting('app.tenant_id', true)`. Shape must match the 2.1 migration block. Add no grant or policy for `container`, since the existing table-level grant covers `color`. Verify: exactly 2 `FORCE ROW LEVEL SECURITY` and 2 `CREATE POLICY` statements, and no `GRANT` on `container` in this file.
- [x] 2.6 GATE (LF). Verify `prisma/migrations/<timestamp>_study/migration.sql` contains zero CR bytes (check raw bytes, not the console rendering) and that `git ls-files --eol` reports `w/lf` for it. `.gitattributes` pins `prisma/migrations/** text eol=lf` (commit `c94c0a9`), and CRLF would record a different sha256 and reintroduce the checksum drift. If it fails, rewrite the file with LF endings, re-verify, and do not apply it until it passes.
- [x] 2.7 Apply. Run `prisma migrate deploy` with `DIRECT_DATABASE_URL` (the owner role) against the ephemeral branch. Never use `quimia_app` for DDL. Verify: `_prisma_migrations` records the new migration as applied; `pg_class.relrowsecurity` and `relforcerowsecurity` are true on `study` and `study_container`; the six composite foreign keys and the composite unique indexes exist.
- [x] 2.8 GREEN (PR 1 tests). Run the PR 1 focused command against the migrated ephemeral branch. Expected: tasks 1.3–1.7 PASS. If a test fails, fix the schema or migration, not the test, and re-run. Verify: exact pass count recorded, and no mock Prisma client is used as RLS evidence.

## Phase 3: AD-21 Spine and PR 1 Close

- [x] 3.1 Insert the AD-21 block into `_bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md` under `## Invariants & Rules`, after the AD-12 block and before `### Dependency direction`. Use the exact text from design section "AD-21 Ratification", heading `### AD-21 — Container/tube catalog and label cardinality [ADOPTED]`. Anchor by heading text, not by the approximate line numbers in the design. Verify: the AD-21 heading appears exactly once, and heading order is AD-12 → AD-21 → Dependency direction.
- [x] 3.2 Correct the ERD note in the same spine file. Replace the bullet beginning "`Study` needs a `tubeType`/`tubeColor` catalog attribute" with the strikethrough superseded pointer from the design. Verify: searching the file for `tubeType` finds only the superseded line.
- [x] 3.3 Confirm the PR 1 file set. Verify with `git diff --name-only`: changes are limited to `prisma/schema.prisma`, the new migration folder, the spine file, `tests/integration/catalog/catalog-schema.test.ts`, `study-schema.test.ts`, and `container-color.test.ts`. No `src/` path and no `prisma.<model>` call appear in the diff.
- [x] 3.4 Run the full regression suite (`vitest run`) against the ephemeral branch. Verify: the existing 2.1 suites `catalog-crud.test.ts` and `catalog-rls.test.ts` remain green. `color` and the composite keys must not break them.
- [x] 3.5 Measure PR 1 with `git diff --numstat`, summing additions and deletions over all PR 1 files, with the migration counted in full. Verify: total ≤ 400. If over, make one honest slicing pass only. Do not delete tests, comments, or docs. Report the count and recommend `size:exception` for PR 1.
- [x] 3.6 Commit PR 1 as one conventional work-unit commit with its tests (for example `feat(catalog): add study and study-container schema with composite tenant keys`), only if the orchestrator authorizes commits. Verify: `git show --stat` lists the PR 1 file set, and the message carries no AI attribution.

## Phase 4: PR 2 (Behavioral Proofs, on PR 1)

- [x] 4.1 Characterization (FK resolution). Create `tests/integration/catalog/study-fk.test.ts`, section "resolution": a study referencing all five catalogs resolves each one; `methodId` pointing at a missing row fails with 23503; a deactivated `Method` (`isActive = false`) remains referenceable. Run against PR 1. Verify: PASSES. Record it as characterization, not RED.
- [x] 4.2 RED by mutation (cross-tenant composite FK, spec R2 and R5). Add to `study-fk.test.ts`, section "cross-tenant": (a) a tenant-A study referencing tenant B's `Method` by `methodId` is rejected with 23503; (b) a tenant-A `study_container` row referencing tenant B's `Container` is rejected with 23503. Seed tenant B through the owner role with `set_config`. Run on the real PR 1 migration. Verify: PASSES. Then, on a separate ephemeral branch, apply a temporary mutant migration where `study_method_fkey` and `study_container_container_fkey` are single-column (`FOREIGN KEY ("methodId")`, `FOREIGN KEY ("containerId")`). Re-run (a) and (b). Verify: both inserts succeed, so the test FAILS as expected. Discard the mutant and delete its branch. Record the output.
- [x] 4.3 RED by mutation (`onDelete: Restrict`, spec R3). Add to `study-fk.test.ts`, section "restrict": a referenced `Method` and a referenced `Container` cannot be deleted by the owner (23503); the study's FK is not orphaned. Run on PR 1: PASSES. On a mutant branch, change the `study_method_fkey` action to `ON DELETE CASCADE` and re-run. Verify: the delete succeeds, so the test FAILS as expected. Discard the mutant and its branch. Record the output.
- [x] 4.4 RED by mutation (M2M, spec R5). Create `tests/integration/catalog/study-m2m.test.ts`: a study linked to two distinct containers (serum + EDTA) yields exactly two `study_container` rows; a duplicate `(studyId, containerId)` is rejected with 23505. Run on PR 1: PASSES. On a mutant branch, drop the `study_container_studyId_containerId_key` unique index and re-run. Verify: the duplicate is accepted, so the test FAILS as expected. Discard the mutant and its branch. Record the output.
- [x] 4.5 RED by mutation (RLS, spec R8). Create `tests/integration/catalog/study-rls.test.ts`: `relrowsecurity` and `relforcerowsecurity` are true on `study` and `study_container`; `pg_policies` shows `tenant_isolation` with `USING` and `WITH CHECK` on `app.tenant_id`; an unscoped `quimia_app` SELECT returns zero rows (fail-closed); tenant A cannot read tenant B rows; `quimia_app` has full CRUD within its tenant. Owner bypass is verified structurally through `relforcerowsecurity`, not by a literal owner SELECT, because the Neon branch owner bypasses RLS on the harness (same deviation documented in the 2.1 RLS test). Run on PR 1: PASSES. Mutants, each on its own branch and discarded: (i) remove `FORCE ROW LEVEL SECURITY` on `study`, expecting a FAIL on the force assertion; (ii) remove `WITH CHECK` from the `study_container` policy, expecting a tenant-A insert with tenant-B `tenantId` to succeed and the test to FAIL. Record both outputs.
- [x] 4.6 GREEN on the real branch. Run the PR 2 focused command against the unmodified PR 1 migration. Verify: all PR 2 tests PASS, `git diff --name-only` for PR 2 shows only `tests/integration/catalog/*`, and no mutant edit remains in the working tree.
- [x] 4.7 Measure PR 2 with `git diff --numstat` and verify ≤ 400. Commit PR 2 as a test-only conventional commit (for example `test(catalog): prove study RLS, composite FK, and M2M guarantees`), only if the orchestrator authorizes commits. Verify: `git show --stat` contains no `prisma/` or `src/` path.

## Phase 5: Close

- [x] 5.1 Reap every ephemeral branch created by validation, mutant, and test runs. Verify: final branch count is recorded and is below the cap of 10.
- [x] 5.2 Confirm the NON-goals by diff review. Verify: no `src/` change, no `/configuracion` route, no `"use server"`, no `STUDY_*` or AuditLog reference, no Zod schema, no seed `INSERT` in the migration, and no e2e file added or changed.
- [x] 5.3 Record the actual line counts for PR 1 and PR 2 against the forecast (~320 and ~260). If either is over budget, record the overage and its cause for the next planning cycle. Story 2.1 went from 320–380 to 771, so the estimate must be re-checked against actuals.
- [x] 5.4 Record RED and GREEN evidence per task in the apply report. Include the exact failure reason for each RED, the mutant identity for each mutation run, and the final pass counts.

## Known Risks

- Prisma validate may reject the optional composite `equipment` relation (task 2.3). This is the only item that can change the schema shape. The gate and escalation are defined there.
- `migrate diff --from-migrations` needs a shadow database. Task 2.4 uses an already-migrated ephemeral branch instead. This is a workflow change from design ADR-5 and should be confirmed by the orchestrator.
- The Neon free-tier cap of 10 branches is tight: PR 1 run, PR 2 run, DDL-body branch, and up to five mutant branches. Reap aggressively (tasks 1.1, 5.1).
- LF checksum drift (task 2.6): a CRLF migration file reintroduces the drift fixed in `c94c0a9`.
- Chain strategy is pending. It does not block local apply of PR 1 but must be resolved before PR 1 is opened.
- `tax` semantics (D3) remain open. Epic 6 owns the decision.
