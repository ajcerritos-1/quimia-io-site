"use client";

/**
 * Compact topbar (Story 1.5 Task 4, AC 1/2). Visible on every breakpoint —
 * epics.md AC 1's "I see the dark-chrome sidebar (always visible) and
 * topbar" applies to desktop/tablet too, not just phone. On phone, this is
 * where the off-canvas drawer's trigger (☰) lives (`NavDrawer` renders it,
 * hidden via its own `md:hidden` on desktop/tablet since the sidebar is
 * already persistent there — no drawer to trigger).
 *
 * Scope boundary: no Caja status chip (Epic 5 doesn't exist yet — there's no
 * state to show), no branch switcher (`UX-DR25`, explicitly `[PHASE 2]`).
 */
import type { UserRole } from "@/shared/db";
import { NavDrawer } from "./nav-drawer";

export interface TopbarProps {
  role: UserRole;
}

export function Topbar({ role }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-3 bg-brand-navy-topbar px-4">
      <NavDrawer role={role} />
      <span className="text-sm font-semibold text-white">Quimia IO</span>
    </header>
  );
}
