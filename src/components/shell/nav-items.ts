/**
 * The app shell's nav-item registry (Story 1.5 Task 2, AC 1/3). Lives under
 * `src/components/shell/`, NOT `src/modules/` — the shell owns no Prisma
 * models and no domain data; it is cross-cutting UI infrastructure exactly
 * like `src/components/ui/disabled-hint.tsx` is, not a vertical-slice module
 * under AD-1's definition.
 *
 * `import type { UserRole }` only — zero runtime imports from `@/shared/db`,
 * same reasoning `src/modules/auth/roles.ts`'s own header comment documents:
 * this file must stay safe to import from a `"use client"` sidebar component
 * without pulling in the Prisma/`pg` module graph.
 *
 * `visibleNavItems()` is the first cross-module consumer of `isRoleAllowed()`
 * from outside `src/modules/auth/` (AC 3) — it filters via that shared
 * function, never a hand-rolled `.includes()`/role comparison here.
 *
 * Scope boundary: exactly ONE real entry today (`EXPERIENCE.md`'s Navigation
 * Map, "Usuarios y Roles | Sidebar (Admin only)"). Every other IA row points
 * at a screen that doesn't exist yet — do not scaffold placeholder entries
 * for Epics 2-11 here. Each future epic adds its own entry to THIS SAME
 * registry when its first real route ships.
 */
import type { UserRole } from "../../shared/db";
import { isRoleAllowed } from "../../modules/auth/roles";

export interface NavItem {
  label: string;
  href: string;
  allowedRoles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Usuarios y Roles", href: "/usuarios", allowedRoles: ["admin"] },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => isRoleAllowed(role, item.allowedRoles));
}
