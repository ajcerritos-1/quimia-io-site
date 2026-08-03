---
status: final
updated: 2026-07-29
name: Quimia IO
description: Multi-tenant clinical-lab SaaS (LIS) for Mexican labs pursuing ISO 15189 — Hybrid Slate direction, dark navy navigation chrome over a light, prolonged-use content canvas.
colors:
  navy: '#0D1B36'
  navy-topbar: '#0F2044'
  navy-chrome: '#0B1730'
  accent: '#00C4E0'
  accent-text: '#067484'
  accent-lt: '#E0F8FF'
  bg: '#F0F6FF'
  surface: '#FFFFFF'
  surface-sunken: '#F8FAFF'
  text: '#0F172A'
  gray: '#607089'
  border: '#E2E8F0'
  ok: '#10B981'
  ok-text: '#0B7A57'
  warn: '#F59E0B'
  warn-text: '#B45309'
  error: '#EF4444'
  error-text: '#B91C1C'
typography:
  logo-light:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '300'
    fontSize: 20px
  logo-bold:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '800'
    fontSize: 20px
  page-title:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '700'
    fontSize: 20px
    lineHeight: '1.3'
  section-title:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '700'
    fontSize: 14.5px
  kpi-value:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '800'
    fontSize: 34px
  body:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '400'
    fontSize: 13px
    lineHeight: '1.5'
  label:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '700'
    fontSize: 11px
    letterSpacing: 0.04em
  micro:
    fontFamily: 'Plus Jakarta Sans'
    fontWeight: '700'
    fontSize: 10.5px
rounded:
  sm: 10px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 14px
  '5': 18px
  '6': 20px
  '7': 22px
  '8': 26px
  '9': 28px
  '10': 32px
  sidebar-pad: '20px 14px'
  gutter: 18px
components:
  sidebar-nav-item:
    background: 'transparent'
    background-active: 'rgba(0,196,224,0.14)'
    color: '#8291A8'
    color-active: '#FFFFFF'
    icon-color: '#4B5A73'
    icon-color-active: '{colors.accent}'
    radius: '{rounded.md}'
  button-primary:
    background: '{colors.accent}'
    foreground: '{colors.navy}'
    radius: '{rounded.full}'
  button-critical:
    background: '{colors.error}'
    foreground: '#FFFFFF'
    radius: '{rounded.full}'
  input-pill:
    background: '{colors.surface}'
    border: '{colors.border}'
    border-focus: '{colors.accent}'
    ring-focus: '{colors.accent-lt}'
    radius: '{rounded.full}'
  kpi-card:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    shadow: '0 2px 12px rgba(13,27,54,0.05)'
  kanban-column:
    background: '{colors.surface-sunken}'
    border: '{colors.border}'
    radius: 14px
  kanban-card:
    background: '{colors.surface}'
    radius: '{rounded.md}'
    shadow: '0 1px 4px rgba(13,27,54,0.05)'
  kanban-card-warning:
    background: '#FFFBEB'
    ring: '1.5px solid #FDE68A'
  kanban-card-aging:
    background: '#FEF2F2'
    ring: '1.5px solid #FCA5A5'
  status-pill:
    radius: '{rounded.full}'
    recepcion: {background: '#EFF6FF', foreground: '#2563EB'}
    en-analisis: {background: '#FEF3C7', foreground: '{colors.warn-text}'}
    validado: {background: '{colors.accent-lt}', foreground: '{colors.accent-text}'}
    entregado: {background: '#D1FAE5', foreground: '#047857'}
    adeudo: {background: '#FEF3C7', foreground: '#92400E'}
    cancelado: {background: '#F1F5F9', foreground: '#475569'}
  branch-switcher-chip:
    background: 'rgba(255,255,255,0.06)'
    foreground: '#E7ECF5'
    caret-color: '{colors.accent}'
    radius: '{rounded.full}'
  cash-status-chip:
    background: 'rgba(16,185,129,0.16)'
    foreground: '#5EEAD4'
    dot: '{colors.ok}'
    radius: '{rounded.full}'
  data-table-row-aging:
    background: '#FFF7F7'
  data-table-row-debt:
    background: '#FFFBEB'
  evidence-gallery:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.md}'
    item-radius: '{rounded.sm}'
  document-editor:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.sm}'
  correction-history-popover:
    background: '{colors.surface}'
    radius: '{rounded.md}'
    shadow: '0 2px 12px rgba(13,27,54,0.05)'
  signature-pad:
    background: '{colors.surface}'
    border: '1.5px dashed {colors.border}'
    radius: '{rounded.md}'
  critical-alert:
    background: '{colors.surface}'
    border-left: '4px solid {colors.error}'
    radius: '{rounded.lg}'
    shadow: '0 2px 12px rgba(13,27,54,0.05)'
  print-preview-panel:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    shadow: '0 2px 12px rgba(13,27,54,0.05)'
---

# Quimia IO — Design Spine

## Brand & Style

Quimia IO is enterprise lab infrastructure that has to survive an 8-, 10-, or 12-hour shift on the same screen without fatiguing the people running it — químicos capturing hundreds of analytes a day, receptionists keyboarding an order every two minutes. The brand promise stated by the client is direct: "el sistema de laboratorio que sí funciona" — a system that actually works, in contrast to the brittle, transcription-prone tools the segment is used to. The visual language has to read as **soft, professional, reliable** — a serious, trustworthy vibe, never playful — while staying fast to scan and fast to navigate.

The direction is **Hybrid Slate**: it resolves a real conflict surfaced during discovery between the brand's only built artifact (a fully dark-navy marketing landing page) and the design tokens' stated light app background. Hybrid Slate keeps the dark navy chrome — sidebar and topbar — as the brand-carrying frame inherited from the landing page, and puts a light, low-fatigue canvas (`{colors.bg}`) underneath it for every surface where people work for hours: tables, forms, capture screens, the Kanban board. Dark chrome says "this is Quimia IO"; light canvas says "you can read this for ten hours." Neither identity is compromised — they're assigned to different jobs. See `mockups/direction-hybrid-slate.html` for the reference implementation of this direction, and `mockups/key-*.html` for the four rendered key screens (Dashboard, Captura, Kanban, Critical-overlay) — this spine wins over any mock where the two disagree.

This is a multi-tenant commercial SaaS serving labs pursuing ISO 15189 accreditation, so the visual system also has to carry an institutional weight: validation states, audit trails, and correction history are first-class visual citizens, not afterthoughts bolted onto a generic CRUD UI.

## Colors

- **Navy (`{colors.navy}` `#0D1B36`)** is the brand anchor. Used exclusively on the sidebar and as the base for the topbar (`{colors.navy-topbar}`, a slightly lifted `#0F2044` panel tone) and browser/deepest-chrome accents (`{colors.navy-chrome}` `#0B1730`). Never used as a content-canvas background — navy is navigation, not workspace.
- **Accent Cyan (`{colors.accent}` `#00C4E0`)** is the "IO" of the brand — active nav state, focus rings, icon accents, primary-button fills. **Text-unsafe on light surfaces** (see Accessibility below): raw accent is a fill/icon/dot color only.
- **Accent Text (`{colors.accent-text}` `#067484`)** is the darkened, text-safe cyan used wherever cyan needs to carry copy on a light surface — the "Validado" status-pill label, section-title link affordances ("Ver tablero completo →"). The Hybrid Slate reference file's original substitution (`#0891A6`) measured under 4.5:1 against both its actual use surfaces (white and `{colors.accent-lt}`); this token was darkened to `#067484` to clear WCAG 2.1 AA — see Accessibility Floor. Treat it as the canonical text form of the accent.
- **Accent Light (`{colors.accent-lt}` `#E0F8FF`)** is the soft-cyan fill for the active sidebar-item background and the "Validado" pill background.
- **Canvas (`{colors.bg}` `#F0F6FF`)** is the general light app background for every prolonged-use surface — tables, forms, Kanban board, capture screens.
- **Surface (`{colors.surface}` `#FFFFFF`)** sits one step up from canvas for cards, panels, and table containers. **Surface Sunken (`{colors.surface-sunken}` `#F8FAFF`)** sits one step down, used for the Kanban column trays that hold surface-level cards.
- **Text (`{colors.text}` `#0F172A`)** is primary copy everywhere. **Gray (`{colors.gray}` `#607089`)** is secondary copy — labels, timestamps, subtitles. See Accessibility Floor: gray-on-canvas now clears the WCAG 2.1 AA 4.5:1 floor at any size/weight.
- **Border (`{colors.border}` `#E2E8F0`)** is the universal hairline — card outlines, table dividers, input borders at rest.
- **Semantic triad — Ok/Warn/Error** (`{colors.ok}` `#10B981`, `{colors.warn}` `#F59E0B`, `{colors.error}` `#EF4444`): validated/delivered, aging/near-threshold, and critical/debt respectively. Each is a **fill, dot, and badge-background color only** — never raw text on a light surface (see Accessibility Floor). Each has a paired darker **-text** token (`{colors.ok-text}` `#0B7A57`, `{colors.warn-text}` `#B45309`, `{colors.error-text}` `#B91C1C`) for the rare cases where the semantic color needs to carry copy (KPI deltas, critical-alert headlines).

## Typography

Single family: **Plus Jakarta Sans**, loaded at weights 300/400/600/700/800 (the fuller range actually shipped in the landing page, wider than the maestro's original 300/800-only spec — carry the fuller range forward since it's what's already live).

- **`{typography.logo-light}` / `{typography.logo-bold}`** — the lockup is two weights of the same size: "Quimia" at 300, " IO" at 800 in `{colors.accent}`. This pairing is the one non-negotiable brand mark; never reweight or recolor it.
- **`{typography.page-title}`** (20px/700) — one per screen, the "Buenos días, {name}" / module-name header.
- **`{typography.section-title}`** (14.5px/700) — section headers within a screen ("Pipeline del día", "Órdenes recientes").
- **`{typography.kpi-value}`** (34px/800) — the single largest type on the product; reserved for dashboard KPI numbers, nothing else competes with it.
- **`{typography.body}`** (13px/400) — table cells, form values, running copy.
- **`{typography.label}`** (11px/700, uppercase, `0.04em` tracking) — table column headers, Kanban column titles, badge/eyebrow text.
- **`{typography.micro}`** (10.5px/700) — timestamps and keyboard hints (e.g. "⇥ Tab → siguiente campo").

## Layout & Spacing

Spacing runs a tight, near-4px-based scale (`{spacing.1}`…`{spacing.10}`, 4px→32px) tuned to a dense, data-heavy product — this is not an editorial or breathing-room-first surface. `{spacing.gutter}` (18px) governs the KPI row and Kanban row grid gaps; the sidebar carries its own compound padding (`{spacing.sidebar-pad}`, `20px 14px`).

The app shell is a fixed two-region layout: a 232px sidebar (`{colors.navy}`) plus a fluid main column. The main column stacks a 68px topbar (`{colors.navy-topbar}`) over a scrollable content area on `{colors.bg}`. Content area padding is generous relative to the internal component spacing (26px top, 28px sides) to give the dense KPI/Kanban/table stack room to breathe against the canvas edge. A 4px `{colors.accent}` cyan strip is pinned above the topbar at the very top of the viewport — an inherited brand touch carried forward from the landing page (`index.html`), kept deliberately rather than treated as marketing-only.

Per NFR-6, every screen must remain usable at phone width — the sidebar collapses to an off-canvas drawer and the topbar compresses to a single row; reception and delivery flows are explicitly tuned for tablet/desktop (their primary work surface), while the patient portal is tuned for phone first. Behavioral detail lives in `EXPERIENCE.md.Responsive & Platform`.

## Elevation & Depth

Elevation is soft and shallow — this product never needs a modal-on-modal drama; its job is legible data density. Two shadow weights cover everything on the light canvas:

- **Card shadow** — `0 2px 12px rgba(13,27,54,0.05)`–`rgba(13,27,54,0.06)` — used on KPI cards, panel cards, the "rationale" chrome. Barely-there; it separates a card from canvas without competing with the data on it.
- **Compact-card shadow** — `0 1px 4px rgba(13,27,54,0.05)` — used on Kanban cards, which stack many per column and can't afford a heavier shadow each.

Dark-chrome surfaces (sidebar, topbar) carry no shadow language of their own — their separation from the canvas comes from the navy/light color break, not elevation. A single 40px browser-chrome bar above the whole shell (`{colors.navy-chrome}`) is a presentation artifact of the reference mock, not a shipped UI element.

## Shapes

Two families, deliberately split by role:

- **Pill radius (`{rounded.full}`, 9999px)** on every interactive control that takes direct input or click: buttons, text inputs, status pills/badges, chips (branch switcher, cash-status), avatars. This is the brand's inherited signature from the landing page — carry it forward into the app rather than treating the landing as marketing-only.
- **Card radius scale (`{rounded.sm}` 10px → `{rounded.md}` 12px → `{rounded.lg}` 16px → `{rounded.xl}` 20px)** on every container: nested form fields (`sm`), sidebar nav items and Kanban/table-row cards (`md`), KPI and panel cards (`lg`), top-level shell framing (`xl`).

Never mix families on the same element — a control is either a pill (it's actionable) or a rounded-rectangle (it's a container).

## Components

- **Sidebar nav item** (`components.sidebar-nav-item`) — 13.5px/600 label, `#8291A8` at rest, white + `{colors.accent-lt}`-tinted background (`rgba(0,196,224,0.14)`) when active; icon dims to `#4B5A73` at rest, brightens to `{colors.accent}` active. `{rounded.md}` radius.
- **Primary button** (`components.button-primary`) — `{colors.accent}` fill, `{colors.navy}` text, `{rounded.full}`. Used for the primary action per screen (e.g. "Confirmar lectura" on a critical-value alert is the exception — see Do's and Don'ts).
- **Critical button** (`components.button-critical`) — `{colors.error}` fill, white text, `{rounded.full}`. Reserved for the single action that resolves a blocking critical/alert state.
- **Pill input** (`components.input-pill`) — `{rounded.full}`, `{colors.border}` border at rest; on focus, border switches to `{colors.accent}` with a 3px `{colors.accent-lt}` ring — the same focus treatment must be visible and keyboard-triggerable everywhere (Accessibility Floor).
- **KPI card** (`components.kpi-card`) — white surface, `{rounded.lg}`, label in `{colors.gray}`, value in `{typography.kpi-value}`, delta line in `{colors.ok-text}` (positive) or `{colors.warn-text}` (attention) — never the raw `{colors.ok}`/`{colors.warn}` fill color as text.
- **Kanban column** (`components.kanban-column`) — `{colors.surface-sunken}` tray, `{colors.border}` outline, `{typography.label}` header with a navy pill-badge count.
- **Kanban card** (`components.kanban-card`) — white, `{rounded.md}`; two escalating time-alert variants per FR-38's yellow/red semantics. The **warning variant** (`components.kanban-card-warning`, first threshold — 45min default) swaps to a `#FFFBEB` fill with a 1.5px `#FDE68A` inset ring and `{colors.warn-text}` timestamp. The **aging variant** (`components.kanban-card-aging`, second threshold — 90min default) swaps to a `#FEF2F2` fill with a 1.5px `#FCA5A5` inset ring and `{colors.error-text}` timestamp. Do not hardcode "45 min / 90 min" into either component — thresholds are lab-configurable in Phase 2 (FR-79).
- **Status pill** (`components.status-pill`) — one `{rounded.full}` component with six semantic variants (`recepcion`, `en-analisis`, `validado`, `entregado`, `adeudo`, `cancelado`) mapping 1:1 to the Kanban pipeline states plus the debt flag and the cancelled terminal state. `cancelado` uses a neutral slate treatment (`#F1F5F9`/`#475569`) — deliberately muted, distinct from the semantic error/red used for debt, since a cancelled order is a closed non-issue, not an active alert. Debt (`adeudo`) always renders as an *additional* pill next to the state pill, never replacing it — an order can be simultaneously `validado` and in debt. A cancelled order's whole Kanban card additionally renders at reduced opacity (~0.72), on top of the `cancelado` pill, so it visually recedes on the board (see `mockups/key-kanban.html`).
- **Analyte source tag** — a small `{rounded.full}` tag co-located with the analyte label in Captura, distinguishing where a value came from: `Automático` (`{colors.accent-lt}` background / `{colors.accent-text}` label) for device-interfaced values, `Calculado` (neutral `#F1F5F9`/`#475569`) for derived analytes (e.g. LDL). A manually-typed analyte carries no tag at all — the tag's absence is itself the "manual" signal, satisfying the device-vs-manual distinction required by `EXPERIENCE.md.Inspiration & Anti-patterns` without a redundant third badge (see `mockups/key-captura.html`).
- **Reference range annotation** — `{typography.micro}` text in `{colors.gray}`, rendered next to (or directly below) every analyte value in Captura; always visible, never conditional on hover/click or on in/out-of-range state — a precision annotation, not a status signal, so it stays outside the semantic ok/warn/error triad. Sits alongside, not instead of, the Normal/Low/High highlight. Behavioral spec lives in `EXPERIENCE.md.Component Patterns`.
- **Branch-switcher chip** (`components.branch-switcher-chip`, Phase 2) — topbar dropdown trigger, translucent-white fill on navy, cyan caret. Behavioral spec (the "Todas las sucursales" option, dropdown contents) lives in `EXPERIENCE.md.Component Patterns`.
- **Cash-status chip** (`components.cash-status-chip`) — topbar-resident, green-tinted pill with a live pulse dot, showing open-since time. Behavioral spec (lazy per-branch trigger, one session per branch per calendar day) lives in `EXPERIENCE.md.State Patterns`.
- **Data-table row states** (`components.data-table-row-aging`, `components.data-table-row-debt`) — full-row tint (`#FFF7F7` aging, `#FFFBEB` debt) layered under the normal cell content and status pills, so a row's urgency is scannable without reading every cell.
- **Evidence gallery** (`components.evidence-gallery`) — white surface, `{colors.border}` outline, `{rounded.md}` container framing the in-app crop tool; individual evidence items are `{rounded.sm}` thumbnails with a visible drag handle. Behavioral spec (crop presets, captions, keyboard reorder) lives in `EXPERIENCE.md.Component Patterns`.
- **Constrained document editor** (`components.document-editor`) — white surface, `{colors.border}` outline, `{rounded.sm}`; renders at the same font/column width as the final PDF so the edit surface *is* the preview, toolbar limited to bold/italic/lists/headings. Behavioral spec lives in `EXPERIENCE.md.Component Patterns`.
- **Study reorder** — visually identical to `components.evidence-gallery`'s item treatment (surface, `{colors.border}`, `{rounded.sm}`, drag handle), applied one level up to the order's study list instead of in-study evidence — no separate token entry needed since chemists learn one drag gesture for both. Behavioral spec lives in `EXPERIENCE.md.Component Patterns`.
- **Correction history popover** (`components.correction-history-popover`) — white surface, `{rounded.md}`, card shadow (`0 2px 12px rgba(13,27,54,0.05)`); a compact inline popover anchored to its analyte's history icon, distinct from a full modal. Behavioral spec lives in `EXPERIENCE.md.Component Patterns`.
- **Signature pad** (`components.signature-pad`) — white surface, `{rounded.md}`, dashed `{colors.border}` outline signaling "draw here"; a text-only "Borrar / Reintentar" action sits below the canvas. Behavioral spec lives in `EXPERIENCE.md.Component Patterns`.
- **Critical alert** (`components.critical-alert`) — white surface, `{rounded.lg}`, card shadow, with a 4px `{colors.error}` left-edge accent border rather than a full error fill — reads as "you must act here" without an alarming red wash; headline copy in `{colors.error-text}`. Distinct from `components.button-critical` (the acknowledgment action button it contains). Used for the dashboard critical-value acknowledgment card (FR-29); behavioral spec lives in `EXPERIENCE.md.State Patterns`. See `mockups/key-dashboard.html` and `mockups/key-critical-overlay.html` for rendered references, including the correction-history popover shown alongside it in the latter.
- **Patient-facing range arrow** (PDF report, patient portal only) — replaces the Normal/Alto/Bajo text label used in Captura with a directional glyph: ↑ in `{colors.error-text}` for Alto, ↓ in `{colors.warn-text}` for Bajo, reusing the same two `-text` tokens already established for the two-tier Kanban aging/warning escalation rather than inventing new colors. Normal renders no icon and no color at all — the absence of any marker is the deliberate all-clear signal. Distinct from, and does not apply to, Captura's own Normal/Low/High text treatment, which is unchanged. Behavioral spec lives in `EXPERIENCE.md.Key Flows` (Flow 4).
- **Order print-preview panel** (`components.print-preview-panel`, FR-22) — white surface, `{rounded.lg}`, card shadow; a lightweight overlay rather than a heavy modal, consistent with this product's shallow elevation language (see Elevation & Depth — "never needs a modal-on-modal drama"). Lists container labels, payment ticket, and work-order template as three distinct groups before printing. Behavioral spec (label count derivation, confirm-to-print, cancel path) lives in `EXPERIENCE.md.Component Patterns`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use `{colors.accent}`, `{colors.ok}`, `{colors.warn}`, `{colors.error}` as fills, dots, and badge backgrounds | Set body or label text directly in `{colors.accent}` / `{colors.ok}` / `{colors.warn}` / `{colors.error}` on a light surface — each measures well under 4.5:1 against `{colors.bg}` or white (see Accessibility Floor) |
| Use the `-text` variants (`{colors.accent-text}`, `{colors.ok-text}`, `{colors.warn-text}`, `{colors.error-text}`) whenever a semantic color needs to carry copy | Invent new semantic-color-as-text combinations ad hoc — extend this fixed set instead |
| Keep navy (`{colors.navy}` / `{colors.navy-topbar}`) confined to sidebar + topbar | Use navy as a content-canvas background — it breaks the "light canvas = workspace" convention this product depends on for long-shift legibility |
| Pill radius (`{rounded.full}`) on every clickable control (buttons, inputs, chips, badges) | Round a container (card, panel, Kanban tray) to a pill, or leave a button/input square |
| One aging/critical treatment per card — background tint + ring + text-color swap together | Signal urgency with color alone (fails colorblind users) or stack multiple competing alert treatments on one card |
| Use `{colors.gray}` for secondary copy at any size — it clears WCAG AA 4.5:1 on `{colors.bg}` after the contrast fix below | Darken or substitute `{colors.gray}` ad hoc — the shipped token is already accessibility-verified |

**Accessibility contrast — resolved:** `{colors.gray}` was adjusted from `#64748B` to `#607089` on `{colors.bg}` (`#F0F6FF`), now measuring **≈4.63:1** — clearing the WCAG 2.1 AA 4.5:1 floor at any text size/weight, including the 11.5–13px regular-weight KPI labels and table subtitles where the old value fell short. `{colors.ok-text}` was adjusted from `#0D8A64` to `#0B7A57` on white, now measuring **≈5.34:1** at the same weight. `{colors.warn-text}` (`#B45309`) measures **≈5.02:1** on white (`components.kpi-card` attention delta) and **≈4.51:1** on `#FEF3C7` (the `en-analisis` status-pill fill) — both already cleared 4.5:1, though the pill pairing is a thin margin worth re-checking if either hex ever shifts. `{colors.error-text}` (`#B91C1C`) measures **≈6.47:1** on white and **≈5.91:1** on `#FEF2F2` (the aging-card/critical-alert fill) — already comfortably clearing the floor, no change needed. `{colors.accent-text}` originally measured **≈3.74:1** on white and **≈3.39:1** on `{colors.accent-lt}` (`#E0F8FF`, the "Validado" status-pill fill it's actually used against) — failing 4.5:1 on both; it was darkened from `#0891A6` to `#067484`, now measuring **≈5.48:1** / **≈4.96:1**, clearing the floor with a minimal visual delta (still reads as cyan/teal, not a different hue). All five tokens are a minimal visual delta from their originals with no identity change; no further design review is required for any of them.
