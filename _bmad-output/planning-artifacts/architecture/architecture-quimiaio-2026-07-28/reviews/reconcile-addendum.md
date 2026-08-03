# Reconciliation Review — PRD Addendum vs. ARCHITECTURE-SPINE

**Source input:** `prd-quimiaio-2026-07-05/addendum.md`
**Derived spine:** `architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md`
**Reviewer pass:** BMad-method Finalize reconciliation (addendum vs. spine)

---

## 1. Gaps / silent contradictions found

### 1.1 Altitude engine deferral — completely absent from the spine (HIGH)

**Addendum citation:** "Rejected / deferred considerations" section:
> **Altitude engine in Phase 1**: deferred — single-site client at fixed altitude makes it a no-op for Phase 1; it is a Phase 2 SaaS differentiator.

**Spine citation:** Not present anywhere. Checked the `Deferred` section (lines 234-241), the `Capability → Architecture Map` (lines 224-232), and all nine ADs — none mention altitude, altitude correction, or reference-range adjustment. The only occurrence of the string "altitude" in the whole spine is the unrelated frontmatter field `altitude: feature` (a BMad document-scope metadata key, not the clinical altitude engine).

**Why this matters:** every *other* deferred item from the addendum's "Rejected / deferred" section made it into the spine's `Deferred` table — ToronjaLab migration (with OQ-3 citation preserved), WhatsApp/Twilio (Phase 2, in Stack table and Deferred), and quotations (folded into the Company/Quotation/Inventory/CFDI Phase-2 bullet). The altitude engine is the one item from that same source paragraph that was dropped entirely, which looks like an oversight rather than an intentional exclusion — especially since the spine's own `ANALYTE_REF` entity (reference ranges) is exactly the model a future altitude-correction feature would extend. A Phase 2 architect picking up this spine has no record that this capability was ever discussed or that it will touch the reference-range model.

**Suggested fix:** add a line to the `Deferred` section, e.g.: "Altitude-adjusted reference ranges (altitude engine). No-op for Phase 1 (single fixed-altitude client site); Phase 2 SaaS differentiator once multi-site/multi-altitude tenants exist. Will likely require an altitude parameter on `AnalyteRef` or a per-tenant site-altitude attribute — no Phase 1 schema decision needed."

### 1.2 "Zod validation on client and server" narrowed to env-config only (MEDIUM)

**Addendum citation:** "Development methodology" section:
> Owner mandates per-module SDD flow ... with TypeScript strict, **Zod validation on client and server**, RLS on every table, mobile-first components, explicit loading/error states.

**Spine citation:** Consistency Conventions table (line 121) only says: "Environment config is typed via Zod — no raw `process.env` reads in business logic."

**Why this matters:** the addendum's mandate is about validating *input data* (forms, API payloads) on both client and server — a request/response validation convention that every module's SPEC→SCHEMA→API→UI flow depends on. The spine's only Zod reference is for typed environment variables, a narrower and different use of the same library. As written, the spine gives no binding convention for how API request/response bodies get validated, which is a real cross-cutting convention gap (comparable in kind to the API-error-envelope convention the spine *does* state on the same line). This could lead each module to invent its own validation approach.

**Suggested fix:** extend the Consistency Conventions row (or add a new row) to state that request/response payloads are validated with Zod schemas on both client and server, in addition to the existing env-config usage.

---

## 2. Minor / low-severity notes (not blocking, flagged for completeness)

- **Design system tokens (palette hex codes, logo treatment, Plus Jakarta Sans font)** — addendum §"Design system" is not reflected anywhere in the spine. This is very likely out of scope for an architecture spine (it's UX/design-system territory, not a structural/module-boundary decision), so this is not scored as a gap — just noting it wasn't silently contradicted, it was reasonably left out.
- **"Mobile-first components" and "explicit loading/error states"** — not stated in the spine except indirectly (the API error envelope shape covers part of "explicit error states"). Likely legitimate UX-level conventions rather than architecture-spine material; low severity.
- **WhatsApp/quotations flagged as "first trade-in candidates if the client insists"** — this scope-negotiation contingency (a planning/roadmap nuance, not an architectural decision) isn't carried into the spine's Deferred entries. Reasonable to omit from an architecture artifact, but worth knowing it's not there if Phase 1→2 scope renegotiation comes up.
- **First module sequencing ("Dashboard + Auth + base layout")** and the **`(auth)`/`(dashboard)` route-group layout** from the addendum's data-model/route-structure draft are not restated in the spine's source tree. This is roadmap/routing-detail territory the spine reasonably defers to implementation time; the spine does preserve the more architecturally relevant piece (the public portal `r/[token]` route, in the system diagram).

---

## 3. Confirmed adequately covered

- **Vercel serverless vs. long-running HL7 needs** (addendum's flagged tension) → resolved by AD-5 (on-site agent process architecture) and AD-9 (agents run only in production, never on Vercel).
- **Supabase vs. Neon for RLS ergonomics** (addendum's flagged tension) → resolved by AD-2, with explicit rationale (Better Auth session vars vs. Supabase's `auth.uid()` assumptions).
- **NextAuth.js v5 preference** → explicitly and correctly challenged by AD-8 (Better Auth), with rationale (Auth.js v5 in maintenance mode). Consistent with the addendum's own instruction that architecture "should ratify or challenge" the owner's stack preferences.
- **Draft Prisma schema gaps** (no models for Caja/cash sessions, quotations, companies, doctors, inventory, audit log, CFDI) → all explicitly itemized in the spine's `Deferred` section, split correctly between Phase 1 (Doctor, CashSession/Caja, AuditLog — deferred to per-module SCHEMA time) and Phase 2 (Company, Quotation, Inventory, CFDI).
- **Mindray BC-5150 protocol** (confirmed HL7 per addendum) → spine's `Deferred` section explicitly states this is already confirmed, matching the addendum.
- **Mindray BS-240Pro protocol** (unconfirmed, `[ASSUMPTION]` flag in addendum) → spine's `Deferred` section captures this near-verbatim, including the instruction to confirm against the actual host-interface manual or Mindray before driver work starts. This is the single best-preserved open item in the whole reconciliation.
- **Unidirectional/result-only interface scope, host-query mode out of Phase 1** → matches FR-74b's "Deferred" treatment in the spine's Capability Map.
- **ToronjaLab migration rejection, OQ-3 dependency** → preserved verbatim in spine's `Deferred` section, including the OQ-3 citation.
- **Client-facing bilingual deliverable request** → correctly out of scope for an architecture artifact; no gap.

---

## Overall verdict

The spine faithfully absorbed nearly every load-bearing correction from the addendum — most notably the BS-240Pro open protocol question and the Vercel/Supabase tech-stack tensions were carried forward with unusual fidelity — but it silently drops the addendum's "Altitude engine" Phase 2 deferral entirely (a real, citable gap) and narrows the addendum's general client/server Zod-validation mandate down to env-config typing only (a real, citable convention gap); both should be patched into the spine before this Finalize pass is considered closed.
