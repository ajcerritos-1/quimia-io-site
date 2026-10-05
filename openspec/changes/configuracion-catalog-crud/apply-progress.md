# Apply Progress: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Mode

Strict TDD (RED → GREEN → REFACTOR) — resolved from `openspec/config.yaml` (`strict_tdd: true`) + test runner `vitest run`.

## Chain Strategy

`auto-chain`, `stacked-to-main` (target branch `dev` — `main` is production). Work unit 2 of 5 → PR 2 (Phase 2 only). PR creation is owned by the orchestrator/user.

---

# Slice 1 — PR 1: Registry & Shared Schemas (Phase 1)

## Slice Boundary

PR 1 (work-unit 1 of 5) — **Phase 1 only**: client-safe registry + shared schemas + unit tests. No server/DB/UI/routes.

## Completed Tasks (Slice 1)

- [x] 1.1 RED — `registry.test.ts`
- [x] 1.2 RED — `schemas.test.ts`
- [x] 1.3 GREEN — `registry.ts`
- [x] 1.4 GREEN — `schemas.ts`
- [x] 1.5 REFACTOR — full catalog suite green + no server-only/shared-db/Prisma leak

## TDD Cycle Evidence (Slice 1)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/modules/catalog/registry.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './registry'`) | ✅ Passed | ✅ 8 cases (5 keys, canonical slugs, labels, field counts, slug==key, shape, entity/prefix, href) | ✅ Clean |
| 1.2 | `src/modules/catalog/schemas.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './schemas'`) | ✅ Passed | ✅ 10 cases (uniform accept, empty-name reject, equipos require, `""`→null, `null`→null, date→Date, unknown kind reject, create no-id, update requires-id, equipos update requires) | ✅ Clean |
| 1.3 | `src/modules/catalog/registry.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (structural: one canonical shape) | ✅ Clean (zero imports) |
| 1.4 | `src/modules/catalog/schemas.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (contract from design, one discriminated union per op) | ✅ Clean (only `zod` import) |
| 1.5 | full catalog suite | Unit | — | — | ✅ `npx vitest run src/modules/catalog` → 2 files / 18 tests passed | — | ✅ Grep confirms no `server-only`, `@/shared/db`, or Prisma import |

### Test Summary (Slice 1)

- **Total tests written**: 18 (8 registry + 10 schemas)
- **Total tests passing**: 18
- **Layers used**: Unit (18)
- **Approval tests** (refactoring): None — no refactoring tasks, all new files
- **Pure functions created**: 1 (`catalogHref`) + 2 pure schema constants

## Work Unit Evidence (Slice 1)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/modules/catalog` → `Test Files 2 passed (2)` / `Tests 18 passed (18)` (exit 0) |
| Runtime harness command/scenario and exact result | `N/A` — pure client-safe modules with no server/DB/UI runtime boundary; unit assertions are the complete verification surface |
| Rollback boundary | Delete `src/modules/catalog/registry.ts`, `src/modules/catalog/schemas.ts`, `src/modules/catalog/registry.test.ts`, `src/modules/catalog/schemas.test.ts` — nothing depends on them yet |

## Notes / Deviations (Slice 1)

- `src/modules/catalog/schemas.test.ts` narrowed the discriminated-union output with `result.data.kind === "equipos"` before asserting `calibrationDate` (Zod v4 union output is not directly indexable by branch-specific keys). Behavior assertions unchanged.
- Pre-existing, unrelated `tsc` error in stale generated `.next/types/validator.ts` (`../../src/app/(app)/catalogos/page.js`) — a leftover build artifact for a `catalogos` route outside this change's scope. Not introduced by this slice.

---

# Slice 2 — PR 2: Guard, Typed Queries, Plain Actions + Integration Tests (Phase 2)

## Slice Boundary

PR 2 (work-unit 2 of 5) — **Phase 2 only** (tasks 2.1–2.8): server-only catalog admin guard, typed read queries, and four plain CRUD actions, plus their integration contract. No submit wrappers (Phase 3), no UI (Phase 4), no routes/nav/e2e (Phase 5).

## Completed Tasks (Slice 2)

- [x] 2.1 RED — `tests/integration/catalog/catalog-crud.test.ts` (full contract, written first)
- [x] 2.2 GREEN — `src/modules/catalog/server/require-catalog-admin.ts`
- [x] 2.3 GREEN — `src/modules/catalog/server/catalog-queries.ts`
- [x] 2.4 GREEN — `src/modules/catalog/server/create-catalog.action.ts`
- [x] 2.5 GREEN — `src/modules/catalog/server/update-catalog.action.ts`
- [x] 2.6 GREEN — `src/modules/catalog/server/deactivate-catalog.action.ts`
- [x] 2.7 GREEN — `src/modules/catalog/server/reactivate-catalog.action.ts`
- [ ] 2.8 REFACTOR — grep half PASSED; integration GREEN execution BLOCKED (Neon harness unavailable — see below)

## TDD Cycle Evidence (Slice 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `tests/integration/catalog/catalog-crud.test.ts` | Integration | ✅ 18/18 (`npx vitest run src/modules/catalog`) | ✅ Written — `npx tsc --noEmit` reported 20 unresolved catalog server imports + 1 `implicitly any`; integration command aborts at `Missing required env var NEON_API_KEY` | ⛔ BLOCKED (harness) — real Neon branch needed, not available in this env | ✅ 12 test cases (create+audit, dup 409, cross-tenant, equipment null date, update+snapshots, update→dup 409, update 404, deactivate, reactivate, 2 no-ops, non-admin 403+denied-audit, RLS isolation) | — |
| 2.2 | `require-catalog-admin.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (thin wrapper, one path) | ✅ Clean |
| 2.3 | `catalog-queries.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (explicit per-kind switch; design contract) | ✅ Clean |
| 2.4 | `create-catalog.action.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (5 branches; each typed create + `_CREATED`) | ✅ Clean |
| 2.5 | `update-catalog.action.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (5 branches; findUnique 404 + `_UPDATED` snapshots) | ✅ Clean |
| 2.6 | `deactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (5 branches; no-op guard + `_DEACTIVATED`) | ✅ Clean |
| 2.7 | `reactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step) | ✅ `tsc` clean | — (5 branches; no-op guard + `_REACTIVATED`) | ✅ Clean |
| 2.8 | grep audit | — | — | — | ✅ No `scoped()[string]`/`tx[...]` dynamic delegate access; all 20 `writeAuditLog(tx, ...)` calls inside their action's single `transaction()`; no `generated/prisma` import; ESLint clean | — | ✅ |

### Test Summary (Slice 2)

- **Total tests authored**: 12 integration cases in `catalog-crud.test.ts`
- **Total tests executed/passing**: 0 — integration layer is BLOCKED (Neon harness unavailable; see Work Unit Evidence)
- **Layers used**: Integration (12, authored; not executable here)
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 1 (`toIsoDate` in `catalog-queries.ts`)

## Work Unit Evidence (Slice 2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` → **BLOCKED**: `Error: Missing required env var NEON_API_KEY` thrown in `tests/setup/neon-global-setup.ts:63` before discovery. Same failure reproduced on the pre-existing `tests/integration/harness-smoke.test.ts` — the harness, not this code, is the blocker. Compile-level GREEN: `npx tsc --noEmit` → only the 2 pre-existing `.next/types/validator.ts` errors remain (all 21 catalog errors cleared). |
| Runtime harness command/scenario and exact result | `N/A` in this environment — the ephemeral Neon branch requires `NEON_API_KEY`/`NEON_PROJECT_ID`/`NEON_PARENT_BRANCH_ID` (all empty in `.env`). NO mocked Prisma client was substituted (forbidden as RLS/audit evidence). The integration GREEN must be re-run where those vars are provisioned. |
| Rollback boundary | Delete `src/modules/catalog/server/` (`require-catalog-admin.ts`, `catalog-queries.ts`, `create-catalog.action.ts`, `update-catalog.action.ts`, `deactivate-catalog.action.ts`, `reactivate-catalog.action.ts`) + `tests/integration/catalog/catalog-crud.test.ts` + revert the `catalogIdSchema`/`CatalogIdInput` addition in `src/modules/catalog/schemas.ts` — registry/schemas slice 1 (PR 1) remains and its 18 unit tests still pass. |

## Notes / Deviations (Slice 2)

- **Neon harness unavailable (blocker)**: `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID` are empty in `.env`. Strict-TDD RED could not be demonstrated as a Vitest test failure (the global setup aborts first); RED was demonstrated at the type-check layer instead (20 `TS2307 Cannot find module .../catalog/server/*` + 1 implicit-any). GREEN was verified at the type-check layer (`tsc` clean for all catalog files). No fake pass, no mocked client.
- **`catalogIdSchema` placement**: the design lists it under "Action signatures (server-only)", but it is shared by both deactivate and reactivate, so it was added to the shared `src/modules/catalog/schemas.ts` (zod-only, client-safe) as the single definition. This is the only change to a PR 1 file (+19 lines, no behavior change to existing exports).
- **Registry `entity`/`actionPrefix` used for audit metadata**: each action reads `const { entity, actionPrefix } = CATALOGS[data.kind]` once and reuses it across the five `switch` branches (task 2.4 wording), rather than repeating string literals. The branch delegate remains concrete (`tx.method`, `tx.equipment`, ...).
- **Workload overage**: Slice 2 authored ~1,131 lines (353 test + 759 server + 19 schemas), over the 400 budget — `size:exception` recommended. The overage is structural: the design mandates an explicit 5-branch `switch (kind)` for type safety in each of the 4 actions (no dynamic delegate access), and the integration contract enumerates 12 scenarios. Meeting 400 would require violating the type-safety decision or dropping spec coverage.

## Cumulative State

- Phase 1: 5/5 complete (Slice 1 / PR 1)
- Phase 2: 7/8 complete — 2.8 REFACTOR blocked on Neon harness (only the integration GREEN execution is outstanding; its grep half passed)
- Phase 3: 0/5
- Phase 4: 0/5
- Phase 5: 0/7

## Next Steps

- Re-run `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` in an environment with the Neon branch vars set, to convert Slice 2's compile-level GREEN into a real GREEN and close task 2.8.
- Then proceed to Phase 3 (submit wrappers) as work unit 3 / PR 3.
