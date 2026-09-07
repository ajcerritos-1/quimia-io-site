/**
 * StatusBadge pill primitive (Epic 2 catalog pattern seed, 2026-09-06).
 * Small colored status pill for table cells ("Activo"/"Inactivo" today).
 * The base stays on the neutral shadcn palette; `success` uses a subtle
 * emerald tint as a SEMANTIC color (standard in professional admin UIs),
 * kept quiet with ring-based outlines. Epic 2 catalog tables reuse this
 * for any enum-ish state (enabled/disabled, pending/processed, ...).
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral:
          "bg-muted text-muted-foreground ring-border dark:bg-muted/50",
        success:
          "bg-emerald-500/10 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/30",
        destructive:
          "bg-destructive/10 text-destructive ring-destructive/25 dark:bg-destructive/20 dark:ring-destructive/40",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function StatusBadge({
  className,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { StatusBadge, statusBadgeVariants }