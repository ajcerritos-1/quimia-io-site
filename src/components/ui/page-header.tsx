/**
 * PageHeader primitive (Epic 2 catalog pattern seed, 2026-09-06). Standard
 * admin-screen header: `h1` title + optional description on the left,
 * optional action cluster (primary buttons, dialogs) on the right.
 * Server-safe (no hooks) — pages pass client components (e.g.
 * `CreateUserDialog`) through `actions` as children. Every Epic 2 catalog
 * screen starts with this.
 *
 * `title` is typed `string` (NOT `ReactNode`), deliberately: it renders
 * inside an `<h1>`, and a public primitive must not accept arbitrary
 * nodes there (invalid-nesting risk). Description/actions stay `ReactNode`.
 */
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

export { PageHeader }