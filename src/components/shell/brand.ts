/**
 * Shared brand constant for the app shell (Story 1.5 review remediation).
 * Single source of truth for the product name so a rebrand never needs a
 * coordinated multi-file edit. Lives here (shell cross-cutting UI infra),
 * not in a `src/modules/*` slice (AD-1) — the shell owns no domain data.
 */
export const APP_NAME = "Quimia IO";
