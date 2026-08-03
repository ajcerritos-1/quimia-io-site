# Adversarial Review — Quimia IO PRD + Addendum

**Reviewer stance:** Cynical, skeptical stakeholder. Assumes problems exist. Hunts for contradictions, unfunded scope, unmeasurable metrics, hidden cross-phase dependencies, and claims that won't survive contact with the client.
**Targets:** `prd.md`, `addendum.md` (created 2026-07-05).
**Verdict:** The PRD is well-organized and honest about *some* of its assumptions, but the central promise — a complete, compliant, multi-tenant-ready single-lab LIS built solo in 17 weeks for a fixed $32,000 MXN — is not survivable as written. The scope is 2–3x the budget, several Phase 1 metrics are vacuous or unmeasurable, and at least four hard contradictions exist between stated goals and stated constraints.

Severity legend: **CRITICAL** (breaks the plan / legal or contractual exposure), **HIGH** (will blow budget/timeline or fail on client contact), **MEDIUM** (weak reasoning, unmeasurable, or fragile), **LOW** (polish / consistency).

---

## CRITICAL

### C1 — 17-week solo scope is 2–3x the fixed budget
Phase 1 lists ~45 functional requirements (FR-1…FR-53) plus 9 NFRs, for ONE solo developer, in ~17 weeks (§5, §6, §11). Several of these are each multi-week efforts on their own: a live cross-analyte **formula/calculation engine** (FR-6, FR-28), a **PDF rendering engine** that embeds images and rich-text documents (FR-11, FR-28, FR-33–34), a **cash-reconciliation module** with sessions, over/short, per-seller detail and closing PDFs (FR-46–49), a **tokenized public portal** (FR-44), and **database-enforced RLS with automated isolation tests** (NFR-1). This is comfortably 6–9 months of senior full-stack work, not ~4 months. The timeline is the single biggest risk and the PRD's own mitigations (below) do not close the gap.

### C2 — "$32,000 MXN fixed budget" is economically incoherent for the scope
$32,000 MXN over 17 weeks ≈ **$1,880 MXN/week (~$110 USD/week)** of effort — far below any professional Mexican full-stack rate for a system of this complexity. The PRD also conflates two different things: a **client price** ("fixed-price project," §10) and a **development budget** (§1 "fixed budget"). If $32k is the client price, the margin against 17 weeks of solo senior labor is effectively negative; if it's the internal budget, it implies near-free labor. A skeptical stakeholder will ask which one it is and why the number is credible. It is stated nowhere.

### C3 — Retiring ToronjaLab in 4 weeks (G2) contradicts record-retention obligations and the no-migration decision
G2 targets "ToronjaLab retired; lab operates exclusively on Quimia IO within 4 weeks of go-live." But: (a) migration of patients and historical results is **explicitly out of scope** and only an optional paid add-on (§2, §10, addendum); (b) the PRD itself asserts legal **record-retention** duties under NOM-007/NOM-024 (§8, NFR-8). You cannot retire the system that holds the legally-required historical records while their migration is optional and unfunded. Either the lab keeps ToronjaLab (G2 fails), or it violates retention. This is a direct internal contradiction.

### C4 — Phase 1 cannot legally invoice; the "complete operational core" can't bill patients
Phase 1 takes cash, card, transfer, credit, partial payments, debts, and produces sales reports (FR-21, FR-43, FR-50), but **CFDI 4.0 invoicing is a Phase 2 add-on** (FR-82, §8). A Mexican lab taking money must issue CFDI. So on go-live the lab still needs ToronjaLab (or another tool) to invoice — which again breaks G2 and undercuts the "complete single-lab system" claim (§1, §5). This is the first question the partner doctor will ask and the PRD has no answer.

### C5 — Multi-tenant RLS is loaded into the fixed Phase 1 budget while Phase 1 is defined as single-lab
NFR-1 demands `tenant_id` on every table, **database-enforced RLS**, and **automated cross-tenant isolation tests** as a **release-blocking** concern — and week 1–2 includes "tenant scaffolding." Yet §5 explicitly defers "SaaS mechanics" to Phase 2 and Phase 1 has exactly **one** tenant. This is either (a) premature multi-tenant complexity paid for out of the fixed single-lab budget, or (b) an NFR that will not actually be satisfied in Phase 1. It cannot be both "release-blocking in Phase 1" and "deferred to Phase 2."

---

## HIGH

### H1 — G6 (zero data-isolation incidents) is a vacuous Phase 1 metric
With a single tenant in Phase 1, there is no second tenant to leak to. "Zero data-isolation incidents" is true by construction and proves nothing — yet it's listed as a first-client success metric. The isolation risk is real only in Phase 2, where this metric belongs.

### H2 — The ToronjaLab counter-metric baseline is unmeasurable
The counter-metric "Order creation time at reception must not exceed the ToronjaLab baseline" (§3) requires a measured ToronjaLab baseline. There is **no plan to instrument or capture** ToronjaLab timings (greenfield, no migration, no access described). The baseline that were are told not to regress against is never captured, so the counter-metric cannot be evaluated.

### H3 — G3 (TAT −20%) measures a learning curve, not product value
The TAT baseline is measured "in first 2 weeks post-go-live" **on Quimia IO itself**, then compared to week 8 on Quimia IO. That measures staff getting faster with a new tool, not any improvement over the prior state. It also runs during hypercare when the team is least practiced, inflating the baseline and making the −20% trivially easy to "hit" — which a skeptical stakeholder reads as a rigged metric, not evidence.

### H4 — G4 (≥90% digital delivery) will not survive client contact
Assumes patients have email/smartphones, consent to digital delivery, and prefer it over paper. Small Mexican labs serve many walk-in cash patients who expect a printed result. This is asserted with no evidence from the actual client's patient base. Moreover, "delivered via portal" is **link generation**, not confirmed receipt — a tokenized public link (FR-44) has no delivery confirmation, so the numerator of this metric is not actually measurable as "delivered."

### H5 — The scope-pressure mitigation (trade-not-add) is unfunded/circular
Risk #2's mitigation and §5 say WhatsApp/quotations are the "first candidates to trade **into** Phase 1 against something else." But §5 also insists "nothing from the original scope is dropped — everything is placed," and the timeline is already fully packed with no slack. There is no identified tradeable fat. You cannot trade WhatsApp *in* without cutting something the PRD calls core. The mitigation presumes slack that the plan says does not exist.

### H6 — Single-developer bus-factor "mitigation" is a rationalization, not a mitigation
Risk #5's mitigation is "SDD discipline + this PRD + architecture docs keep the project transferable." Documentation does not replace the one person delivering on a fixed 17-week deadline. If the developer is unavailable, no document ships the remaining code on time or on budget. This is the highest-consequence risk with the weakest control in the table.

### H7 — Phase 1 go-live depends on manual catalog entry, whose fix is deferred to Phase 2
The Risk table admits "solo lab data-entry burden (catalogs)" and mitigates it with a pre-loaded library flagged "[ASSUMPTION — worth building in Phase 2]." So a **Phase 1 go-live blocker** (entering the entire study/analyte catalog with age/sex-segmented reference ranges, by hand, with **no bulk import** in scope) is "mitigated" by a **Phase 2** feature. That is a hidden cross-phase dependency sitting directly on the critical path (weeks 15–16 UAT/data load).

### H8 — The first client validates nothing about Phase 2's business model
Phase 1 is a bespoke, fixed-price build for a **partner doctor** who is **not a subscriber**. A one-off custom install proves nothing about SaaS willingness-to-pay, the $799/$1,299/$2,099 tiers, churn (G9 <5%), or "operational in <1 week" onboarding (G10). Yet §2 frames this client as the "showcase for the SaaS phase" and §10 as "the reference installation." The Phase 2 goals (G7–G10) rest on zero validated market evidence, while §10 simultaneously claims "prices confirmed unchanged by product owner" — confidence without validation.

### H9 — The showcase installation will lack the flagship differentiator
§9 makes altitude-adjusted ranges differentiator #2 ("clinically correct by geography"), and §2/§10 make the first client the SaaS showcase. But the altitude **engine is deferred to Phase 2** (FR-78) because the client is single-altitude. So the reference/showcase lab will **not demonstrate** the #2 differentiator at all. The two claims — "first client is the showcase" and "altitude is the flagship differentiator" — cannot both be honored in Phase 1.

---

## MEDIUM

### M1 — "Altitude-adjusted reference ranges" is clinically over-claimed and unsourced
The PRD asserts "solid clinical grounding" and calls the result "clinically correct" (§9, FR-78), but altitude affects only specific analytes (chiefly hematology — hemoglobin/hematocrit), not reference ranges generally. A blanket "altitude dimension on reference ranges" risks being clinically **wrong** for analytes where altitude is irrelevant. No data source, authority, or validation method for the altitude ranges is cited. The partner doctor is exactly the stakeholder who will attack this, and mis-stated reference ranges carry clinical-liability exposure.

### M2 — Absolute "no competitor offers X" claims are fragile
§1/§9 assert no incumbent offers visual workflow tracking or automated altitude adjustment, sourced only to `research-market.md`. Absolute negatives collapse the moment one counterexample surfaces, and the entire pitch (points 1–2) rests on them. These should be hedged ("we found none among surveyed vendors") rather than stated as fact.

### M3 — G5 (cash discipline) and G1 (go-live) are measuring constraints, not outcomes
G5's "100% of operating days have opened/closed cash sessions" is enforced by design (FR-46 blocks orders without an open session), so it is 100% by construction — not an achievement. G1's "go-live by week 17" coincides with the only go-live week in the plan (week 17 = "go-live + hypercare"), i.e., the metric is just "ship on the last scheduled day," with **zero buffer**. Any slip fails G1 by definition.

### M4 — G7 (10 labs) and G8 ($15k MRR) are internally straining
10 labs at the entry plan (Reactivo $799) = ~$7,990 MRR — roughly half of the $15,000 target. Hitting G8 with G7's 10 labs requires an average of ~$1,500/lab, i.e., mostly Clínico/Red + add-ons. Both are flagged [ASSUMPTION], but they are presented together as if compatible; they imply a specific and unstated plan mix.

### M5 — 99.5% availability + hard cash-gating + no offline = a business-continuity gap
NFR-4 says "the lab cannot operate without the system" (cash gating FR-46, capture), targets 99.5% business-hours availability, and promises "graceful degradation messaging when offline." But offline **capture is Phase 3**, so "graceful degradation" in Phase 1/2 is merely a message telling staff they cannot take money or register patients. On Vercel serverless (addendum), ~2.5 hours/month of allowed downtime is time the lab literally cannot transact. No SLA exists (NFR-4 [ASSUMPTION]). The availability promise and the "cannot operate without the system" design are in unresolved tension.

### M6 — Public no-login portal vs. sensitive-health-data privacy (NFR-3)
FR-44 exposes patient name, studies, and results at a public `quimiaio.com/r/{token}` URL with **no authentication**. NFR-3 classifies this as sensitive health data requiring consent and encryption. A forwarded or leaked link exposes sensitive results to anyone. "Single-use or time-expiring" is configurable but no secure default is mandated. The convenience feature and the privacy NFR are not reconciled.

### M7 — ARCO deletion right (NFR-3) collides with immutable audit + retention (NFR-7, NFR-8)
NFR-3 promises to "delete patient data on request" (ARCO cancellation). NFR-7 makes the audit log append-only and undeletable, and NFR-8 mandates clinical-record retention per NOM-007/024. These legal obligations conflict, and the PRD asserts all three as **mandatory Phase 1 behaviors** without describing how a deletion request is honored against records that legally cannot be deleted.

### M8 — Portal token is described as both "immutable across edits" and "single-use / expiring"
FR-22 makes the QR token "immutable across edits"; FR-44 makes token policy "single-use or time-expiring." A single-use or expired token is, functionally, not a durable immutable handle to the order. The token's lifecycle semantics are contradictory as written and need one coherent definition.

### M9 — Phase 2 (~14 weeks) is even less credible than Phase 1
"~14 weeks (indicative)" is asked to carry FR-60…FR-82 — ~20 major features including Stripe billing, multi-tenant onboarding, WhatsApp, convenios with credit control, commissions, HL7/CSV interfacing, full BI, inventory, multi-branch, CFDI, the altitude engine, push, and signatures — again solo. The word "indicative" is doing enormous load-bearing work; on the Phase 1 evidence, this is optimistic by a wide margin.

---

## LOW

### L1 — Addendum claims "build Dashboard first" is consistent with the PRD; it isn't
The addendum's methodology section says the first module is "Dashboard + Auth + base layout (per maestro §12)" and calls this "consistent" with the PRD timeline. But Dashboard KPIs (FR-51) depend on orders, cash, and pipeline data, and the PRD schedules the Dashboard at **weeks 10–12**, not first. Building a data-dependent dashboard before its data sources exist contradicts the timeline; the addendum papers over the inconsistency.

### L2 — The data-model draft omits multiple Phase 1 domains
The addendum notes the Prisma sketch has no models for cash sessions, doctors, or audit log — all of which are **Phase 1** (FR-25–26, FR-46–49, FR-52–53). Half of Phase 1's persistence is not yet even sketched, which sits awkwardly against the fixed 17-week claim.

### L3 — Charting is "Phase 2" but appears throughout Phase 1
§6.10 frames "full BI with charts" as Phase 2 (FR-76), yet Phase 1 already ships a patient trend chart (FR-16), a 7-day revenue chart, and top-5 studies (FR-51). Charting infrastructure is being built in Phase 1 regardless; the phase framing understates Phase 1 scope.

### L4 — "Intentional overlap" of timeline weeks is meaningless for a solo developer
§11 says weeks 5 and 10 "overlap intentionally" so streams run "in parallel." One developer cannot parallelize. The overlap does not add capacity; it hides that the work does not fit the calendar.

### L5 — Provenance of positioning rests on two internal docs
`research-market.md` and `quimiaio-prompt-maestro.md` exist in the repo but are not independent evidence; every competitive claim, price confirmation, and much of the assumption set traces to them. A skeptical stakeholder will want the market claims backed by dated, external sources, not internal working files.

---

## Summary counts
- **CRITICAL:** 5 (C1–C5)
- **HIGH:** 9 (H1–H9)
- **MEDIUM:** 9 (M1–M9)
- **LOW:** 5 (L1–L5)
- **Total findings:** 28

## Top recommendations (if the plan is to be salvaged)
1. **Reconcile budget vs. scope explicitly.** State whether $32k is price or cost, and cut Phase 1 to a defensible MVP (defer RLS/multi-tenant, defer the PDF rich-text/image engine, defer trend charts) or re-baseline the timeline. The 17-week/45-FR/solo triangle does not close.
2. **Resolve the ToronjaLab retirement + invoicing + retention contradictions (C3/C4).** Either fund migration and CFDI in Phase 1 or drop G2's "retire in 4 weeks" and stop calling Phase 1 "complete."
3. **Rewrite the metrics that can't be measured or are vacuous** (G3, G5, G6, H2's counter-metric, G4's delivery-confirmation gap).
4. **Replace the bus-factor and scope-pressure "mitigations"** with real controls (contracted contingency, an explicit descoping list with owner sign-off).
5. **Soften absolute competitive claims and get clinical sign-off on the altitude model** before it appears in any client-facing document.
