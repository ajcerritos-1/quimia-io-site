"use client";

/**
 * Dark-chrome sidebar (Story 1.5 Task 3, AC 1/2). Renders `visibleNavItems()`
 * for the signed-in actor's role — hides a nav item entirely when the role
 * can't use it (epics.md AC 1's literal "showing only nav items my role
 * permits"), never wraps it in `DisabledHint` (that primitive is for an
 * action on a reachable screen, not top-level navigation — see this story's
 * own Dev Notes).
 *
 * Always visible on desktop/tablet; becomes the off-canvas drawer's content
 * on phone (`nav-drawer.tsx`) — same component, two different containers,
 * not two different nav-list implementations. The caller controls which
 * container it renders in via `className` (e.g. `(app)/layout.tsx` passes
 * `hidden md:flex` for the persistent placement).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/shared/db";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "./nav-items";

export interface SidebarProps {
  role: UserRole;
  className?: string;
}

export function Sidebar({ role, className }: SidebarProps) {
  const pathname = usePathname();
  const items = visibleNavItems(role);

  return (
    <nav
      aria-label="Navegación principal"
      className={cn("w-64 flex-col gap-1 bg-brand-navy p-4", className)}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // Same focus-visible treatment as `button.tsx` (Task 9, AC 2):
              // one consistent, always-visible focus ring app-wide, not a
              // second brand-accent-colored ring scoped only to the shell.
              "rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-white/80 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              isActive
                ? "bg-brand-accent-lt text-brand-navy"
                : "hover:bg-white/10 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
