# PRD Quality Review — Quimia IO (prd-quimiaio-2026-07-05)

## Overall verdict

This PRD is unusually concrete for its category — Phase 1's 53 functional requirements mostly carry testable consequences, counter-metrics are named, and scope decisions are explicitly attributed to the product owner rather than smoothed into consensus language. What's at risk is feasibility honesty (no discussion of whether one developer can deliver ~53 FRs across 11 feature areas in 17 weeks for $32,000 MXN) and downstream cleanliness (glossary drift between Spanish role titles and the English actor language used in FR prose, unexplained FR-ID gaps, no assumptions index). None of this breaks the PRD's usefulness for driving the Phase 1 build, but these are exactly the gaps that get expensive once architecture and story-writing start pulling on them.

## Decision-readiness — adequate

The phasing decision is stated as a decision, not hedged: "Phasing decided by the product owner's directive... Nothing from the original scope is dropped — everything is placed" (§5). Trade-offs name what's given up, not just what's chosen — quotations/WhatsApp deferred "to protect the 17-week budget" with an explicit trade-in clause if the client pushes back (§5), and the Risks table (§12) pairs each risk with a mitigation rather than asserting everything is under control. Open Questions (§13) are genuinely open — OQ-1 (staff/volume/equipment) and OQ-3 (migration interest) have no answer smuggled into the next sentence.

What's missing is a tension the PRD is well-positioned to name but doesn't: whether the scope itself is deliverable. §11 and §12 address *scope creep* risk ("Scope pressure from client during Phase 1") but never address *scope sizing* risk — one developer, 17 weeks, $32,000 MXN, and a Phase 1 FR list spanning auth, six analyte capture types, a five-column Kanban, patient portal, cash control, reporting, and an audit log. There's no stated velocity assumption, no reference to comparable project sizing, nothing beyond "timeline assumes no scope additions mid-phase — trade, don't add" (§11). A decision-maker reading this PRD cannot tell whether 17 weeks is tight-but-real or optimistic.

The document also never uses a `[NOTE FOR PM]`-style callout anywhere, despite having real tensions to flag (see Strategic coherence below on the differentiator/showcase mismatch). Tensions are surfaced in prose, which is honest, but not flagged in a way that survives skimming.

### Findings
- **high** No feasibility check on solo-developer scope vs. budget/timeline (§11 Release Plan, §12 Risks) — the Risks table covers scope-creep but not scope-sizing: nothing states why ~53 Phase-1 FRs are achievable by one developer in 17 weeks. *Fix:* add a risk line (or `[NOTE FOR PM]`) naming this explicitly, plus a stated contingency if the week-8/week-10 checkpoints show slippage beyond the "trade, don't add" rule.
- **low** Zero `[NOTE FOR PM]` callouts across the document, even though multiple real trade-offs exist (differentiator deferral, budget tightness, trade-in candidates). *Fix:* promote the 2–3 highest-tension sentences already in prose (§5 altitude rationale, §11 solo-dev assumption) to explicit tagged callouts so they survive a skim.

## Substance over theater — strong

No persona theater: §4 gives three operational roles with jobs and access, not aspirational personas manufactured to look thorough. No innovation theater: both claimed differentiators (Kanban pipeline, altitude-adjusted ranges) are tied to a named source, `research-market.md` (§2, §9), rather than asserted from nowhere. NFRs are specific rather than boilerplate — NFR-5 gives concrete numbers (300ms perceived search, <2 min order creation, 5s Kanban refresh) instead of "the system must be fast," and NFR-2/NFR-3 cite the actual norms (NOM-024-SSA3, LFPDPPP) with concrete controls (ARCO rights, encryption in transit/at rest) rather than generic security language. The Executive Summary's differentiator claims are specific enough that they could not swap into a generic LIS PRD unchanged.

No findings here worth flagging.

## Strategic coherence — adequate

The thesis is stated and consistent: visual workflow visibility + geography-correct clinical ranges + honest pricing, repeated identically across the Executive Summary (§1), Competitive Positioning (§9), and used to justify phasing choices in §5. Counter-metrics are named (§3: invalidation/recapture rate, order-creation time, support load) — this is a rubric-specific tell most PRDs miss, and this one does it.

One real coherence gap: of the two flagship differentiators, only the Kanban pipeline ships in Phase 1; the altitude-adjusted reference range engine — positioning pillar #2 in §9, described as the pillar "unautomated by any incumbent despite solid clinical grounding" — is deferred to Phase 2 (§5). The stated rationale is sound on its own terms (the first client operates at one fixed altitude, so the feature would be a no-op for them). But the PRD doesn't connect the dots for the reader: the first client is explicitly framed as "a real operating lab as design partner and **showcase** for the SaaS phase" (§2), and that showcase will not demonstrate half of the stated pitch. This isn't a wrong decision — it's a decision made without naming its own cost.

### Findings
- **medium** Flagship differentiator #2 (altitude-adjusted ranges) is absent from the showcase client's build, and the PRD doesn't acknowledge the resulting gap between "reference installation" and "demonstrates the full pitch" (§2 vs §5 vs §9). *Fix:* add a line addressing how the SaaS pitch will be demonstrated without the reference client running it — a staging tenant, a synthetic demo, or an explicit acceptance that the pitch leans on Kanban alone until Phase 2.

## Done-ness clarity — adequate

Phase 1 FRs are the strongest part of the document: most carry a testable trigger and outcome — FR-31 ("advances the order in the pipeline when all its studies are validated"), FR-38 (45/90-minute color thresholds), FR-43 (debt gating blocks print/delivery except audited admin override), FR-46 (cash-session gating before any order). This is well above the median PRD on this dimension.

Two soft spots. First, a handful of NFRs use adjectives where a bound belongs: NFR-6 says "every screen is usable on a phone" with no defined breakpoint, touch-target, or performance bound; NFR-8 says data is "retained per NOM-007/NOM-024 record-keeping obligations" without stating what that retention period actually is (years), leaving the durability requirement untestable as written. Second, Phase 2 FRs (§6.12) are markedly less atomic than Phase 1's — FR-73 bundles company CRUD, credit management, price lists, per-company commissions, account statements, doctor commissions, and doctor price lists into one FR; FR-76 bundles five report dimensions plus interactive charts plus a consolidated dashboard into one FR. Each of these has many independent "done" states hiding under one ID. Given Phase 2 is explicitly "indicative, to be re-planned," this is lower-stakes than a Phase-1 gap, but it will need splitting before it can drive tasks.

### Findings
- **medium** Phase 2 FRs are compound rather than atomic (FR-73, FR-76 especially — §6.12), unlike Phase 1's much more granular FRs. *Fix:* before Phase 2 task breakdown, split these into single-capability FRs each with its own acceptance condition.
- **low** NFR-6 ("usable on a phone") and NFR-8 ("retained per NOM-007/NOM-024") state adjectives/references instead of bounds (§7). *Fix:* NFR-6 — state target breakpoints/devices; NFR-8 — state the actual retention duration the cited norms require, not just a pointer to the norm.

## Scope honesty — adequate

`[ASSUMPTION]` tags are used consistently and land on real inferences rather than trivia — staff size and order volume (§4), TAT and SaaS ambition targets (§3, tagged with who needs to confirm them), the ToronjaLab export assumption (§2), and the solo-developer/no-scope-additions assumption (§11). De-scoping is done openly: §5 states plainly what moved to Phase 2 and why, and Phase 3 functions as a de facto non-goals list for anything adjacent (appointments, imaging, EMR integration, native apps). Open-items density (5 Open Questions + roughly 10 inline assumptions) is proportionate to the stakes of a fixed-budget, real-client commitment — not excessive, and each has a stated resolution path (mostly "week-1 discovery visit").

The gap is structural rather than substantive: assumptions are scattered inline across §2, §3, §5, §10, §11, and §12 with no consolidated index, so auditing "everything we're assuming" before sign-off requires re-reading the whole document.

### Findings
- **medium** No Assumptions Index. Roughly ten `[ASSUMPTION]` tags are spread across six sections with no roundtrip list. *Fix:* add a short "Assumptions Index" section at the end enumerating each tag with its source section, so sign-off can audit them in one place.

## Downstream usability — thin

Cross-references resolve cleanly wherever the PRD makes a forward pointer — FR-4→FR-70, FR-7→FR-78, FR-24→FR-71, FR-26→FR-73, FR-35→FR-74/75, FR-38→FR-79, FR-45→FR-72/80/81, FR-50/51→FR-76 all point at FRs that actually exist with matching content. That's a real strength most PRDs get wrong.

Two mechanical gaps matter more here because the addendum states this PRD explicitly "feeds the architecture and design phases downstream." First, there is no Glossary, and domain-noun drift is visible between the role table and the FR prose: §4 names the roles **Recepcionista** and **Químico**, but FR text throughout §6.3–§6.9 refers to the same actors as "Reception" (FR-12, FR-18, FR-19, FR-21, FR-24, FR-41–44) and "Chemist" (FR-27, FR-28, FR-31, FR-33, FR-35) — an untranslated swap with no inline mapping. Other Spanish terms are glossed deliberately where they appear ("Quotations (cotizaciones)" in §5, "Cash Control (Caja)" in §6.9 heading), which makes the *un*-glossed Recepcionista/Reception and Químico/Chemist pairs stand out as an oversight rather than a style choice. A downstream architecture/UX pass has no canonical confirmation these are the same role, which risks the two labels diverging further in code and UI copy.

Second, the FR numbering has two unexplained gaps: FR-54 through FR-59 (between Phase 1's last FR, FR-53, and Phase 2's first, FR-60), and FR-64 through FR-69 (between FR-63 and FR-70) — twelve IDs total with no footnote saying whether they're reserved for cut content or simply unused.

There are no User Journeys in this PRD; given the single-operator-per-role internal-tool shape (see Shape fit), that's a reasonable omission rather than a defect, so it doesn't lower this verdict further.

### Findings
- **high** No Glossary; role names drift between §4 (Recepcionista, Químico) and FR actor language in §6 (Reception, Chemist), with no inline mapping tying them together, unlike other Spanish/English pairs in the document that are glossed on first use. *Fix:* add a short Glossary section mapping each role/domain term to the language used in FR prose, or standardize on one language for actor references throughout.
- **medium** FR-ID gaps: FR-54–FR-59 and FR-64–FR-69 (12 IDs) are unused with no explanatory note. *Fix:* either renumber contiguously or add a footnote stating these are reserved and why.

## Shape fit — strong

This is correctly treated as an internal-operations capability spec for Phase 1 (single lab, three roles) rather than forced into a consumer-product UJ format it doesn't need — matching the rubric's guidance that single-operator internal tools don't require named-protagonist journeys. The regulatory landscape (§8) does the traceability work a compliance-adjacent product needs: each norm (NOM-007, NOM-024, LFPDPPP, CFDI) is mapped to the specific NFR or FR it drives, which is the right rigor for a healthcare-data product even though this isn't purely a regulatory-update PRD. Rigor is also well-calibrated by phase: Phase 1 gets granular, testable FRs across 11 subsections because it's committed and budgeted; Phase 2 is deliberately looser ("indicative, to be re-planned after Phase 1 retro") because it hasn't been committed to yet. That asymmetry is a feature, not an inconsistency.

No findings.

## Mechanical notes

- **Glossary drift**: Recepcionista/Reception and Químico/Chemist (see Downstream usability finding above) — the most consequential drift in the document since it affects ~20 FRs' actor references.
- **ID continuity**: FR-54–FR-59 and FR-64–FR-69 unused/unexplained (12 IDs). All existing forward cross-references (e.g., FR-4→FR-70, FR-45→FR-72/80/81) resolve correctly to real FRs with matching content.
- **Assumptions Index roundtrip**: no index section exists; all `[ASSUMPTION]` tags are inline-only across §2, §3, §5, §10, §11, addendum. Nothing to roundtrip-check since there's no index to compare against.
- **UJ protagonist naming**: not applicable — no UJs in this PRD, consistent with its capability-spec shape.
- **Required sections**: Executive Summary, Context/Problem, Goals/Metrics, Users/Roles, Scope/Phasing, FRs, NFRs, Regulatory, Competitive Positioning, Business Model, Release Plan, Risks, Open Questions are all present and appropriately weighted for a fixed-budget commercial-launch PRD of this shape. Missing relative to the rubric's optional apparatus: Glossary, Assumptions Index, `[NOTE FOR PM]` callouts, Non-Goals section (Phase 3's backlog list substitutes reasonably well).
