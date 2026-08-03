---
title: "Reconciliation Review — PRD vs. Architecture Spine"
project: Quimia IO
reviewed_files:
  - _bmad-output/planning-artifacts/prds/prd-quimiaio-2026-07-05/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md
date: 2026-07-30
---

# Reconciliation Review — PRD vs. ARCHITECTURE-SPINE

Scope note: the spine's own frontmatter declares `scope: Quimia IO Phase 1 build — single-tenant LIS ... through production go-live`. Phase 2/3 functional requirements that the spine explicitly places in its `Deferred` section are NOT counted as gaps below — that's correct, intentional deferral, not silent dropping. Findings below are things the spine either (a) never mentions at all, positive or deferred, despite the PRD treating them as mandatory/load-bearing for Phase 1, or (b) states in a way that conflicts with PRD wording.

## 1. Gaps and Contradictions

### 1.1 NFR-8 (Data durability / backups) — not mentioned anywhere in the spine
PRD **NFR-8**: "Automated daily backups with tested restore; results and audit data retained per NOM-007/NOM-024 record-keeping obligations." This is a hard, numeric-cadence requirement ("daily", "tested restore") tied directly to two regulatory norms (§8 Regulatory Landscape cites NOM-007 record-keeping explicitly).

The spine adopts Neon (AD-2) and structures the deployment topology (AD-9) in detail, but nowhere states a backup/retention policy, whether Neon's PITR is relied on, who/what verifies "tested restore," or how retention periods interact with the data model. No AD, no Stack note, no Deferred entry. This is exactly the kind of load-bearing NFR an architecture spine should either resolve or explicitly defer — it does neither.

### 1.2 NFR-7 (Audit immutability) — cross-cutting invariant left unestablished
PRD **NFR-7**: "Audit records are append-only and immutable; no admin can edit or delete them." **FR-52** lists audit events spanning nearly every module (cash, orders, users, reference ranges, debt overrides).

The spine's `Deferred` section defers the `AuditLog` model itself ("not yet drafted... deferred to each module's own SPEC→SCHEMA authoring time"), which is reasonable for the schema. But audit-writing is inherently cross-module — the same category of concern the spine treats rigorously elsewhere (AD-1 forbids modules reaching into each other's data; AD-3 centralizes all DB access through one wrapper specifically to prevent modules from bypassing an invariant). No equivalent AD says "audit writes go through the audit module's interface only" or asserts the append-only/no-update-no-delete invariant at the architecture level (e.g., a DB trigger, a restricted grant, or a wrapper rule analogous to AD-3). Leaving a legally-mandated (NOM-024, NFR-2) cross-cutting invariant to be independently re-derived by whichever module gets to it first is precisely the divergence risk AD-1 says the spine exists to prevent.

### 1.3 NFR-5 (Kanban 5-second update requirement) — no real-time mechanism decision
PRD **NFR-5**: "Kanban board updates reflect state changes within 5 seconds." **FR-37/FR-39** describe a live board with elapsed-time counters and live per-column counts.

The dependency diagram states `kanban` reads order state through the `orders` module's interface, but there is no decision on *how* that update is delivered to a browser tab within the 5-second budget — polling interval, Server-Sent Events, WebSocket, or Next.js revalidation. This is a genuine "how do the pieces talk" architectural question with a numeric SLA attached, not implementation detail — and it's the kind of thing the spine's own dependency-diagram convention exists to pin down for exactly this cross-module read.

### 1.4 AD-4 / AD-6 "daily-reset folio" claim — not established by, and arguably in tension with, PRD wording
Spine **AD-4** and **AD-6** both assert the folio is a "daily-reset folio" and justify the `(tenantId, folio)` composite-unique index (rather than a global unique constraint) on that basis.

PRD **FR-22** describes it only as "a unique per-tenant folio" — with no mention of a daily reset. Read on its own, "unique per-tenant" reads as unique for the life of the tenant, not reset each day. If the folio genuinely resets daily (per the client's real workflow, possibly documented in `addendum.md`, which is cited in the spine's `sources` but was out of scope for this reconciliation), then `(tenantId, folio)` alone is *not* sufficient to prevent collision across different days — the date would need to be embedded in the folio value or added to the key. As written against the PRD alone, this is either an unverified import of an external fact or a real correctness gap in the composite key. Worth an explicit check against the PRD/client before this ships as `[ADOPTED]`.

### 1.5 NFR-6 (Mobile-first PWA) — no PWA-specific architectural decision
The PRD's own subtitle names "PWA" as a headline product attribute, and **NFR-6** requires every screen to be usable on a phone with portal access "for phone."

The spine's Stack table lists Next.js/Tailwind/shadcn but nothing about a service worker, web app manifest, installability, or an offline/degraded-connectivity shell (distinct from Phase 3's "Offline capture mode," which is about writing data offline — a PWA installable/offline-shell decision for read/display screens is a Phase 1 concern per NFR-6 and NFR-4's "graceful degradation messaging when offline"). This is easy to lose because it reads as "just responsive CSS," but PWA installability is a specific technical decision (manifest.json, service worker strategy) that doesn't fall out of Tailwind/shadcn by default in Next.js App Router.

### 1.6 NFR-3 (LFPDPPP / ARCO rights) — deletion-vs-retention-vs-audit-immutability tension unaddressed
PRD **NFR-3** requires ARCO rights "supported operationally (export/rectify/delete patient data on request)," while also stating deletion is deferred when NOM retention applies (with refusal reason logged), and **NFR-7** requires the audit log itself be immutable and never deletable.

None of this is addressed in the spine — no AD or Deferred entry acknowledges that a "delete patient data" capability has to coexist with (a) NOM-007/024 retention obligations, (b) an audit trail that must reference deleted patient data by design (audit entries record "before/after values," per FR-52), and (c) Result/audit immutability. This is a real architectural tension (what happens to audit rows that reference now-"deleted" patient data?) that the PRD itself flags as needing lawyer review (OQ-6) but that the spine doesn't even flag as an open architectural question.

### 1.7 NFR-4 (Availability) — no observability/monitoring decision, despite explicit business criticality
PRD frames this strongly: "The lab cannot operate without the system (cash gating, capture)," target 99.5% business-hours availability, with graceful degradation messaging required. The spine's deployment topology (AD-9) describes environments but has no AD on monitoring, alerting, health checks, or how "graceful degradation messaging" is technically surfaced when the app or DB is unreachable. Lower severity than 1.1–1.3 since Vercel/Neon are managed platforms with baseline uptime characteristics, but the PRD's own framing ("cannot operate without it") makes this more than a footnote.

## 2. Checked and Confirmed Adequately Covered

- **FR-74a (live equipment interfacing) and its edge cases** — AD-5/AD-6/AD-7 correctly capture the on-site-agent topology, the folio-based matching key, the deliberate rejection of a per-tube Sample entity (tube color as draw-guide only, not instrument-read), and the mixed manual/instrument analyte capture within one order. Well-reasoned and specific.
- **FR-74b (generalized/bidirectional interfacing)** — correctly deferred to Phase 2, consistent with PRD §5/§6.12 and the cited sprint-change-proposal.
- **NFR-1 (tenant isolation)** — AD-2/AD-3 correctly implement Phase 1 "tenant-ready" (RLS active from day one, single tenant in practice) without overbuilding the Phase-2-only cross-tenant test suite the PRD reserves for when a second tenant exists.
- **FR-22 (container labels / folio / QR)** and **FR-35 (manual vs. instrument-sourced result distinction)** — AD-4's `Result.source` enum and the catalog `tubeType`/`tubeColor` attribute are direct, correctly-scoped answers to these FRs.
- **ToronjaLab migration** — correctly reflected as out of Phase 1 scope (greenfield), with the optional paid-migration caveat preserved, matching PRD §2 and OQ-3/A1.
- **WhatsApp/Twilio, Stripe, CFDI, Quotations, Companies/Convenios, Inventory** — all correctly identified as Phase 2 and left undecided in this Phase 1 spine, matching PRD §5/§6.12 phasing.
- **Doctors/Cash/Audit schema deferral** — reasonable given the PRD's per-module SPEC→SCHEMA delivery flow; the *schema* deferral itself isn't a gap (see 1.2 for the narrower point about the cross-cutting immutability invariant).
- **BS-240Pro protocol uncertainty** — correctly flagged as a real open item in `Deferred`, matching the PRD's own FR-74a addendum reference.
- **Solo-developer / fixed-budget constraint** — the choice of vertical-slice modular monolith over hexagonal is explicitly justified against the PRD's 17-week solo/AI-assisted timeline (§11, Risks), a good example of an NFR-adjacent constraint being honored.

## 3. Overall Verdict

The spine is well-grounded and unusually careful on the one capability it was clearly built to resolve (equipment interfacing) and on tenant isolation, but it silently drops several PRD-mandated Phase 1 non-functional requirements that are genuinely architectural in nature — data durability/backups (NFR-8), the audit log's cross-cutting immutability invariant (NFR-7), the Kanban real-time update mechanism (NFR-5), and PWA installability (NFR-6) — and it asserts a "daily-reset folio" behavior (AD-4/AD-6) that the PRD's own FR-22 wording does not support and that should be verified before the AD stays `[ADOPTED]`.
