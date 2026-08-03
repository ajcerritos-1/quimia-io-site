---
source: "Proyecto QuimiaIO Specs.docx"
reconciled: 2026-07-21
---

# Reconciliation: `Proyecto QuimiaIO Specs.docx` vs `DESIGN.md` + `EXPERIENCE.md`

**Extraction method:** the .docx was read directly (not solely via the digest) by unzipping the OOXML package and extracting `word/document.xml` paragraph-by-paragraph with a small script, preserving the original line/paragraph structure. `.working/source-digest.md`'s docx quotes were used as a cross-check index, not as the sole source — the raw extraction was read in full for this reconciliation.

This is the client's own raw, unstructured voice notes — informal Spanish, run-on sentences, inline uncertainty markers ("NOTA: ...", "no me queda claro", "TE LO ENCARGO MUCHO"). It's the rawest material behind `quimiaio-prompt-maestro.md`, which cleans up and organizes most of the same content. Because of that overlap, this reconciliation focuses on: (a) ideas unique to the client's raw phrasing that the maestro's cleanup may have smoothed over, (b) whether the client's explicit points of confusion got resolved by later design decisions, and (c) corroborating or new signal not already covered in the maestro reconciliation.

## Covered — ideas that landed (directly or via resolution of a stated confusion)

| Idea in docx (client's own words/paraphrase) | Landed in |
|---|---|
| "Nivel de Mar" altitude config, named examples (La Paz, CDMX) | `EXPERIENCE.md`/maestro's altitude-adjustment rule — generic altitude config carried, without repeating city examples (acceptable at spine granularity) |
| "Agregar Doctor... botones agregar doctor, imprimir tabla" | Doctor CRUD + price lists in `EXPERIENCE.md` IA table (print-table affordance itself not restated — see below) |
| "Cambiar orden: para cambiar el orden de los estudios... vamos al modulo de captura" | `EXPERIENCE.md` Component Patterns, **Study reorder** — directly resolves the client's own open question about where/how this happens |
| "Editar Analitos, se puede revisar el pdf y si está mal se puede editar, se invalidan los resultados previos" | `EXPERIENCE.md` State Patterns, correction/invalidation flow |
| Client emphasis "VEO QUE ES IMPORTANTE ESTE ANALITO, TE LO ENCARGO MUCHO" (analito editor) | Honored in spirit — the **Evidence gallery** and **Constrained document editor** patterns in `EXPERIENCE.md` are unusually detailed/considered relative to other components, consistent with the weight the client placed on getting this right |
| "Analito tipo imagen, ancho, alto, izquierda, centro, derecha" | `EXPERIENCE.md` **Evidence gallery** — superseded by a more constrained, deliberate design (auto-fit preset crop sizes instead of manual width/height/alignment fields); resolves Open Question #5 from the digest |
| "Analito tipo documento... abre un editor de texto... se muestra el documento y se puede modificar ahí mismo" | `EXPERIENCE.md` **Constrained document editor** |
| "resultados en rojo por dos motivos; por adeudo, o por ordenes canceladas" | Partially — the *adeudo* half is well covered (debt-gate, `adeudo` status pill); the *cancelled-order* half is **not** covered — see Dropped section, and this corroborates the same gap flagged in the maestro reconciliation |
| "Apertura Caja... no me queda claro muy bien para que sirve este modulo" (client explicitly unsure what this module is for) | **Resolved, not just carried** — `EXPERIENCE.md` State Patterns' Caja section (lazy per-branch/per-day trigger, shift labels as display metadata only, one session per branch per day) directly answers the client's own stated confusion, even though it isn't framed as "resolving a client question" |
| "Roles de Usuario... permisos" flat checkbox list (editar solicitud, cierre de caja, usuarios, precios, recepción, etc.) | `EXPERIENCE.md` Component Patterns, **Permission matrix** — client's flat list re-organized into grouped module headers, an improvement over the raw ask |
| "NOTA: ESTO NO SE COMO SE MANEJA" next to calculated-analyte capture | Still **open** — see Dropped section; this is the one client-flagged uncertainty that did *not* get resolved by either spine |
| Código de colores en captura (pendiente/en proceso/validado) | Reflected conceptually via Normal/Low/High highlighting and the correction-history/status-pill system, not a literal 1:1 restatement |

## Not carried forward (explained)

| Idea | Reason |
|---|---|
| Named equipment examples (Mindray BS, Spin 120, Biobas 10) | Implementation/catalog-seed detail, not a UX pattern — correctly left out of a spine document |
| Empresa `Tipo: Empresa o Laboratorio`, `Maneja Crédito: Si/No` fields | Field-level catalog detail; UX spines describe patterns, not exhaustive form fields — reasonable omission at this altitude |
| "CAJA DE DIAS ANTERIORES... Exportar a Excel" (Caja historical query, Excel export) | Reporting/operational detail beyond spine scope; no UX pattern implication beyond what's already covered by Caja/Reportes IA rows |
| Pago1/pago2/pago3 columns in the Relaciones folio table | Report field-level detail, not a UX/interaction pattern |

## Dropped or at-risk ideas

1. **Cancelled-order red state — corroborates the same gap found in the maestro reconciliation.** The client's own raw note says results show red for **two** reasons — debt or cancellation — and this docx independently confirms it wasn't a maestro paraphrasing artifact: it's a genuine client requirement in the rawest source. Neither `DESIGN.md`'s status-pill component nor `EXPERIENCE.md`'s pipeline/delivery description account for a cancelled-order visual treatment anywhere. This is the strongest finding across all three reconciliations — worth resolving before screen design.

2. **The calculated-analyte capture/validation mechanism is still an open question the client raised and nobody answered.** The client's own note — "NOTA: ESTO NO SE COMO SE MANEJA" ("I don't know how this is handled"), placed right after describing auto-calculated analytes (values computed from other captured analytes) needing a "Validar" button — flags a genuine business-logic gap in the client's own understanding. `.working/source-digest.md`'s Open Questions section (#3) already surfaced this, but neither `DESIGN.md` nor `EXPERIENCE.md` describes how a calculated analyte behaves during capture (is it read-only and auto-populates as inputs are typed? does it require its own explicit confirmation, or ride along with the study's single Validar action?). Since the digest's other open questions (image/document analyte UI, study reorder, permission matrix) all got resolved into concrete patterns, this one being the sole holdout is notable — it needs a business-side walkthrough with the client before capture-screen design, exactly as the digest recommended.

3. **Reporte de ventas ambition ("debe ser mejor que cualquier actual" — "must be better than any current [system]")** is a qualitative bar-raising statement from the client, not a concrete feature. `EXPERIENCE.md`'s IA table treats Reportes y Análisis as a fairly generic entry ("Sales reports, relationship tables, multi-branch dashboard"). This isn't a functional gap, but the client's explicit "outdo the competition" framing for this specific module isn't echoed anywhere as a design priority — worth keeping in mind when this module actually gets designed, so it doesn't default to a generic table+filter treatment.
