# Archive Report: Configuración — Catalog CRUD (Story 2.1, Change 2/6)

## Change Identity

- **Change**: `configuracion-catalog-crud`
- **Archived to**: `openspec/changes/archive/2026-10-12-configuracion-catalog-crud/`
- **Archived on**: 2026-10-12 (ISO date)
- **Artifact store**: openspec (file mode; native authoritative) + Engram summary mirror
- **Branch / base**: `dev` at `7e4f6ed` (pre-archive tip)
- **Native status at close**: `gentle-ai sdd-status configuracion-catalog-crud` → `taskProgress 30/30, allComplete: true, next: archive`

## Specs Synced

| Domain | Canonical target | Action | Details | Compose evidence |
|--------|------------------|--------|---------|------------------|
| `catalog-administration` | `openspec/specs/catalog-administration/spec.md` | Created | Canonical did not exist; the delta is a **full spec** (no ADDED/MODIFIED/REMOVED/RENAMED sections) → mechanically copied (shell copy, not model Read/Write). 11 requirements, 283 lines. | Mechanical copy; `git diff --no-index` readback exit 0 (empty); SHA256 source `045CB3F2…B2051` = destination |
| `supporting-catalogs` | `openspec/specs/supporting-catalogs/spec.md` | Created + composed | Canonical did not exist and the delta is a **delta** (RENAMED + MODIFIED + ADDED). Base seeded mechanically from change 1/6's domain-owning spec (`catalog-schema-supporting`), then 2/6's delta composed natively: RENAMED `AuditLog Mutation Actions Are Deferred to CRUD Changes` → `Catalog Mutations Write Per-Entity Audit Actions`, MODIFIED that requirement, ADDED `Catalog Models Support Full CRUD Operations`. Final: 8 requirements. | Base copy readback exit 0 (SHA256 `05ED3833…D75F` both); `gentle-ai sdd-archive-compose` exit 0 |

### supporting-catalogs canonical provenance (cross-change dependency)

The `supporting-catalogs` capability was authored by change **1/6** (`catalog-schema-supporting`), which had **not** been archived at close — its base spec still lives at `openspec/changes/catalog-schema-supporting/specs/supporting-catalogs/spec.md`. This is documented in the 2/6 proposal itself ("Capabilities" note, line 53). Because 2/6's delta references requirements that exist only in 1/6's spec, the canonical was seeded from 1/6's spec and then composed with 2/6's delta. The 5 unrelated 1/6 requirements were preserved byte-for-byte (`Five Catalog Models…`, `RLS Is Enforced…`, `Deactivate-Not-Delete…`, `Container Is a Catalog Lookup…`, `No Seed Data`, plus `Integration Tests Verify RLS…`).

## Archive Contents

- `proposal.md`: present
- `specs/`: present — `catalog-administration/spec.md`, `supporting-catalogs/spec.md` (delta copies preserved verbatim)
- `design.md`: present
- `tasks.md`: present — **30/30 tasks checked complete; 0 unfinished** (bytes preserved unmodified)
- `apply-progress.md`: present (historical snapshot preserved verbatim)
- `verify-report.md`: **missing** — no separate verify-report artifact was produced for this change (see caveat 2)
- `archive-report.md`: this file (additive; did not exist in the pre-move snapshot)

## Verification Results (recorded — not re-run during archive)

> **No test, type-check, build, or e2e command was re-executed by the archive phase.** The results below are recorded from the orchestrator's authoritative final-state facts and from intermediate `apply-progress.md` snapshots, attributed to their source. They are reported as *recorded results*, not as checks re-verified here.

### Final-state facts (orchestrator launch prompt — most recent account)

| Check | Recorded result |
|-------|-----------------|
| `npx vitest run` (unit) | 70/70 passed |
| `npx vitest run src/components/shell/nav-items.test.ts` | 6/6 passed |
| `npx tsc --noEmit` | clean |
| `npx next build` | exit 0; route table includes `ƒ /configuracion` and `ƒ /configuracion/[catalog]` |
| `npx playwright test tests/e2e/configuracion.spec.ts` | 4 passed (against an ephemeral Neon branch) |
| Full integration suite | 117/119 passed |

### Intermediate snapshots (lower rank — valid only at their time)

- Per `apply-progress.md` (Phase 5 section, written at Phase 5 close): full unit 70/70, integration 119/119, e2e 4/4, `tsc` exit 0, `next build` exit 0.
- Per `apply-progress.md` "Resume Re-verification Pass" (written later, on a relaunch): a full integration run recorded `4 failed | 115 passed (119)` accompanied by Neon `BRANCHES_LIMIT_EXCEEDED` / connection-loss errors in unrelated files, and the isolated catalog integration run passed when a branch was available.

The integration numbers differ across snapshots because the ephemeral-Neon harness lost branches mid-suite; they are historical observations, not current facts. The highest-ranked source (orchestrator final-state facts) records **117/119** and is carried forward here.

## Caveats (recorded truthfully)

1. **Integration suite 117/119 — 2 failures are unrelated infrastructure flakiness.** The 2 failures were connection drops (`pg` connection terminated / not queryable) in `tests/integration/auth-update-user-role.test.ts` and `tests/integration/auth-deactivate-user.test.ts` — files outside this change's scope. No catalog assertion failed. These are recorded as undiagnosed environment flakiness, not as a catalog defect and not merged into any causal story with the change's code.
2. **No separate `verify-report.md` exists** for this change. The native status already reported `verifyReport: missing`; the archive does not fabricate one and does not block on its absence.

## Known Deviation (preserved in history)

- `src/modules/catalog/server/require-catalog-admin.ts`: the `attemptedAction` option was relaxed to optional (behavior-preserving) so the page-level READ gate could reuse the guard without fabricating a mutation action. The four Phase 2 mutation paths still pass it and were unchanged. Documented in `apply-progress.md` Phase 5 Notes.

## Residual Risks / Follow-ups

- **Change 1/6 (`catalog-schema-supporting`) is still un-archived and its `supporting-catalogs` spec is a full spec.** When its archive runs, the canonical already exists, and `sdd-archive-compose` **refuses** a delta that "declares no ADDED, MODIFIED, REMOVED, or RENAMED requirements" (verified during this archive against a scratch canonical). Because 1/6's full content is already represented in the canonical, 1/6's archive will need an explicit decision (its spec sync is effectively already merged), not a naive compose. **The orchestrator must handle 1/6's archive specially.**
- **Ephemeral Neon branch budget**: the integration harness reached `BRANCHES_LIMIT_EXCEEDED`; leaked `test-local-*` branches may need pruning before the full 119/119 integration suite can be reconfirmed.
- **Cosmetic**: the native compose output placed the ADDED requirement heading immediately after the preceding scenario line without a blank separator (still valid Markdown; not hand-edited per the mechanical-composition contract).

## SDD Cycle Complete

The change is archived. **Implementation: complete** (all 30 tasks checked; Phases 1–5 merged to `dev`). **Verification: recorded results only — not re-run at archive** (unit 70/70, nav 6/6, `tsc` clean, `next build` exit 0, e2e 4/4, integration 117/119 with 2 unrelated infra failures). **Unresolved findings**: no open catalog defect; the only unresolved items are the 1/6 archive dependency and the ephemeral-Neon branch budget, both recorded above.
