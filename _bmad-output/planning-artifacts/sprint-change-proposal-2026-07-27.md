---
title: "Sprint Change Proposal: Equipment Interfacing Scope"
status: final
created: 2026-07-27
related_prd: prd-quimiaio-2026-07-05
---

# Sprint Change Proposal — Equipment Interfacing Scope

## 1. Issue Summary

During client discovery (post-PRD, post-UX, mid-architecture), the client raised a requirement that the PRD had underscoped: interfacing with lab analyzers to eliminate manual result capture.

**Current client workflow (as described):** two analyzers (Mindray BC-5150 hematology, Mindray BS-240Pro chemistry), each connected to a PC/laptop. On boot, the laptop auto-launches ToronjaLab (the incumbent LIS) and the analyzer's own software. Results flow automatically from analyzer → laptop → ToronjaLab order, unidirectionally (analyzer pushes, never receives). The client asked whether **bidirectional** interfacing (LIS sending orders/worklists to the analyzer, "host query" mode) is possible, or whether replicating the current unidirectional behavior is the right target. The client also flagged that order creation should print three document sets: sample container labels, payment ticket, work-order template — and named the equipment generically as "Mindray" but noted other brands are possible.

**Conflict with existing artifacts:**
- PRD `FR-74` already anticipates equipment interfacing, but scopes it to **Phase 2**, as **batch CSV/HL7 import** — not live, not Phase 1. Phase 1 has a fixed budget ($32,000 MXN) and fixed timeline (17 weeks).
- PRD `FR-22` already prints a ticket/work-order at order save, but not a container label — one of the three document sets the client named was a genuine gap.
- `EXPERIENCE.md` (UX) describes the capture screen as 100%-manual entry by the Químico; it does not model results arriving pre-populated from an instrument feed.
- No Epics/Stories exist yet (pre-implementation); Architecture was mid-coaching session (paused for this proposal, no `ARCHITECTURE-SPINE.md` written yet).

**Issue type:** new requirement from stakeholder + reprioritization of an existing but underscoped FR (batch import doesn't solve the client's actual pain point — waiting on a file drop, still re-typing while waiting).

## 2. Impact Analysis

- **Epic Impact:** N/A — no epics exist yet.
- **Story Impact:** N/A — no stories exist yet.
- **Artifact Conflicts:**
  - PRD: `FR-74` split, `FR-22` extended, `FR-35` footnote corrected, §5 Phase 1/Phase 2 scope paragraphs rebalanced (see §4 below).
  - Architecture: no conflict yet (nothing committed); architecture coaching resumes with the corrected PRD as input, so the equipment-interfacing boundary (protocol, driver ownership, per-instrument state) gets designed in, not retrofitted.
  - UX: `EXPERIENCE.md`'s capture flow needs a revision pass once Phase 1 scope is locked, to model auto-populated analyte results alongside manual entry, and an order-creation step for the container label print. Not redesigned in this proposal — flagged as a follow-up for `bmad-ux`.
- **Technical Impact:** Phase 1 gains a real-time device-integration surface (serial/TCP listener, ASTM E1394/E1381 or HL7 parsing per instrument manual, order/analyte matching) — new technical risk class not previously in Phase 1's footprint.

## 3. Recommended Approach — Hybrid

Trade a lower-priority Phase 1 item for the two-instrument live interface; keep bidirectional and other-brand support in Phase 2.

- **Traded out of Phase 1 → Phase 2:** "Basic sales reports" (visibility feature, not part of the daily register→capture→validate→deliver loop; the lab can operate without it on day 1).
- **Brought into Phase 1:** live unidirectional interfacing (`FR-74a`) scoped strictly to the client's two named instruments; container label printing (extended `FR-22`).
- **Kept in Phase 2:** generalized interfacing for other brands, CSV/HL7 batch fallback, and bidirectional/host-query mode (`FR-74b`) — evaluated per-instrument only if a specific client's workflow requires it.

**Why not the alternatives:**
- *Direct Adjustment (take everything as asked, no trade):* would add live interfacing **and** evaluate bidirectional **and** generalize across brands inside a fixed $32k/17-week budget. High effort, high risk of breaking the budget/timeline commitment made to the client.
- *MVP Review (defer everything, only fix the label gap):* lowest risk, but leaves the client's stated primary pain point ("evitar mucho la captura manual") unaddressed until Phase 2 — directly contradicts what they flagged as most important.

**Effort/Risk:** Medium-High effort (real protocol work against real hardware, ~2–3 weeks), Medium risk (bounded to 2 known instruments; bidirectional/multi-brand complexity explicitly excluded).

**MVP impact:** Phase 1 MVP is still achievable at the same budget/timeline — "Basic sales reports" is what pays for it.

## 4. Detailed Change Proposals (approved)

### 4.1 — FR-74 split (Phase 1 / Phase 2)

```
OLD:
- FR-74 Equipment interfacing: import results from CSV/HL7 files produced
  by analyzers (e.g., Mindray, Spin, Biobas — final list driven by real
  client equipment, to be surveyed).

NEW:
- FR-74a (Phase 1) Live unidirectional equipment interfacing: results from
  the client's confirmed instruments (Mindray BC-5150 hematology,
  Mindray BS-240Pro chemistry) post automatically into the matching
  order/analyte the instant the instrument produces them, over each
  instrument's native LIS protocol (ASTM E1394/E1381 or HL7 over
  serial/TCP, per manufacturer manual) — no CSV drop, no manual re-entry.
  Químico only completes analytes the instruments don't report. Scoped to
  these two named instruments only.

- FR-74b (Phase 2) Generalized equipment interfacing: CSV/HL7 batch import
  as fallback for instruments without a live driver; onboarding flow to add
  a driver per new brand/model as clients come on. Bidirectional
  (host-query — LIS sends worklist/order TO the instrument) deferred here,
  scoped per-instrument only when a specific client's workflow requires it.
```

### 4.2 — FR-22 extended (container labels)

```
OLD:
- FR-22 Saving an order generates a unique per-tenant folio, a unique QR
  token (immutable across edits), and prints a ticket/work order.

NEW:
- FR-22 Saving an order generates a unique per-tenant folio, a unique QR
  token (immutable across edits), and prints three document sets:
  (1) sample container/tube labels — one per analyte/container required,
  barcode or QR matching the folio/analyte for later scan-matching against
  instrument output; (2) payment ticket; (3) work-order template.
```

### 4.3 — Trade-out: "Basic sales reports" → Phase 2

Funds the FR-74a effort inside the fixed Phase 1 budget/timeline.

### 4.4 — §5 Scope and Phasing rebalanced

```
OLD (Phase 1 line):
... Cash control · Basic sales reports · Audit log (core events) ·
Dashboard (basic KPIs).

NEW (Phase 1 line):
... Results capture (all analyte types) and validation, including live
auto-capture from the client's 2 named instruments (FR-74a) · ... Cash
control · Audit log (core events) · Dashboard (basic KPIs).
[Basic sales reports → moved to Phase 2]

OLD (Phase 2 line):
... Doctor commissions and statements · Equipment interfacing (CSV/HL7)
and external PDF attachment · Full reporting and BI with charts ...

NEW (Phase 2 line):
... Doctor commissions and statements · Basic sales reports · Generalized
equipment interfacing (FR-74b: CSV/HL7 fallback, new-instrument driver
onboarding, bidirectional host-query per-instrument) and external PDF
attachment · Full reporting and BI with charts ...
```

### 4.5 — FR-35 footnote corrected

```
OLD:
- FR-35 The capture list color-codes each study: pending / in progress /
  validated. (Equipment interfacing arrives in Phase 2 — FR-74/75.)

NEW:
- FR-35 The capture list color-codes each study: pending / in progress /
  validated. (Live equipment interfacing for the client's 2 named
  instruments arrives in Phase 1 — FR-74a; generalized interfacing,
  bidirectional mode, and external PDF attachment remain Phase 2 —
  FR-74b/FR-75.)
```

### Follow-up (not an edit proposal — flagged for a later skill run)

- `bmad-ux`: revise the capture-screen flow in `EXPERIENCE.md`/mockups to model auto-populated instrument results alongside manual entry, plus the container-label print step at order creation.

## 5. Implementation Handoff

**Scope classification: Major** — touches PRD requirements and phase boundaries, and requires the paused architecture session to resume with corrected input before epics/stories can be created.

| Recipient | Responsibility |
|---|---|
| Product Manager (`bmad-prd` update intent) | Apply the 5 approved diffs above into `prd.md` (FR-74 split, FR-22 extension, §5 rebalance, FR-35 footnote); update `.decision-log.md`. |
| Solution Architect (`bmad-architecture`, resume) | Resume the paused coaching session with the corrected PRD as input — design the device-interfacing boundary (protocol layer, driver ownership, order/analyte matching) as a first-class architectural concern, not a retrofit. |
| UX Designer (`bmad-ux`, follow-up) | Revise the capture-screen flow per the follow-up note above, before epics/stories are cut. |

**Success criteria:** `prd.md` reflects all 5 diffs with `updated` date bumped; architecture session resumes citing `FR-74a`/`FR-74b` as bounded inputs; UX follow-up scheduled before `bmad-create-epics-and-stories` runs.
