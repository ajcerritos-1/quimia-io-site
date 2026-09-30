# Apply Progress: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Mode

Strict TDD (RED → GREEN → REFACTOR) — resolved from `openspec/config.yaml` (`strict_tdd: true`) + test runner `vitest run`.

## Slice Boundary

PR 4 (auto-chain, work-unit 4 of 5) — **Phase 4 only**: the four `src/modules/catalog/ui/` client components (generic form + create/edit dialogs + table). Phases 1–3 (PR 1 + PR 2 + PR 3) are complete and preserved below. No routes/nav/e2e (PR 5).

---

## Phase 1 (PR 1 — completed in prior slice, preserved verbatim)

### Completed Tasks (Phase 1)

- [x] 1.1 RED — `registry.test.ts`
- [x] 1.2 RED — `schemas.test.ts`
- [x] 1.3 GREEN — `registry.ts`
- [x] 1.4 GREEN — `schemas.ts`
- [x] 1.5 REFACTOR — full catalog suite green + no server-only/shared-db/Prisma leak

### TDD Cycle Evidence (Phase 1)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/modules/catalog/registry.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './registry'`) | ✅ Passed | ✅ 8 cases (5 keys, canonical slugs, labels, field counts, slug==key, shape, entity/prefix, href) | ✅ Clean |
| 1.2 | `src/modules/catalog/schemas.test.ts` | Unit | N/A (new file) | ✅ Written (fails: `Cannot find module './schemas'`) | ✅ Passed | ✅ 10 cases (uniform accept, empty-name reject, equipos require, `""`→null, `null`→null, date→Date, unknown kind reject, create no-id, update requires-id, equipos update requires) | ✅ Clean |
| 1.3 | `src/modules/catalog/registry.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (structural: one canonical shape) | ✅ Clean (zero imports) |
| 1.4 | `src/modules/catalog/schemas.ts` | — | N/A | — (GREEN step) | ✅ Passed | — (contract from design, one discriminated union per op) | ✅ Clean (only `zod` import) |
| 1.5 | full catalog suite | Unit | — | — | ✅ `npx vitest run src/modules/catalog` → 2 files / 18 tests passed | — | ✅ Grep confirms no `server-only`, `@/shared/db`, or Prisma import |

### Test Summary (Phase 1)

- **Total tests written**: 18 (8 registry + 10 schemas)
- **Total tests passing**: 18
- **Layers used**: Unit (18)
- **Approval tests** (refactoring): None — no refactoring tasks, all new files
- **Pure functions created**: 1 (`catalogHref`) + 2 pure schema constants

### Work Unit Evidence (Phase 1)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/modules/catalog` → `Test Files 2 passed (2)` / `Tests 18 passed (18)` (exit 0) |
| Runtime harness command/scenario and exact result | `N/A` — pure client-safe modules with no server/DB/UI runtime boundary; unit assertions are the complete verification surface |
| Rollback boundary | Delete `src/modules/catalog/registry.ts`, `src/modules/catalog/schemas.ts`, `src/modules/catalog/registry.test.ts`, `src/modules/catalog/schemas.test.ts` — nothing depends on them yet |

---

## Phase 2 (PR 2 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 2)

- [x] 2.1 RED → GREEN — `tests/integration/catalog/catalog-crud.test.ts` (17 integration tests, full contract). GREEN: `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` → `Test Files 1 passed (1)` / `Tests 17 passed (17)` (exit 0, 93.62s).
- [x] 2.2 GREEN — `src/modules/catalog/server/require-catalog-admin.ts` (thin `requireRole([admin])` wrapper, `entity` param, `CATALOG_ADMIN_ACTION_DENIED`, `attemptedAction` union, optional `entityId`). Verified by 2.1's denial scenarios.
- [x] 2.3 GREEN — `src/modules/catalog/server/catalog-queries.ts` (`listCatalogRows` / `countActive` / `getCatalogStats`, explicit typed `switch (kind)`, `SerializedCatalogRow`). Verified by 2.1 ordering + RLS-isolation + stats tests.
- [x] 2.4 GREEN — `src/modules/catalog/server/create-catalog.action.ts` (Zod 400, guard, `transaction` + typed `switch` + `{ENTITY}_CREATED` audit in same tx, 409 on P2002). Verified.
- [x] 2.5 GREEN — `src/modules/catalog/server/update-catalog.action.ts` (404 on missing row, `{ENTITY}_UPDATED` with before/after snapshots incl. equipment full snapshot, 409 on P2002; **always writes audit — no before≡after no-op**, per resolved open question). Verified.
- [x] 2.6 GREEN — `src/modules/catalog/server/deactivate-catalog.action.ts` (exports `catalogIdSchema` + `CatalogIdInput`; no-op guard skips mutation AND audit; `{ENTITY}_DEACTIVATED` in same tx). Verified.
- [x] 2.7 GREEN — `src/modules/catalog/server/reactivate-catalog.action.ts` (mirror of deactivate; `{ENTITY}_REACTIVATED`). Verified.
- [x] 2.8 REFACTOR — full Phase 2 surface verified: integration 17/17 green, `tsc --noEmit` exit 0, Phase 1 unit 18/18 still green, grep confirms no dynamic delegate access and all `writeAuditLog` calls inside `transaction()` callbacks.

### TDD Cycle Evidence (Phase 2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `tests/integration/catalog/catalog-crud.test.ts` | Integration | N/A (new file) | ✅ Written (17 tests; imports referenced non-existent `server/` modules → failed by construction) | ✅ **Passed — 17/17** (real ephemeral Neon branch) | ✅ 17 cases (create+audit per kind, equipos null/date calibration, dup 409 + no row, cross-tenant allowed, update before/after, equipment update snapshot, update-dup 409, deactivate no-delete, reactivate, deactivate-inactive no-op, reactivate-active no-op, quimico/recepcionista 403 + `CATALOG_ADMIN_ACTION_DENIED`, list ordering + RLS isolation, stats counts) | ✅ Clean |
| 2.2 | `src/modules/catalog/server/require-catalog-admin.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 denial scenarios) | ✅ Passed | — (single thin wrapper, contract from design) | ✅ Clean (grep: no dynamic access) |
| 2.3 | `src/modules/catalog/server/catalog-queries.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 list/stats scenarios) | ✅ Passed | — (typed switch per kind) | ✅ Clean (grep: no dynamic access) |
| 2.4 | `src/modules/catalog/server/create-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 create scenarios) | ✅ Passed | — (5-kind switch triangulated in 2.1) | ✅ Clean |
| 2.5 | `src/modules/catalog/server/update-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 update scenarios) | ✅ Passed | — (name-only + equipment full snapshot) | ✅ Clean |
| 2.6 | `src/modules/catalog/server/deactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 deactivate/no-op scenarios) | ✅ Passed | — (no-op guard triangulated) | ✅ Clean |
| 2.7 | `src/modules/catalog/server/reactivate-catalog.action.ts` | — | N/A (new) | — (GREEN step; RED = 2.1 reactivate/no-op scenarios) | ✅ Passed | — (mirror of deactivate) | ✅ Clean |
| 2.8 | full Phase 2 surface | Integration + static | ✅ 18/18 unit (Phase 1) | — | ✅ Integration 17/17 | — | ✅ `tsc --noEmit` exit 0; Phase 1 unit 18/18; grep: zero `scoped()[string]` dynamic keys, `writeAuditLog` only inside `transaction()` callbacks |

### Test Summary (Phase 2)

- **Total tests written**: 17 (integration, `catalog-crud.test.ts`)
- **Total tests passing**: 17/17 (integration) + 18/18 (Phase 1 unit regression)
- **Layers used**: Integration (17)
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (queries/actions are IO-bound; `catalogHref` from Phase 1 reused)

### Work Unit Evidence (Phase 2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run --config vitest.integration.config.ts tests/integration/catalog/catalog-crud.test.ts` → `Test Files 1 passed (1)` / `Tests 17 passed (17)` (exit 0; 93.62s) |
| Runtime harness command/scenario and exact result | Real ephemeral Neon branch created off the parent, `prisma migrate deploy` → "No pending migrations to apply", `provision-app-role.ts` minted a fresh `quimia_app` password, all 17 tests drove real Prisma/RLS/audit paths |
| Rollback boundary | Delete `src/modules/catalog/server/` (`require-catalog-admin.ts`, `catalog-queries.ts`, `create-catalog.action.ts`, `update-catalog.action.ts`, `deactivate-catalog.action.ts`, `reactivate-catalog.action.ts`) + `tests/integration/catalog/catalog-crud.test.ts` — registry/schemas (PR 1) remain and their tests still pass |

---

## Phase 3 (PR 3 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 3)

- [x] 3.1 GREEN — `src/modules/catalog/server/submit-create-catalog.action.ts` (file-level `"use server"`; `submitCreateCatalog(formData): Promise<SubmitCatalogResult>`; headers() → `tenantId`/`requestId` with `UNRESOLVED_TENANT` guard; FormData → `CreateCatalogInput` mapping with `calibrationDate` `""`→`null` and `model`/`serialNumber` only for `kind === "equipos"`; `AppError` → `{ ok, message, fieldErrors }`; double `revalidatePath` after success).
- [x] 3.2 GREEN — `src/modules/catalog/server/submit-update-catalog.action.ts` (`submitUpdateCatalog`; same mapping + `id` from a hidden input; calls `updateCatalog`).
- [x] 3.3 GREEN — `src/modules/catalog/server/submit-deactivate-catalog.action.ts` (`submitDeactivateCatalog`; maps hidden `{ kind, id }` → `CatalogIdInput`; calls `deactivateCatalog`).
- [x] 3.4 GREEN — `src/modules/catalog/server/submit-reactivate-catalog.action.ts` (`submitReactivateCatalog`; maps hidden `{ kind, id }`; calls `reactivateCatalog`).
- [x] 3.5 Verify — `npx tsc --noEmit` exit 0; `npx next build` exit 0 (Turbopack, "Compiled successfully in 16.7s", 7/7 static pages) with NO Prisma/`pg`-in-client error.

### TDD Cycle Evidence (Phase 3)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (no isolated unit boundary for file-level glue — NOT a test-first RED; prescribed verification is tsc + next build; wrapper exercised end-to-end by PR 5's e2e) | ✅ `npx tsc --noEmit` exit 0 (FormData→input mapping + AppError→result translation type-checked) | — (mapping cases: equipos full set incl. `""`→null, uniform kinds name-only — covered by tsc narrowing) | ✅ Clean |
| 3.2 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (hidden `id` mapping + equipos superset) | ✅ Clean |
| 3.3 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (`{ kind, id }` → `CatalogIdInput`) | ✅ Clean |
| 3.4 | — (no unit-test boundary) | Server Action glue (`"use server"`) | Phase 2 integration 17/17 + Phase 1 unit 18/18 | — (same glue note as 3.1) | ✅ `npx tsc --noEmit` exit 0 | — (mirror of 3.3) | ✅ Clean |
| 3.5 | — (static/build gate) | Build | — | — | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 — no Turbopack error from Prisma/`pg` leaking into the client bundle (the reason these live in their own `"use server"` files) | — | ✅ Grep: wrappers import only next/headers, next/cache, middleware const, shared errors, registry, schemas, and the plain action |

### Test Summary (Phase 3)

- **Total tests written**: 0 (no unit-test boundary for file-level glue — see evidence note)
- **Total tests passing**: N/A (static/build verification instead) — Phase 1 unit 18/18 + Phase 2 integration 17/17 remain the behavioral safety net, untouched by this slice
- **Layers used**: Static type-check (`tsc --noEmit`) + production build (`next build`), per tasks.md 3.5 and the design's Testing Strategy
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (per-wrapper `calibrationDateOrNull` normalization is a private 1-liner; `catalogHref` reused from Phase 1)

### Work Unit Evidence (Phase 3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx tsc --noEmit` → exit 0 (clean, ~0 output). `npx next build` → exit 0: `✓ Compiled successfully in 16.7s`, `Finished TypeScript in 25.5s`, `✓ Generating static pages ... (7/7) in 2.7s`. No Turbopack/Prisma-`pg`-in-client error. |
| Runtime harness command/scenario and exact result | `N/A` — no client consumer exists until PR 4 mounts the form; the wrappers are exercised end-to-end by PR 5's e2e (`tests/e2e/configuracion.spec.ts`), per tasks.md Work Unit 3 row. |
| Rollback boundary | Delete the 4 `submit-*.action.ts` files (`submit-create-catalog`, `submit-update-catalog`, `submit-deactivate-catalog`, `submit-reactivate-catalog`) — plain actions (PR 2) remain intact and still tested |

---

## Phase 4 (PR 4 — this slice: implemented AND verified GREEN)

### Completed Tasks (Phase 4)

- [x] 4.1 GREEN — `src/modules/catalog/ui/catalog-form.tsx` — generic `CatalogForm({ kind, initialValues?, firstFieldRef?, onSuccess?, onCancel? })`. Renders one `Field` + `Input` per `CATALOGS[kind].fields` entry (NO per-kind branching; `type: "date"` renders `<Input type="date">` for equipment's `calibrationDate`). `initialValues` present → edit mode (uncontrolled `defaultValue` pre-fill, hidden `id` input, calls `submitUpdateCatalog`); absent → create mode (calls `submitCreateCatalog`). Client-side `catalogCreateSchema`/`catalogUpdateSchema` `safeParse` blocks submit and shows `fieldErrors`; `useActionState` handles the server result; `useEffect(state.ok)` fires `onSuccess`. Exports the client-safe `CatalogRow` interface (structural twin of server `SerializedCatalogRow` — the server file is `server-only`, AD-3). Pattern: `create-user-form.tsx` (read-only).
- [x] 4.2 GREEN — `src/modules/catalog/ui/catalog-create-dialog.tsx` — `Button` "Crear {label}" trigger → `ModalDialog` (title `Crear {label}`) → `CatalogForm` (no `initialValues`); auto-close on success; `firstFieldRef` threaded into both `initialFocus` and the form (Epic 2 form-dialog pattern). Pattern: `create-user-dialog.tsx` (read-only).
- [x] 4.3 GREEN — `src/modules/catalog/ui/catalog-edit-dialog.tsx` — row-level ghost "Editar" trigger → `ModalDialog` (title "Editar elemento") → `CatalogForm` with `initialValues` pre-filled from the row; auto-close on success. One dialog instance per row (popup unmounts while closed, form remounts fresh with the row's current values on every open).
- [x] 4.4 GREEN — `src/modules/catalog/ui/catalog-table.tsx` — `Card` + active-count header (`{n} elementos registrados · {m} activos`) + thead band + row hover + `StatusBadge` ("Activo"/"Inactivo") + per-row "Editar" (`CatalogEditDialog`) / "Desactivar" / "Reactivar" ghost buttons (submit wrappers in a transition) + empty state "No hay {label} todavía"; columns driven by `kind.fields` (first field renders `font-medium`, others muted). Pattern: `users-table.tsx` (read-only). Verified against spec "Empty And Status States" scenarios ("No hay Recipientes todavía", "Activo" badge for `isActive: true`, "Inactivo" badge for `isActive: false`).
- [x] 4.5 Verify — `npx tsc --noEmit` exit 0; `npx next build` exit 0 — client/server boundary clean, no Prisma/`pg` leak into the client bundle.

### TDD Cycle Evidence (Phase 4)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | — (no unit-test boundary) | Client component (`"use client"`) | Phase 1 unit 18/18 + Phase 2 integration 17/17 + Phase 3 tsc/build gates | — (NO unit-test boundary: the component is NOT mounted by any route until PR 5 and has no isolated test harness — NOT a test-first RED; prescribed verification per tasks.md 4.5 and design is `tsc --noEmit` + `next build`; driven end-to-end by PR 5's Playwright e2e `tests/e2e/configuracion.spec.ts`) | ✅ `npx tsc --noEmit` exit 0 (props/schema/action wiring type-checked); `npx next build` exit 0 (component compiles into the client graph with no Prisma/`pg` leak) | — (generic field iteration: equipos 4-field superset + uniform name-only kinds; create vs edit branch; client safeParse block; server fieldErrors mapping — covered by tsc narrowing + e2e later) | ✅ Clean |
| 4.2 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (trigger/dialog/form wiring; auto-close via `onSuccess`) | ✅ Clean |
| 4.3 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (row pre-fill via `initialValues` → `defaultValue`; hidden `id`) | ✅ Clean |
| 4.4 | — (no unit-test boundary) | Client component (`"use client"`) | same as 4.1 | — (same unmounted-UI note as 4.1) | ✅ `npx tsc --noEmit` exit 0; `npx next build` exit 0 | — (empty state + Activo/Inactivo badge + deactivate/reactivate wiring — spec scenarios verified by inspection; e2e owns the rendered assertions) | ✅ Clean |
| 4.5 | — (static/build gate) | Build | — | — | ✅ `npx tsc --noEmit` exit 0 (clean); `npx next build` exit 0: `✓ Compiled successfully in 33.4s`, `Finished TypeScript in 27.0s`, `✓ Generating static pages ... (7/7) in 6.6s`, route table unchanged (no `configuracion` routes yet — PR 5) | — | ✅ Grep: UI files import only react/zod/lucide, `@/components/ui/*` primitives, registry/schemas (client-safe), the four `submit-*.action.ts` wrappers (file-level `"use server"` proxies), and sibling UI files — zero `@/shared/db`/Prisma/`server-only` imports |

### Test Summary (Phase 4)

- **Total tests written**: 0 (no unit-test boundary for unmounted UI — see evidence note; PR 5's e2e owns the rendered behavior)
- **Total tests passing**: N/A (static/build verification instead) — Phase 1 unit 18/18 + Phase 2 integration 17/17 remain the behavioral safety net, untouched by this slice
- **Layers used**: Static type-check (`tsc --noEmit`) + production build (`next build`), per tasks.md 4.5 and the design's Testing Strategy
- **Approval tests** (refactoring): None — all new files
- **Pure functions created**: 0 new (all components; registry/schemas reused from Phase 1)

### Work Unit Evidence (Phase 4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx tsc --noEmit` → exit 0 (clean, ~0 output). `npx next build` → exit 0: `✓ Compiled successfully in 33.4s`, `Finished TypeScript in 27.0s`, `✓ Generating static pages ... (7/7) in 6.6s`. No Turbopack/Prisma-`pg`-in-client error. Only warning: the pre-existing `middleware` file-convention deprecation (unrelated, noted in the orchestrator brief). |
| Runtime harness command/scenario and exact result | `N/A` — components are not mounted by any route until PR 5 (`next build` route table shows no `configuracion` routes yet); driven by PR 5's e2e (`tests/e2e/configuracion.spec.ts`), per tasks.md Work Unit 4 row. |
| Rollback boundary | Delete `src/modules/catalog/ui/catalog-form.tsx`, `catalog-create-dialog.tsx`, `catalog-edit-dialog.tsx`, `catalog-table.tsx` — server actions + submit wrappers (PR 2/3) remain and their tests/build still pass |

## Cumulative State

- Phase 1: 5/5 complete
- Phase 2: 8/8 complete (verified GREEN)
- Phase 3: 5/5 complete (verified GREEN)
- Phase 4: 5/5 complete (verified GREEN)
- Phase 5: 0/7

## Infrastructure Remediation Performed (orchestrator-authorized)

The integration harness was initially BLOCKED by a pre-existing Neon **production**-branch migration drift (branch `br-nameless-thunder-axmb9b2y` = root/default = `NEON_PARENT_BRANCH_ID`, and the branch local `DATABASE_URL`/`DIRECT_DATABASE_URL` point to). It carried a phantom migration record `20260919190343_supporting_catalogs` (applied 2026-09-19 from another machine, absent from the repo) and an `equipment` table violating the locked contract. Authorized remediation applied to that branch (owner role):

1. `ALTER TABLE "equipment" ALTER COLUMN "serialNumber" SET NOT NULL;` (0 rows → safe)
2. `ALTER TABLE "equipment" ALTER COLUMN "calibrationDate" TYPE timestamp(3) USING "calibrationDate"::timestamp;`
3. `DELETE FROM _prisma_migrations WHERE migration_name = '20260919190343_supporting_catalogs';`
4. `npx prisma migrate resolve --applied 20260907234515_catalog_supporting_models`

Result: `npx prisma migrate status` → **"Database schema is up to date!"**; the harness then created ephemeral branches cleanly. A full read-only audit confirmed every other object (5 tables' columns, indexes, RLS ENABLE+FORCE, `tenant_isolation` USING/WITH CHECK, `quimia_app` grants) already matched the contract.

**Not yet reconciled:** child branches `dev` (`br-round-heart-ax6aukmj`), `preview/main` (`br-royal-heart-axtabp68`) and `vercel-dev` (`br-bold-silence-axz5k42e`) were snapshotted from production *before* the fix, so they retain the drift independently. Ephemeral test branches are cut from production and were therefore fixed by the above.

## Test Defects Found and Fixed During Verification

Getting to GREEN surfaced four defects in the as-written RED test file (which had never executed):

1. **Isolation leak** — a single shared `tenantA` + reused names ("ELISA", "QUIMICA SANGUINEA") across tests made the `(tenantId, name)` unique constraint fire on a later test's first create (cascading 409s). Fixed by giving each test a unique name (`uniqueName()`) on shared tenants.
2. **Fragile date assertion** — `String(pgDate)` is not ISO and `pg` decodes `timestamp(3)` in the server's local zone. Replaced with a deterministic `to_char("calibrationDate", 'YYYY-MM-DD')` read.
3. **Missing audit in expectation** — the deactivate-inactive no-op test asserted only `[METHOD_DEACTIVATED]`, but `entityId` also carries the `METHOD_CREATED` row. Corrected to `[METHOD_CREATED, METHOD_DEACTIVATED]` (still proves no second DEACTIVATED).
4. **Connection-budget exhaustion / false timeouts** — 17 real `signInEmail` calls (each opening transactions on its own pool) plus per-test tenant churn saturated the free-tier branch: "Unable to start a transaction in the given time" and multi-minute hangs. Fixed by signing in once per role in `beforeAll` (3 sign-ins + one shared password hash) and removing per-test tenants; `testTimeout`/`hookTimeout` raised to 120s in `vitest.integration.config.ts`. Runtime dropped from ~620s (stalled) to 93s (green).

## Notes / Deviations

- **Resolved open question (from tasks.md)**: `updateCatalog` does **NOT** no-op when `before` ≡ `after` — an update ALWAYS writes its `{ENTITY}_UPDATED` audit row (only deactivate/reactivate carry the no-op contract). Implemented as resolved; asserted in 2.1's update tests.
- **Minor implementation choice (contract unchanged)**: `writeAuditLog` is called once per switch branch, inside the `transaction()` callback — matches the design's Data Flow literally. For deactivate/reactivate the no-op `return { id }` exits the transaction BEFORE the audit call, which is exactly the no-op semantics.
- **`catalogIdSchema` ownership**: defined and exported from `deactivate-catalog.action.ts`, imported by `reactivate-catalog.action.ts` (design: "shared deactivate/reactivate input"). No circular import (reactivate → deactivate only).
- **`getCatalogStats` return shape**: `Record<CatalogSlug, number>` (slug → active count), built from `Object.keys(CATALOGS)` so the registry stays the single source of truth; the hub (PR 5) maps labels from `CATALOGS`.
- **Test harness session shape**: `signIn(email, tenantId)` signs in once per role in `beforeAll` and shares the resulting cookie headers; tests isolate via unique names rather than unique tenants, to stay inside the free-tier connection budget.
- **No new migrations, no schema changes on the repo side** — Phase 2 is server code + tests only. (The only DB change was the authorized production-branch remediation above.)
- `npx tsc --noEmit` is clean (the previously-noted stale `.next/types/validator.ts` error did not resurface).

## Phase 3 Notes / Deviations

- **`SubmitCatalogResult` ownership**: the design's Interfaces section lists a single shared `SubmitCatalogResult` type and its File Changes table lists no extra file for it — it is defined once and exported from `submit-create-catalog.action.ts`, then type-only-imported by the other three wrappers. Mirrors Phase 2's `catalogIdSchema` single-ownership precedent (deactivate → reactivate import). No circular import (type-only, erased at compile).
- **Uniform `AppError` → `{ ok, message, fieldErrors }` translation in all four wrappers** (not just create/update): the design's submit-wrapper contract and the Phase 3 task text both describe the shared `SubmitCatalogResult` shape, so deactivate/reactivate translate fieldErrors too (harmless for hidden `{ kind, id }` inputs, keeps the client result shape identical across all four actions).
- **`calibrationDate` normalization lives in each create/update wrapper** as a private 1-line `calibrationDateOrNull` (`""`/missing → `null`, else raw `"yyyy-MM-dd"` string; the shared schema coerces to `Date`) — matches the design's "preprocess at the FormData boundary (client + submit wrapper)" and the Phase 2 integration evidence that the plain actions accept both `null` and `"2026-05-20"`-style strings.
- **No new migrations, no schema changes, no UI/routes/e2e** — Phase 3 is four `"use server"` glue files only.

## Phase 4 Notes / Deviations

- **`CatalogRow` client type (deviation from design's letter, contract unchanged)**: the design's `CatalogFormProps` cites `SerializedCatalogRow`, which lives in `catalog-queries.ts` — a `server-only` module. Importing it from a `"use client"` component would pull Prisma/`pg` into the browser bundle (AD-3, the exact failure Phase 3's file-split exists to prevent). The client-safe structural twin `CatalogRow` is defined and exported from `catalog-form.tsx` (mirrors `users-table.tsx`'s own `UserRow` precedent) and reused by `catalog-table.tsx`/`catalog-edit-dialog.tsx`. TypeScript's structural typing keeps server rows (`SerializedCatalogRow[]`) assignable when PR 5's server page passes them in.
- **Form action is component-scoped (not module-level)**: `catalogFormAction` is defined inside `CatalogForm` so it can close over `kind`, `fields`, `isEdit` and the chosen schema — the create/edit mode split is driven by `initialValues` presence exactly as the design prescribes, with no mode flag in the props. `useActionState` uses the latest action identity (standard Next.js inline-action pattern).
- **Hidden inputs carry `kind` (always) and `id` (edit only)**: matches the design's Data Flow note ("kind + id carried by hidden inputs") and the submit wrappers' FormData contract (`submitUpdateCatalog` reads `id` from the form).
- **Edit dialog title**: "Editar elemento" — neutral/professional Spanish, avoids grammar issues with the plural registry labels ("Editar Métodos") and avoids coupling to `row.values.name`.
- **Submit labels**: create mode "Crear {label}" (shares the trigger label, mirroring the auth trigger/submit parity), edit mode "Guardar cambios"; pending states "Creando..."/"Guardando...".
- **Client-side `safeParse` field-error filtering** filters `issue.path[0]` to `Object.keys(fields)` — the generic equivalent of `create-user-form.tsx`'s fixed field list; `kind`/`id` discriminator errors are unreachable (hidden inputs are controlled by the component) and are never shown as field errors. Server-returned `fieldErrors` are filtered the same way.
- **No new migrations, no schema changes, no routes/nav/e2e** — Phase 4 is four `"use client"` UI files only. `next build`'s route table is unchanged (no `configuracion` routes yet — that is PR 5's slice).
