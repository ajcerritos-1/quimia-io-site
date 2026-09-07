/**
 * Card container primitive (Epic 2 catalog pattern seed, 2026-09-06).
 * Minimal shadcn-flavored Card built on the repo's tokens
 * (`bg-card`/`border-border`, radius from `--radius`). First consumer is
 * the `/usuarios` table; Epic 2 catalog screens reuse it to wrap tables
 * and detail sections.
 *
 * Note: `CardTitle` renders an `<h2>` — a card is a section landmark in
 * the Epic 2 catalog pattern, so its title is a real heading (a11y). The
 * page keeps its `h1` in `PageHeader`; e2e locators scope headings with
 * `level` (e.g. `{ name: /usuarios/i, level: 1 }`) so the card's h2 never
 * collides with the page title.
 */
import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-lg border border-border bg-card py-6 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 px-6", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }