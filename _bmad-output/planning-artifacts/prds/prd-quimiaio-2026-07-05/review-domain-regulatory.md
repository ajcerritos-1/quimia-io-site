# Domain & Regulatory Review — Quimia IO PRD

> Reviewer lens: Mexican clinical-laboratory operations and health-sector regulation ONLY. General product/engineering quality is covered by other reviewers and is out of scope here.
> Documents reviewed: `prd.md`, `addendum.md`, `research-market.md` (dated 2026-07-05).
> Verification note: regulatory specifics below were checked against public sources (DOF, SAT catalogs, 2025 LFPDPPP coverage) where feasible. Points I could not fully confirm are marked **[UNVERIFIED]** rather than asserted.

## Verdict

The PRD is unusually regulation-aware for an SMB LIS and its core compliance instincts (RBAC, immutable audit, tenant isolation, sensitive-data handling, correct SAT product key) are sound — but it is anchored to a **superseded privacy-law regime**, under-specifies **CFDI 4.0 receptor requirements**, and is silent on several **operationally load-bearing lab workflows** (send-out/maquila studies, critical/panic values, sample rejection & recollection) that a real Mexican lab hits daily.

---

## Regulatory Findings

### R1 — LFPDPPP referenced as the old (2010) law; a new law replaced it in March 2025 — **CRITICAL**
The PRD (§8, NFR-3) and the research digest treat LFPDPPP as the 2010 statute enforced by INAI, with the classic ARCO framing and a "20-business-day response window." A **new Ley Federal de Protección de Datos Personales en Posesión de los Particulares was published in the DOF on 2025-03-20 and took effect 2025-03-21.** Confirmed changes relevant to this product:
- **INAI is dissolved.** The competent authority is now the Secretaría Anticorrupción y Buen Gobierno (Transparencia). Any privacy-notice text or ARCO-workflow copy that names INAI is wrong.
- The privacy notice (aviso de privacidad) requirements were restated, and ARCO exercise rules (especially rectification, cancellation, objection) were adjusted.
- The defense mechanism shifted to *amparo* before specialized courts (replacing the nullity trial before the TFJA).
- **[UNVERIFIED]** The exact ARCO response deadlines under the new law and its pending Reglamento — do NOT hardcode "20 business days" until confirmed against the new law/regulation.

**Why it matters:** health data is sensitive personal data; a privacy notice or ARCO flow citing a repealed law and a dissolved authority is a compliance defect the moment the product touches a real patient.

**Suggested fix:** Update §8 and NFR-3 to reference "LFPDPPP (2025)". Make the aviso de privacidad text and the named authority **configurable/parametrizable** (not hardcoded), add an open question for the new Reglamento and final ARCO deadlines, and defer any deadline literals to a config value. Add a note that legal copy should be lawyer-reviewed before go-live.

### R2 — CFDI 4.0 receptor data model is incomplete (RFC + Uso de CFDI is not enough) — **HIGH**
FR-82 and FR-12/FR-73 capture RFC and Uso de CFDI, but **CFDI 4.0's whole point vs 3.3 is stricter receptor validation.** A stampable 4.0 requires, at minimum, receptor **Nombre/Razón Social exactly as in the SAT Constancia de Situación Fiscal, Código Postal del domicilio fiscal, and Régimen Fiscal** — all validated by the PAC against the SAT name/RFC/CP list, or stamping fails. None of these three are in the PRD data capture.

**Suggested fix:** Extend the patient/company tax profile (and FR-82) to capture and validate `RazonSocial`, `DomicilioFiscalReceptor` (CP), and `RegimenFiscalReceptor`; state that the PAC round-trip validation is expected to reject mismatches. Add these to the Phase 2 CFDI scope explicitly.

### R3 — No handling for "público en general" / global daily invoice — **MEDIUM**
Most walk-in lab patients never request a nominal invoice. The standard SAT practice is a **CFDI global to "Público en general" (RFC XAXX010101000, Uso S01)** issued daily/periodically for un-invoiced tickets. FR-82 only describes per-order nominal CFDI. Without the global-invoice path, the lab either can't account for cash sales or issues incorrect CFDIs.

**Suggested fix:** Add a Phase 2 requirement for periodic global CFDI to público en general covering un-invoiced orders, with the RFC genérico and Uso S01, Régimen 616.

### R4 — IVA treatment of lab services is asserted-by-omission and is genuinely ambiguous — **MEDIUM**
FR-5 has a per-study "tax flag," which is good, but the PRD nowhere states the actual rule. Clinical-lab VAT treatment in Mexico is **not simple**: professional medical services rendered by individuals with a título can be IVA-exempt (LIVA art. 15), while a lab operating as a *persona moral* typically transfers 16% IVA. The SAT product-key catalog itself marks IVA transfer as "optional," which pushes the decision onto the lab. Leaving this to a bare boolean without guidance invites mis-invoicing.

**Suggested fix:** Keep the per-study tax flag but add a note (and an open question) that the lab's fiscal regime and título status determine IVA applicability, to be confirmed with the client's accountant during onboarding. Do not assert a default rate in the PRD.

### R5 — SAT product key 85121800 claim is CORRECT — **INFO (positive)**
Verified: **85121800 = "Laboratorios médicos" (servicios de análisis clínicos)**, valid in the CFDI 4.0 catalog since 2022-01-01, and the SAT-suggested key for clinical-lab billing. The PRD's assertion (§8, FR-82) is accurate. Preconfiguring it is reasonable; just allow per-study override for edge items (e.g., 85121500 pathology).

### R6 — NOM-024-SSA3-2012 mapping is reasonable but slightly over-scoped — **LOW**
NFR-2/§8 map NOM-024 to RBAC + audit + backups + password policy. That is defensible and conservative. Caveat for honesty: **NOM-024-SSA3-2012 is primarily an *interoperability/health-information-exchange* standard (SIRES, standardized catalogs, data-exchange), and its strict applicability to a small private-lab LIS is arguable.** Treating its security controls as a baseline is fine and low-risk; just avoid over-claiming "full NOM-024 compliance" — the interoperability obligations (standardized exchange formats) are NOT in Phase 1/2 scope. **[UNVERIFIED]** whether a small private lab is a formally obligated subject under NOM-024.

**Suggested fix:** Reword to "aligned with NOM-024 security controls (RBAC, audit, backups, password policy)" rather than blanket compliance; note interoperability clauses are out of scope.

### R7 — NOM-007 record-retention period is referenced but never quantified — **MEDIUM**
NFR-8 says data is "retained per NOM-007/NOM-024 record-keeping obligations" but sets no period. Retention duration is a concrete design input (backup lifecycle, deletion under ARCO cancellation, storage cost). Note the tension: ARCO *cancellation/deletion* rights vs. mandatory clinical-record retention — the lab cannot delete a record it is legally obliged to keep. **[UNVERIFIED]** exact lab-record retention period under current NOM-007; the analogous expediente clínico standard (NOM-004) is 5 years.

**Suggested fix:** Add a concrete retention target (candidate: 5 years, to confirm) and a documented rule that legally-mandated retention overrides ARCO deletion requests (deletion blocked/deferred until retention lapses, with the reason logged).

### R8 — Responsable sanitario / químico responsable not modeled beyond a PDF signature — **MEDIUM**
NOM-007 requires a designated *químico responsable* (professional cédula) accountable for the lab's results. The PRD captures a "responsible chemist signature" on the PDF (FR-11) but does not model the responsable's cédula profesional as a validated attribute of the validating químico, nor tie validation authority to it. In practice the validating químico's cédula should appear on the report.

**Suggested fix:** Add cédula profesional to the químico user profile and surface it (with the responsable sanitario) on the results PDF; consider gating "validate" to users who have a cédula on file.

### R9 — CFDI cancellation flow understates the current SAT regime — **LOW/MEDIUM**
FR-82 lists "cancellation" as a one-liner. Since the 2022+ rules, CFDI cancellation requires a **motivo de cancelación code (01–04)** and, for 01, the **UUID of the replacement CFDI**, plus the receptor-acceptance ("aceptación") flow for certain cases. A naive "cancel" button will fail against the PAC.

**Suggested fix:** Specify cancellation with motivo code + substitution UUID handling and acknowledge the acceptance window in the Phase 2 CFDI scope.

---

## Workflow Realism Findings

### W1 — No send-out / maquila / subrogación workflow — **HIGH**
Real small/medium Mexican labs routinely **subcontract specialized studies to reference labs** (maquila/subrogación) — they draw the sample, ship it out, and later transcribe or attach the external result. The order lifecycle (Reception → Sample received → In analysis → Validated → Delivered) and the Kanban have **no "sent to external lab / awaiting external result" state**, and results capture assumes in-house analysis. FR-75 (attach external equipment PDF) is Phase 2 and is about analyzers, not send-outs. This is one of the most common daily flows and its absence will bite in UAT.

**Suggested fix:** Add a study-level "maquila/external" flag and an order state "En laboratorio externo / awaiting external result," with a transcription-or-attach capture path. Even a minimal Phase 1 version (mark as external, park the Kanban timer) prevents the board from showing false red alerts on send-outs.

### W2 — No critical/panic-value ("valores de pánico") alerting — **HIGH**
Labs have a professional obligation to flag and urgently communicate critical results (e.g., glucose <40 or >500, K+ extremes, criticaly low platelets). FR-29 only does Normal/Low/High against reference range. A red-line critical value is a different concept from "out of range" and demands an alert + a documented notification to the treating physician.

**Suggested fix:** Add a per-analyte critical-value threshold set and a capture-time critical alert, plus an audit-logged "critical value notified to Dr. X at time" record. Reasonable to scope minimally in Phase 1 given liability.

### W3 — No sample rejection / recollection state — **MEDIUM**
FR-17 handles "sample pending," but there is no path for a **rejected/insufficient/hemolyzed sample requiring recollection.** In practice a non-trivial share of samples are rejected at pre-analytical stage. Without it, the Kanban can't represent reality and TAT metrics (G3) will be distorted.

**Suggested fix:** Add a "sample rejected — recollect" transition with a reason code; exclude rejection-to-recollection gaps from TAT, or track them separately.

### W4 — Kanban 45/90-min fixed thresholds are unrealistic as a single global rule — **MEDIUM**
Turnaround varies enormously by study: a BH (biometría hemática) is minutes; a culture (cultivo) is 24–72h; hormones/send-outs are days. A single 45-min yellow / 90-min red rule (FR-38) will paint most cultures and send-outs permanently red, training staff to ignore the color — the opposite of the intended "see your lab" value. The PRD acknowledges configurability only in Phase 2 (FR-79), but the problem is per-study TAT, not per-lab.

**Suggested fix:** Even in Phase 1, base the alert on the study's declared processing time (the catalog already has "processing days," FR-5/FR-8) rather than a flat 45/90 for everything. At minimum, suppress time alerts for studies whose expected TAT exceeds the day.

### W5 — Single-step químico validation; no technical-vs-clinical distinction — **LOW**
FR-31 collapses capture and validation onto the químico role. This is realistic for a one-químico lab. Flagging only so the architecture doesn't hard-code an assumption that breaks when a lab has separate técnico (captures) and químico (validates) roles — which Phase 2 multi-tenant labs will have. The role model should allow, not preclude, a two-step capture→validate separation.

**Suggested fix:** Keep Phase 1 single-step, but note the validation event should be role-attributable so a técnico/químico split is a config change, not a rewrite.

### W6 — Altitude-adjusted reference ranges: clinically sound, but "city msnm lookup" oversimplifies — **LOW**
The differentiator is legitimate — Mexican literature does confirm hemoglobin/hematocrit reference shifts with altitude (WHO also adjusts anemia cutoffs by altitude). Two realism notes: (1) the adjustment is a **known formula/step-table (WHO altitude adjustment), not a free per-city range** — model it as an adjustment function keyed on msnm, not as a separate hand-entered range per city, or maintenance becomes unmanageable; (2) altitude adjustment applies to a **specific subset of analytes** (mainly Hb/Hct and derived indices), not all referenced analytes. Deferring to Phase 2 (FR-78) is the right call.

**Suggested fix:** In Phase 2, implement altitude as an adjustment applied to flagged analytes using a documented formula/table, not as an altitude-labeled duplicate of every reference range.

### W7 — Cash-session gating is disciplined and realistic — **INFO (positive)**
FR-24/FR-46 (no order without an open caja) matches how tightly run small labs actually operate and is a genuine control strength. No change needed for Phase 1. (Phase 2 note: convenio/credit orders and possible emergency exceptions will need a defined bypass — already implied by the credit-control feature.)

### W8 — Patient portal delivery is realistic but see S3 for its privacy exposure — **INFO**
Tokenized public link with configurable expiry (FR-44) matches market expectation (microsites/links). The delivery mechanics are fine; the concern is a privacy one, treated in Silent Risks.

---

## Silent Risks (domain issues the PRD does not address)

### S1 — Consent for WhatsApp/email delivery of sensitive results — **HIGH**
Phase 2 pushes results and portal links over WhatsApp/email (FR-72), and Phase 1 emails PDFs (FR-42). Sending **sensitive health data over these channels requires specific, documented patient consent** under LFPDPPP, separate from the general aviso de privacidad, and a wrong number/email is a data breach. The PRD captures "explicit consent" generically (NFR-3) but not channel-specific delivery consent.

**Suggested fix:** Capture per-channel delivery consent at registration/order (portal / email / WhatsApp) and record it; make the delivery channel gated on that consent.

### S2 — Data-breach notification obligation is unaddressed — **MEDIUM**
LFPDPPP requires notifying affected data subjects of security breaches affecting their personal data. A multi-tenant health SaaS with cross-tenant isolation as a release-blocker (NFR-1) should have a breach-response obligation named. The PRD treats isolation as a defect class but not the legal notification duty if it fails.

**Suggested fix:** Add an NFR / operational requirement for breach detection and subject-notification procedure; tie it to the audit log.

### S3 — Public tokenized portal exposes sensitive results with no identity check — **HIGH**
FR-44 serves patient name + results at `quimiaio.com/r/{token}` with **no login**. Anyone with the link (forwarded, shoulder-surfed, in a shared family phone, in browser history on a shared PC) sees sensitive health data. Single-use / time-expiry helps but does not authenticate the viewer. For sensitive personal data this is a real LFPDPPP exposure.

**Suggested fix:** Add a lightweight second factor before revealing results (e.g., patient birth date or last-4 of phone) even on the public link; keep expiry; log accesses. This preserves the no-account UX while raising the bar above "link = full access."

### S4 — COFEPRIS operating prerequisites not surfaced — **LOW**
NOM-007 compliance presumes the lab holds the required COFEPRIS aviso de funcionamiento / responsable sanitario designation. Not the software's job to enforce, but the client-facing deliverable and onboarding checklist should note that the LIS assumes the lab is already sanctioned to operate. Purely a documentation gap.

**Suggested fix:** Add a one-line onboarding precondition: lab must have current COFEPRIS aviso de funcionamiento and designated responsable sanitario.

### S5 — Amended/corrected report after delivery has no defined artifact — **MEDIUM**
FR-32 allows invalidate + recapture with reason, but once a result has been delivered to the patient/physician, a correction needs a **clearly marked corrected/amended report (with version and reason)**, not a silent overwrite of the same PDF/token. Otherwise the patient's downloaded PDF and the portal disagree with no trace of why.

**Suggested fix:** Define that post-delivery re-validation produces a versioned "resultado corregido" report, preserves the prior version, and re-notifies via the original channel.

### S6 — Reference-range provenance / clinical sign-off not tracked — **LOW/MEDIUM**
Reference ranges (FR-7/FR-10) are editable inline and audit-logged for *who/when*, but not for *clinical source/justification*. Reference ranges are a patient-safety artifact; a lab should be able to show the source (method insert, literature) behind each range, especially for the altitude engine later.

**Suggested fix:** Add an optional "source/justification" note field to reference-range records; encourage its use for auditability.

### S7 — CURP optional but portal/CFDI identity relies on weak patient identity — **LOW**
FR-12 makes CURP optional and RFC appears only for CFDI. That is fine operationally, but combined with S3 (portal identity via patient data) and R2 (CFDI needs exact fiscal identity), weak/duplicate patient records will cause both privacy and invoicing friction. Duplicate-patient detection is not mentioned.

**Suggested fix:** Add basic duplicate-patient detection (name+birthdate / phone) at registration; note that CFDI requires the fiscal identity to be captured and validated separately from clinical identity.

---

## Severity Counts

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 1 | R1 |
| High | 4 | R2, W1, W2, S1, S3 → (5 items; R2/W1/W2/S1/S3) |
| Medium | 8 | R3, R4, R7, R8, W3, W4, S2, S5 |
| Low | 6 | R6, R9, W5, W6, S4, S6, S7 → (7 items) |
| Info/positive | 3 | R5, W7, W8 |

> Note: High = 5 items (R2, W1, W2, S1, S3); Low = 7 items (R6, R9, W5, W6, S4, S6, S7). Counts corrected inline.

## Top priorities before build

1. **R1 (Critical):** Re-baseline all privacy references to the 2025 LFPDPPP; parametrize the aviso and the authority name; do not hardcode ARCO deadlines.
2. **W1 (High):** Add send-out/maquila workflow + Kanban state — this is a daily reality the current lifecycle can't represent.
3. **W2 (High):** Add critical/panic-value alerting — patient-safety and liability.
4. **S3 / S1 (High):** Add a lightweight identity check on the public results portal and channel-specific delivery consent.
5. **R2 (High):** Complete the CFDI 4.0 receptor tax model (Razón Social, CP fiscal, Régimen Fiscal) before the invoicing add-on.
