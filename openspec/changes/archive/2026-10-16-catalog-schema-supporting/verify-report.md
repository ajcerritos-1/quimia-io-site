# Verify Report: catalog-schema-supporting

**Change**: catalog-schema-supporting (Story 2.1, change 1/6) — commit acd4c5b on `dev`
**Mode**: Strict TDD (`vitest run`)
**Date**: 2026-09-09

## VERDICT: PASS

The committed schema-only change conforms to the `supporting-catalogs` spec (7 MUST requirements, 14 scenarios), the design, and the task list. All evidence below was gathered fresh against the real state at acd4c5b (working tree untouched, nothing committed).

## Evidence summary

| Check | Result | Notes |
|---|---|---|
| Prisma models (R1) | PASS | 5 models match the locked contract; Equipment adds required `model`/`serialNumber` + nullable `calibrationDate`; bare `tenantId`; `@@unique([tenantId,name])`; `@@index([tenantId])`; `@@map` snake_case; no fields beyond the contract |
| Migration SQL (R2) | PASS | 5x CreateTable + CreateIndex; per table GRANT SELECT/INSERT/UPDATE/DELETE to `quimia_app` + ENABLE + FORCE RLS + `tenant_isolation` policy (USING + WITH CHECK on `app.tenant_id`); zero DROP POLICY / REVOKE / DROP TABLE / INSERT / COPY |
| Catalog integration tests | PASS | `catalog-rls.test.ts` 5/5 + `catalog-schema.test.ts` 9/9 = **14/14** on a fresh ephemeral Neon branch (migration applied cleanly, no mocks) |
| RLS security assertions | PASS | Closed-by-default unscoped SELECT returns 0 rows; tenant-A scoped query sees zero tenant-B rows; `relforcerowsecurity` true on all five tables; `quimia_app` SELECT/INSERT/UPDATE/DELETE within its tenant; `pg_policies.with_check` scopes the write path on all five; per-tenant unique (23505 in-tenant, same name allowed cross-tenant) |
| Spec scenarios | PASS | 14/14 — 13 proven by passing tests, R6 (no AuditLog writes) proven by diff review |
| Tasks | PASS | All checkboxes done; TDD Cycle Evidence table present in apply-progress; RED (tests existed and errored with 42P01 pre-migration) and GREEN (14/14 on a real branch) re-confirmed by execution |
| Unit suite | PASS | `npm test` — 50/50 (10 files) |
| Type check | PASS | `npx tsc --noEmit` — 0 errors |
| Lint | PASS | `npm run lint` — 0 errors |
| Prisma validate | PASS | schema valid; client regenerated |
| Build | Environmental | `next build` could not finish: `next/font` fetch of Geist/Geist Mono from fonts.googleapis.com is unreachable on this network. No src file is in this change's diff — unrelated to the schema |
| Full integration suite (this machine) | Environmental | 74 pass / 11 unmet / 17 skipped; all 11 unmet sit in pre-existing auth suites (`auth-sign-in-lockout`, `auth-deactivate-user`, 3 suite-scope) from Neon connection drops under a degraded network. Catalog files green in-suite; the unmet files are unmodified by this change (`git diff HEAD~1..HEAD`) |

## Deviations from design (documented in apply-progress; none weaken the spec)

- R5 zero-rows proven statically (migration file contains no INSERT/COPY) instead of a dynamic fresh-branch query — order-independent on the shared single-branch harness.
- R2 "owner cannot bypass isolation" proven structurally via `pg_class.relforcerowsecurity` — a literal owner-SELECT-zero-rows is not reproducible on the Neon harness (the branch-owner role demonstrably bypasses RLS there), per the design note.

## Residual items (do not gate archive)

- Pre-existing Neon drift, not introduced here: the dev database (and the parent branch) lack the `audit_log_entityId_idx` index the migration history declares, which prevents `prisma migrate dev` from running. Re-apply the index before the next change runs migrate dev.
- 2 ephemeral Neon branches leaked by runs whose teardown was interrupted by the network instability: `br-nameless-salad-ax7rkpar` (`test-local-1788919049714`) and `br-still-tree-ax64r6lm` (`test-local-1788920817017`). Remove per `docs/neon-branch-cleanup.md`.
- Re-run the full integration suite and `next build` from a stable network for a fully green gate — this machine had intermittent DNS/connection loss to Neon and Google Fonts.

## Skill resolution

`paths-injected` — sdd-verify SKILL.md, strict-tdd-verify.md, references/report-format.md, and `_shared/sdd-phase-common.md` were loaded per the orchestrator's injected skills block.
