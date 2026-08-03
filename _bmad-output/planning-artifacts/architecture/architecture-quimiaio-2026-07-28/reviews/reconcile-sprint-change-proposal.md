---
title: "Reconciliation Review: Sprint Change Proposal vs. Architecture Spine"
reviewed_source: sprint-change-proposal-2026-07-27.md
reviewed_target: architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md
reviewed_on: 2026-07-30
---

# Reconciliation Review — Sprint Change Proposal (2026-07-27) vs. Architecture Spine (2026-07-28)

## Scope of this review

The proposal's §5 handoff row for the Solution Architect asked for three things, in order of how load-bearing they are to this check:

1. Resume the paused coaching session with the corrected PRD as input.
2. Design the device-interfacing boundary — **protocol layer, driver ownership, order/analyte matching** — as a first-class architectural concern, not a retrofit.
3. Respect the scope discipline the proposal itself committed to: **FR-74b deferred**, **bidirectional/host-query out of Phase 1**, **other-brand generalization out of Phase 1**.

This review checks the spine against all three, not just the FR-74a/FR-22 rows in the Capability Map.

---

## 1. Failures, contradictions, or scope creep

**None found.** No point in the spine designs for, or leaves an opening toward, bidirectional/host-query mode or other-brand generalization in Phase 1. Two non-blocking completeness notes are worth flagging for awareness, not as defects:

### 1.1 (Minor, non-blocking) — "Driver ownership" is asserted structurally but not modularized internally

AD-5 (line 54-58) and the source tree (line 220-222) establish "one on-site agent process per instrument" as the ownership boundary, but both Mindray instruments are folded into a single `agents/mindray-agent/` codebase ("one per instrument" is a deployment-count comment, not a code-boundary one). The spine doesn't say whether BC-5150's HL7 parsing and BS-240Pro's (still-unconfirmed) protocol handling are separate internal driver modules or just branches in one process.

This is not a violation of the proposal — in fact, *not* building a generalized driver-plugin abstraction in Phase 1 is exactly the restraint FR-74b's "onboarding flow to add a driver per new brand/model" (deferred to Phase 2) calls for. Flagging only because "driver ownership" was named explicitly in the handoff language and the spine's treatment of it is implicit rather than stated as its own AD.

### 1.2 (Minor, non-blocking) — "Basic sales reports" trade-out isn't echoed in the spine's Deferred list

Proposal §4.3/§4.4 (line 92-118) moves "Basic sales reports" from Phase 1 to Phase 2 to fund FR-74a inside the fixed budget. The spine's `Deferred` section (line 234-241) lists FR-74b, WhatsApp/Stripe, Company/Quotation/Inventory/CFDI, and the ToronjaLab migration, but never mentions "Basic sales reports."

This is very likely a non-issue — the trade-out has no data-model or module-boundary consequence the architecture layer needs to record (it's a PRD/phasing fact owned by `bmad-prd`, not an AD-worthy decision). Listed here only so it doesn't get lost as an unverified assumption if a later reviewer expects every §4 diff to have a visible footprint in the spine.

---

## 2. Checked and confirmed adequately covered

**Protocol layer** — AD-5 (on-site agent, per-instrument process, native host interface HL7/ASTM over TCP/serial) plus the `Deferred` section's explicit, honest flag that BS-240Pro's exact protocol/transport is unconfirmed pending the client's host-interface manual. This is the correct treatment: design the boundary now, leave the one real open technical unknown open rather than guessing.

**Order/analyte matching** — AD-6 is thorough and directly answers the proposal's ask: matching key is `Order.folio` (no invented Sample/Container entity), ingestion resolves `Order` by `(tenantId from API key, folio)`, validates the analyte belongs to a `Study` the order requested, writes `Result` with `source = INSTRUMENT`. Explicitly supports mixed manual+instrument results in one order (other lab equipment, e.g. Finecare Wondfo, stays manual) — matches the proposal's "Químico only completes analytes the instruments don't report."

**Device boundary as first-class, not retrofit** — `equipment-interfacing` is its own top-level vertical-slice module (source tree, line 211; dependency diagram, line 94), reached only through the cross-module interface convention in AD-1, not bolted onto `orders`. AD-5 also correctly locks the direction of the connection (agent → cloud, outbound-only HTTPS; "the Vercel-hosted app is never the one holding or opening a connection to lab-site hardware") — this is a real architectural decision, not an afterthought.

**FR-74b explicitly deferred** — Capability Map row (line 229: "not built in Phase 1 | Deferred") and `Deferred` section (line 238) both state it, and the front-matter `binds:` list cites `FR-74a, FR-74b` together per the proposal's success criteria (line 149: "architecture session resumes citing FR-74a/FR-74b as bounded inputs").

**Bidirectional/host-query out of Phase 1** — never designed toward. AD-5's outbound-only rule and the system diagram (line 146-163, "Neither analyzer PC ever receives an inbound connection from the app") make it structurally impossible to slide into Phase 1 by accident. `Deferred` section explicitly names "host-query (bidirectional) mode" as Phase 2, evaluated per-instrument only if required — verbatim consistent with proposal §4.1's FR-74b text.

**Other-brand generalization out of Phase 1** — no generic driver-plugin abstraction, no other brand names (Spin, Biobas, etc. from the old FR-74 text) appear anywhere in the spine. Agent naming (`mindray-agent`), the system diagram, and the Capability Map all stay scoped to the two named instruments, matching FR-74a's "scoped to these two named instruments only."

**FR-22 container labels** — Capability Map row + Core-entity ERD note (line 199: `Study` needs a `tubeType`/`tubeColor` catalog attribute driving how many labels print and in which color) gives a concrete, sensible answer to "one per analyte/container required." AD-6's clarification that the barcode is folio-level (identical across every tube in one order, not per-analyte) is a defensible technical translation of "scan-matching against instrument output" — real analyzer host interfaces resolve the sample by the ID on the tube (folio) and report results per internal analyte/test code, not via re-scanning a per-analyte barcode. Not a deviation from FR-22's intent, just the correct mechanism for how that intent is actually realized.

**FR-35 footnote correction** — `Result.source` enum (`MANUAL | INSTRUMENT`, AD-4) directly backs the capture screen's need to visually distinguish auto-populated from manual analytes, and the Capability Map row cites it correctly.

**Corrected-PRD-as-input** — front-matter `sources:` and `binds:` cite the sprint-change-proposal and the corrected FR set directly; the spine reads as genuinely resuming from the corrected PRD rather than the old FR-74 text.

---

## 3. Overall verdict

The architecture spine faithfully delivers on everything the sprint change proposal asked of the architecture phase — the device-interfacing boundary (protocol layer, driver ownership, order/analyte matching) is designed as a first-class concern with dedicated ADs and its own module, and the proposal's scope discipline (FR-74b deferred, bidirectional/host-query out of Phase 1, other-brand generalization out of Phase 1) is honored throughout with no leakage or scope creep; only two minor, non-blocking completeness notes are worth keeping an eye on (driver-boundary modularity left implicit, and the "Basic sales reports" trade-out not echoed in the Deferred list), neither of which represents a failure to reconcile.
