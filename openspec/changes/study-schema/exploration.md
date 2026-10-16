# Exploration: Study Catalog (Story 2.2)

> Read-only exploration. No source files were modified. All claims below trace to
> files read during this phase (paths inline). RFC 2119 / Given-When-Then belong to
> later phases; this document states findings and options, not requirements.

## Current State

Today the `Study` model does not exist (`prisma/schema.prisma` lines 100–188 hold only
the five Story 2.1 catalog models and nothing references them). Consequences in the
shipped codebase:

- The five 2.1 catalogs (`Method`, `Technique`, `Equipment`, `Container`, `SampleType`)
  have **no consumer** — they are FK targets with nothing pointing at them. Their own
  spec (`openspec/specs/supporting-catalogs/spec.md` line 5) states their whole purpose
  is to be "referenced by FK" by Study.
- `prisma/schema.prisma` has no `Study`, so the draft ERD's hinge entity (AD-4,
  ARCHITECTURE-SPINE.md line 58) is missing from the base. `OrderItem.studyId`,
  `StudyAnalyte`, packages-referencing-studies (Stories 2.4, 2.5) and Epic 6 order lines
  all have no referent.
- The "sellable in Orders" half of Story 2.2 has no home: `price` + `tax` are Study
  attributes (FR-5, `prd.md` line 114), and `OrderItem.price` (maestro line 579) defaults
  from the study. Until Study exists, reception cannot add a line item.
- Epic 6's container-label printing (Story 6.4, epics.md line 762: "tube color from Epic
  2's catalog") cannot derive label color/cardinality from any study.

What Story 2.2 uniquely delivers: the **first sellable, operational catalog entity** — the
lab's definition of a billable test, carrying its operational attributes plus the FKs
into the five 2.1 catalogs. It is the hinge between configuration (Epic 2) and the
clinical/money path (Epics 6–7), and the first module to exercise the "select from a
catalog, no free text" contract the 2.1 spec was built for.

What is `Study` NOT (boundaries): analytes and reference ranges are Story 2.3; packages
are Story 2.5; orders are Epic 6; the `Study`↔`Analyte` link is unassigned (see Open
Decisions D10).

## Affected Areas

- `prisma/schema.prisma` — add `Study`; add back-relation fields on `Method`,
  `Technique`, `Equipment`, `Container`, `SampleType` (Prisma requires both sides of a
  relation). Structural choice only; no columns change on the catalog tables.
- `prisma/migrations/<ts>_study/` — new migration (`CreateTable` + FKs + indexes +
  hand-appended RLS/GRANT), pattern from
  `prisma/migrations/20260907234515_catalog_supporting_models/migration.sql`.
- `src/modules/catalog/` — Study CRUD reuses this module's layout
  (`server/*.action.ts`, `server/require-catalog-admin.ts`, `server/catalog-queries.ts`,
  `ui/*`); the `registry.ts` is currently 5-kind-specific and needs an explicit decision
  on how Study joins it (see D11).
- `src/app/(app)/configuracion/` — new `/configuracion/estudios` route + a hub card
  (`page.tsx` renders cards from `CATALOGS`; Study is not one of the five kinds).
- `tests/integration/catalog/` and `tests/e2e/configuracion.spec.ts` — new coverage.
- `src/components/shell/nav-items.ts` — no change expected (Configuración entry already
  exists, 2.1 shipped it).

## Approaches / Scope Split

Story 2.1 needed **two** changes because schema (771 changed lines, over its 320–380
forecast — `archive/2026-10-16-catalog-schema-supporting/tasks.md` line 52) shipped
separately from the CRUD UI (forecast ~1,200–1,600 lines → 5 chained PRs,
`archive/2026-10-12-configuracion-catalog-crud/tasks.md` lines 7–11). Story 2.2 is
strictly larger than 2.1's schema half (14 attributes + 5 FKs + money + enums vs 5 tiny
tables) and at least as large on the UI half (a 14-field form with 5 catalog selects vs a
1–4-field generic form). A single combined change is ~1,400–2,000 lines and blows the
400-line budget before any honest slicing — the same reason 2.1 split.

### Recommended split: two changes

| # | Change slug (proposed) | Scope | Est. changed lines | 400-line risk |
|---|---|---|---|---|
| 1/2 | `study-schema` | `Study` model + back-relations on the 5 catalog models + one hand-appended RLS/GRANT migration + integration tests (RLS, FK resolution, per-tenant uniqueness, enum/defaults, deactivate-not-delete). No UI, no actions, no route. | ~450–650 | Medium (borderline) |
| 2/2 | `configuracion-study-crud` | Study registry/validation, admin guard, typed queries, create/update/deactivate/reactivate actions + audit, `"use server"` wrappers, Study form/dialogs/table UI, `/configuracion/estudios` route + hub card, e2e. | ~1,000–1,500 | High |

Notes on slugs: the orchestrator's candidate `study-catalog` is the correct **story/epic
label**, but the established repo convention names changes by the artifact they deliver
(`catalog-schema-supporting`, `configuracion-catalog-crud`). I recommend the two slugs
above so 2.2 mirrors 2.1. If the team prefers one umbrella name, keep `study-catalog` as
the umbrella and suffix the slices `study-catalog-schema` / `study-catalog-crud`.

### Chained-PR expectation

- Change 1/2 is borderline: if the diff lands ≤400 it is a single PR; if it lands
  ~450–650 (likely, given 2.1's test-heavy schema change), one honest slice
  (schema+migration vs integration tests) or a `size:exception` is needed. Do not
  compress tests to fit.
- Change 2/2 is **High risk → chained PRs Yes**, mirroring 2.1's 5 slices: (1)
  registry + client-safe schemas/validation, (2) server (guard + typed queries + 4 plain
  actions + integration tests), (3) 4 `"use server"` wrappers, (4) UI (form + dialogs +
  table), (5) route + hub card + e2e. Chain strategy is resolved by the orchestrator
  before `sdd-apply` (`delivery_strategy: auto-chain` is set).

## Model Shape (proposed — pending the product decisions below)

Trace to conventions: every field/relation choice below follows the 2.1 catalog contract
(`openspec/specs/supporting-catalogs/spec.md` lines 9–11) and AD-4's ratified draft
(maestro lines 587–608). **Not all of this is decidable here** — items marked ⚠ are Open
Decisions.

| Epic attribute | Column | Type | Notes / AD trace |
|---|---|---|---|
| id | `id` | `String @id @default(cuid(2))` | Naming convention (spine line 151); cuid2 |
| tenant | `tenantId` | `String` (bare) | AD-2/AD-3; `AuditLog` precedent (spine line 100), no FK to `Tenant` |
| code | `code` | `String` ⚠ | FR-5; `@@unique([tenantId, code])` (AD-8 per-tenant uniqueness) |
| name | `name` | `String` ⚠ | FR-5 ("descripción" in maestro line 305); name-uniqueness is D7 |
| area | `area` | `String` (⚠ D6) | FR-5; maestro free string (line 305) |
| sample type | `sampleTypeId` + relation | FK → `SampleType` ⚠ required | 2.2 AC: selected from catalog, no free text |
| container | `containerId` + relation | FK → `Container` (⚠ D1 cardinality) | 2.2 AC; AD-6 (catalog lookup, not order identity) |
| method | `methodId` + relation | FK → `Method` ⚠ required | 2.2 AC |
| technique | `techniqueId` + relation | FK → `Technique` ⚠ required | 2.2 AC |
| equipment | `equipmentId` + relation | FK → `Equipment` ⚠ required? (D8) | 2.2 AC |
| patient preconditions | `patientConditions` | `String?` (⚠ D4) | FR-5; maestro `patientCond String?` |
| processing days | `processDays` | `Int @default(1)` (⚠ D5) | FR-5/FR-8; maestro `@default(1)` |
| price | `price` | `Decimal @db.Decimal(10,2)` ⚠ D3 | FR-5/FR-19; NFR-9 MXN (prd.md line 224) |
| tax flag | `tax` | `Boolean @default(false)` (⚠ D3) | FR-5 |
| print options | `printMethod`/`printTech`/`printEquip`/`printSample` | 4× `Boolean @default(false)` (⚠ D2) | FR-5; maestro lines 602–605 |
| tube type/color | ⚠ D1 — column placement unresolved | enum / text / FK / join | spine line 236 + adversarial F7 (see D1) |
| lifecycle | `isActive` | `Boolean @default(true)` | deactivate-not-delete (2.1 spec line 65) |
| timestamps | `createdAt`/`updatedAt` | `DateTime` | convention |

Tenant / RLS posture (all trace to AD-2/AD-3, mirroring 2.1 exactly):

- `@@map("study")`, `@@index([tenantId])`, `@@unique([tenantId, code])` (+ possibly
  `[tenantId, name]`, D7).
- Migration hand-appends, per table: `GRANT SELECT, INSERT, UPDATE, DELETE ON "study" TO
  quimia_app;` + `ENABLE` + `FORCE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation`
  on `current_setting('app.tenant_id', true)` — verbatim shape from the 2.1 migration
  (lines 109–157). Applied by the owner role via `DIRECT_DATABASE_URL`, never `quimia_app`.
- FK `onDelete`: should be explicit `Restrict` (or Prisma's required-relation default) so
  the FK enforces deactivate-not-delete at the DB level, complementing the app rule.
- Cross-tenant FK is structurally impossible: a `Study` insert carries the scoped
  `tenantId` (WITH CHECK), and the referenced catalog row is itself RLS-hidden unless it
  belongs to the same tenant — so the FK can only resolve within the tenant.
- All runtime access goes through `scoped()`/`transaction()` from `src/shared/db`
  (`scoped.ts`); no `prisma.<model>` call (AD-3, openspec config.yaml line 38). The
  wrapper is model-agnostic (`$allModels.$allOperations`) and needs **zero changes**.

## Open Product Decisions (needs the user)

These are surfaced, not decided. Each lists options, what the artifacts already imply, and
a recommendation (a recommendation is not a decision).

**D1 — Tube type/color (the load-bearing one).** The epic sets a tube color *on the
study* (epics.md line 444) but Story 6.4 says the color comes *from Epic 2's catalog*
(line 762), and the 2.1 `Container` model has only `name` — no color column
(`schema.prisma` lines 156–173). The spine's ERD note (line 236) says Study "needs a
tubeType/tubeColor catalog attribute … catalog data, not a new entity", which sits in
limbo (not an AD, not in Deferred). The adversarial review's finding F7
(`review-adversarial-incompatibility.md` lines 241–266) argues for a proposed **AD-21**:
`Container` is the real admin-managed catalog, `Study`↔`Container` is **many-to-many**
(one study may need two tubes, e.g. chemistry needing serum + fluoride/oxalate), and the
label rule is **one label per distinct container across the order's studies, deduplicated,
each carrying study attribution and catalog color**. F7 is a proposal in a review file —
**it is absent from ARCHITECTURE-SPINE.md (which has only AD-1..AD-12)** and was never
ratified. Options:
  1. Scalar on `Study` (`tubeType` enum / `tubeColor` text) — literal reading of the ERD
     note; simplest; but cannot express a study needing two tubes, and F7 shows Epic 6's
     print-preview would silently under-print (a patient drawn into the wrong tube).
  2. Add `color` to `Container` + `Study`→`Container` **1:N** — one tube per study; still
     cannot express the two-tube study.
  3. Add `color` to `Container` + `Study`↔`Container` **M2M** (join table) — F7's proposal;
     changes the already-shipped `container` table (adds a column + a join table) and
     defines label cardinality. Architecturally the most correct.
  - Recommendation: option 3, **if** AD-21 is ratified first — it is the only option that
    satisfies Epic 6.4's dedup-by-tube-color rule and the real two-tube case. Otherwise
    option 2 is the pragmatic Phase 1 fallback. This decision **blocks Epic 6 label
    printing and Story 2.4**.

**D2 — "Print options".** Maestro is concrete: four checkboxes "imprimir
método/técnica/equipo/muestra en PDF" (line 305). Options: four booleans (faithful) vs a
`Json` blob (flexible, hard to query/validate). Recommendation: four booleans — matches
maestro and keeps the form/qeries typed. Open: is the set exhaustive, or will later
studies need to toggle reference ranges too?

**D3 — Price + tax flag.** NFR-9 fixes currency to MXN and monetary values to MXN
(prd.md line 224). Options/unknowns: decimal precision (`Decimal(10,2)` assumed); whether
`price` is tax-inclusive or exclusive (drives order totals in Epic 6); tax as boolean vs
rate vs enum. The domain review (`review-domain-regulatory.md` R4, lines 36–39) warns IVA
treatment is genuinely ambiguous in Mexico (professional medical services can be
IVA-exempt under LIVA art. 15; a *persona moral* typically transfers 16%) and recommends
keeping the per-study boolean but adding an open question for the client's accountant —
"do not assert a default rate". CFDI invoicing is Phase 2 (prd.md line 210). Recommendation:
keep `tax Boolean` and add the explicit open question; do not model a rate in Phase 1; settle
tax-inclusive vs exclusive with the user (affects Epic 6 math).

**D4 — "Patient preconditions".** Maestro models a single free-text `patientCond String?`
(line 598). Options: free text vs structured list vs a catalog. Recommendation: nullable
free text for Phase 1 (matches maestro; Epic 3 carries patient observations separately,
and Epic 6.1 shows them to the chemist). Confirm it is optional.

**D5 — "Processing days".** Maestro models `processDays Int @default(1)` (line 599). The
domain review (`review-domain-regulatory.md` R7, lines 84–86) argues a single 45/90-min
Kanban rule paints cultures/send-outs permanently red and the fix is per-study TAT.
Options: single `Int` (days) vs an array/schedule vs minutes. Recommendation: single `Int`
days for Phase 1 with an explicit note that a finer schedule (hours, or a `Json` schedule)
is a known later need — Epic 6's Kanban (Story 6.x) is where it bites.

**D6 — "Area".** Maestro is a free string ("hematología, química, urología…", line 305);
Story 2.1 built no area catalog. Options: free text vs enum vs catalog. Recommendation:
free text for Phase 1 unless the user wants area grouping/filtering soon — an enum would
need migration churn for every new discipline and a catalog is a new 6th supporting table
not in scope.

**D7 — Code vs name uniqueness (added).** Maestro makes `code` the lookup key; FR-18
searches "by code or name" (prd.md line 108 context). Options: `@@unique([tenantId, code])`
only, or also `@@unique([tenantId, name])`. `code` uniqueness per tenant is near-certain
(labs rely on the clave). Recommendation: `code` unique; leave `name` non-unique unless
the user wants it enforced.

**D8 — Is `equipmentId` required? (added).** 2.2's AC says equipment is selected from the
catalog, but many labs run studies on no instrument (visual/microscopy). Maestro makes it
non-null. Recommendation: **optional** (`equipmentId String?`) — a required equipment on
every study is likely wrong; confirm with the user. Sample type/container/method/technique
appear genuinely required.

**D9 — "Sellable in Orders" semantics (added).** Epic 2.2 AC ties sellability to price +
tax flag being set (lines 446–448). Options: an explicit `isSellable` flag, or implicit
(price present + `isActive`). Recommendation: implicit — a study with a price and
`isActive=true` is sellable; `isActive` is the deactivate gate. No extra column. Confirm.

**D10 — Does Story 2.2 include the `Study`↔`Analyte` link? (added, boundary).** The epic
does not mention it; Story 2.3 owns analytes and Story 7 capture needs to know which
analytes belong to a study. Recommendation: keep it out of 2.2 (assign to 2.3) unless the
user wants 2.2 to ship a bare junction — but the boundary must be stated so 2.3's schema
change owns it.

**D11 — How Study joins the `/configuracion` hub and `CATALOGS` registry (added,
mechanism).** The current `registry.ts` is a 5-entry `Record<CatalogSlug, CatalogKindDef>`
with a uniform `{ name }`-shaped field contract; Study has ~14 fields, FKs, and money.
Options: extend the registry with a Study kind (fights the generic model), or build a
dedicated Study module surface under the same route/hub. This is a design-phase concern,
not a product decision, but it changes the UI slice materially — flag now.

## Verification Story

- **Unit (vitest run, `vitest.config.ts`):** Study Zod schemas (create/update), the
  form/field contract, registry/route mapping.
- **Integration (real ephemeral Neon branch, `vitest.integration-run`, `fileParallelism:
  false`):** create/update/deactivate/reactivate + `STUDY_*` audit rows written atomically
  in the same transaction (AD-10); FK resolution against all five 2.1 catalogs; per-tenant
  `code` uniqueness (409, no duplicate); RLS fail-closed (unscoped → zero rows);
  cross-tenant isolation; `FORCE` RLS (owner cannot bypass); `quimia_app` full CRUD grant;
  enum/Decimal/default faithfulness; deactivate-not-delete; non-admin → 403 +
  `CATALOG_ADMIN_ACTION_DENIED`. A mocked Prisma client is rejected as RLS evidence
  (2.1 spec line 132).
- **e2e (`playwright test`):** admin opens `/configuracion/estudios`, creates a study
  selecting all five catalog-backed fields (asserting no free-text fallback), sets
  tube color/price/tax, sees it listed; edit/deactivate/reactivate; non-admin 404. Pattern:
  `tests/e2e/configuracion.spec.ts`.

Environment caveats found:
- **Neon free-tier branch cap (10)** is a live recurring problem (deferred-work lines
  11–12); Study's integration run creates another branch — check/reap `test-*` branches
  first.
- **Windows Playwright hang**: `npm run test:e2e` hangs on this machine; run e2e manually
  via `npx tsx scripts/e2e/start-server.ts` in one terminal, then
  `E2E_REUSE_SERVER=1 npx playwright test` (deferred-work lines 10, 40). The Study e2e
  cannot be proven on this machine until then.
- **Migration drift**: `prisma migrate dev` may report drift; 2.1 worked around it with
  `prisma migrate diff` over clean history. Migration LF is now pinned via `.gitattributes`
  (commit `c94c0a9`), checksums reconciled on both Neon branches (odd/tasks/
  prisma-migration-checksum-drift.md).
- **Strict TDD is active** (`openspec/config.yaml` lines 13, 39): RED first.

## Risks / Prerequisites

- **D1 blocks Epic 6 and Story 2.4.** The tube/container model must be settled before the
  schema change, or Epic 6's label work and packages will build on the wrong shape.
- **AD-21 is an unratified proposal.** F7 proposed it but the spine (AD-1..AD-12) never
  incorporated it. If D1 chooses options 1–2, the "one label per distinct tube" rule is
  not expressible — an architectural decision the user must make.
- **Back-relations churn the 2.1 catalog models.** Adding Study requires editing the five
  shipped catalog models in `schema.prisma` (relations, not columns). No catalog migration
  results, but the schema diff touches already-reviewed tables.
- **Product decisions are unprecedented in the artifacts.** No `_bmad-output/
  implementation-artifacts/2-2-*.md` story file exists (only 1-1..1-5); the epics text is
  the sole source, so story-writing-level decisions (D2–D9) were never made. This
  exploration deliberately does not invent them.
- **Decimal ↔ client-form serialization.** Prisma `Decimal` needs explicit string
  handling across the server-action boundary — a known papercut (Epic 6 will hit it too).
- **Enums are rigid.** If D1/D6 choose Postgres enums, adding a value is a migration;
  free text avoids that at the cost of validation.
- **Cross-story coupling to track:** Story 2.3 (Analyte + the unassigned Study↔Analyte
  link, D10), Story 2.5 (packages reference Studies), Epic 6 (OrderItem.studyId, price
  default, label tube color, "sellable"), Epic 7 (capture iterates a study's analytes).
- **Deferred items touching this story:** only the two environment blockers (Neon branch
  cap; Windows e2e hang). The deferred "active-nav exact equality" item (deferred-work line
  5) is already **stale** — `sidebar.tsx` line 48 now uses `pathname.startsWith(item.href)`
  (shipped by 2.1). The migration-drift class is resolved by `c94c0a9`.

## Could Not Determine / What Would Resolve It

- **D1–D11** — require a product decision from the user (the D1 AD-21 ratification is an
  architecture decision).
- **Whether Story 2.2's scope includes the Study↔Analyte link** — needs an epic/story
  clarification (or a `bmad-create-story` pass for 2.2, which has not run).
- **Tax-inclusive vs tax-exclusive price** — needs the client's accountant (domain review
  R4) and affects Epic 6 totals.
- **I could not confirm an adopted AD covering container/tube cardinality** — the spine
  stops at AD-12; the proposed AD-19/AD-20/AD-21 live only in the adversarial review file.

## Ready for Proposal

Conditional Yes — the scope split (2 changes) is ready to propose. The **model shape
cannot be finalized** until D1 and D3 (and preferably D5/D7/D8) are answered; the schema
change (1/2) should not start before D1/D3 are locked. The CRUD change (2/2) inherits
whatever D2/D4/D6 decide for its form.
