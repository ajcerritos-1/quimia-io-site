/**
 * Native `<select>` primitive (Epic 2 catalog pattern seed, 2026-09-06).
 * Styled exactly like `input.tsx` so form selects and inline table
 * selects share one visual language (h-8, rounded-lg, border-input,
 * focus-visible ring, aria-invalid state).
 *
 * Deliberately a NATIVE select, not Base UI's `Select` popover — the
 * `/usuarios` e2e drives both role controls with Playwright's
 * `selectOption()`, which only works on a real `<select>`. Epic 2 catalog
 * forms needing a fancier dropdown can revisit Base UI Select later; the
 * visual surface is identical either way.
 */
import * as React from "react"

import { cn } from "@/lib/utils"

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Select }