---
source: index.html
reconciled: 2026-07-21
---

# Reconciliation: `index.html` vs `DESIGN.md` + `EXPERIENCE.md`

`index.html` is the one existing **built artifact** — not an application screen, but a static "coming soon" marketing/pre-launch landing page (vanilla HTML/CSS/inline JS, no framework, no routing, no backend wiring). Its value here is as the sole ground-truth reference for what brand execution actually shipped, which is why `DESIGN.md` treats it as an authoritative source for tokens and shape language even though it predates any real app screen.

## Covered — brand DNA carried forward with explicit reasoning

| Idea in index.html | Landed in |
|---|---|
| Dark navy body background (`#0D1B36`) for the entire page | `DESIGN.md` Brand & Style — explicitly reconciled via the "Hybrid Slate" direction: dark navy is scoped to sidebar/topbar chrome only, light `--bg` scoped to the content canvas. This was the single biggest tension in the sources (digest Open Question #2) and it's resolved with a named rationale, not silently picked |
| Logo lockup `<div class="logo">Quimia <span>IO</span></div>` (300 + 800 weight, cyan) | `DESIGN.md` Typography, `logo-light`/`logo-bold` — verbatim, flagged as the one non-negotiable brand mark |
| Headline "El sistema de laboratorio que **sí funciona**" | `DESIGN.md` Brand & Style, quoted directly as "the brand promise stated by the client" |
| Google Fonts weight range `wght@300;400;600;700;800` | `DESIGN.md` Typography — explicitly cited as the reason the fuller weight range was carried forward instead of the maestro's narrower 300/800-only spec |
| Pill-shaped buttons/inputs (`border-radius:99px`) | `DESIGN.md` Shapes — "the brand's inherited signature from the landing page — carry it forward into the app rather than treating the landing as marketing-only" |
| Translucent white-on-navy fills/borders (`rgba(255,255,255,…)` on inputs/chips) | `DESIGN.md` Components — `branch-switcher-chip` (`rgba(255,255,255,0.06)`) and `cash-status-chip` reuse the same translucent-on-navy visual language for topbar chips |
| Feature chips: "Expediente digital", "Resultados PDF", "Kanban de órdenes", "WhatsApp", "Código QR", "Multi-sucursal" | All six map 1:1 onto `EXPERIENCE.md` IA rows (Pacientes, Entrega, Pipeline Kanban, WhatsApp integration, Portal del Paciente, Red-plan multi-branch) |
| Accessibility shortcomings noted in the digest (no visible focus ring beyond border-color, low-opacity gray-on-navy contrast risk, no `aria-hidden` on decorative elements) | Substantially superseded — `EXPERIENCE.md` Accessibility Floor mandates WCAG 2.1 AA, an always-visible focus ring (`{components.input-pill}`), and screen-reader-safe status communication; `DESIGN.md` documents a specific resolved contrast fix for the gray token. The landing page's rough execution was treated as a lesson, not a pattern to repeat |

## Not carried forward (explained — correctly out of scope)

| Idea | Reason |
|---|---|
| Email-capture form + "Avísame" CTA, naive `.includes('@')` validation | Pre-launch marketing mechanic tied to a "coming soon" state the product has now moved past — not an app feature to reconcile, genuinely not applicable rather than dropped |
| "Próximamente" badge, "Sin spam. Solo te avisamos cuando lancemos." reassurance copy | Same as above — pre-launch-specific copy, superseded by the product actually existing |
| Two large radial-gradient decorative glow circles | Landing-page-only ornamentation; appropriately absent from a dense, data-heavy working application per `DESIGN.md`'s own "elevation is soft and shallow, this product never needs modal-on-modal drama" framing |
| No real app screens/nav (sidebar, topbar) in the built file | Expected — this is the reason the digest calls out zero existing app-screen prototype (Open Question #1/#9); `DESIGN.md`/`EXPERIENCE.md` had to design the shell from scratch, which they did |

## Dropped or at-risk ideas

1. **The 4px flat cyan top bar (`.top-bar`) is an unaddressed loose end.** It's a distinct decorative brand element on the landing page — a thin accent strip pinned to the viewport top — and it's never mentioned as either carried into the app shell or deliberately left as landing-only. `DESIGN.md`'s Elevation & Depth section does mention a "40px browser-chrome bar above the whole shell" from the *reference mock*, but explicitly calls that a presentation artifact of the mock, not a shipped UI element — a different, thicker bar than index.html's 4px accent strip, so it doesn't resolve this question either way. Low stakes, but worth a one-line decision (keep as an app-shell accent strip, or confirm it's marketing-only) so it doesn't get silently reinvented differently later.

No other qualitative content from this source appears to have been lost — `index.html` is small, and given it's the only built artifact, the spines lean on it unusually heavily and explicitly (four separate direct citations in `DESIGN.md` alone), which is the right amount of weight for the sole ground-truth reference in the source set.
