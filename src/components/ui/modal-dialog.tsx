/**
 * ModalDialog primitive (Epic 2 catalog pattern seed, 2026-09-06). The
 * project's reusable modal shell, built directly on `@base-ui/react/dialog`
 * — the same headless base `nav-drawer.tsx`, `button.tsx` and
 * `separator.tsx` already wrap; no new dialog dependency.
 *
 * CONTROLLED by design: the owner passes `open`/`onOpenChange` (so a form
 * inside can auto-close on success) and renders its own trigger elsewhere
 * (usually a `Button` in a `PageHeader` actions slot). `Dialog.Root`'s
 * defaults provide focus trapping, Escape/backdrop dismissal, scroll
 * locking, and focus restoration to the trigger on close for free
 * (`Dialog.Portal` keeps `keepMounted={false}`, same as the nav drawer —
 * the popup is unmounted while closed).
 *
 * Slots: `title` (required — the dialog's accessible name, wired via
 * `Dialog.Title`), optional `description`, `children` (dialog body), and
 * an optional `footer` for action rows. FORMS: put the whole `<form>`
 * (fields + submit + cancel buttons) in `children` — a submit button must
 * live inside its form; the `footer` slot is for non-form dialogs
 * (confirmations, details, ...).
 *
 * Focus management: by default Base UI focuses the FIRST TABBABLE element
 * inside the popup on open — for this primitive, that's the X close
 * button. Form dialogs should pass `initialFocus` pointing at the first
 * input's ref (created by the dialog owner and threaded into both
 * `ModalDialog` and the form) so keyboard users land on the first field.
 * `finalFocus` defaults to returning focus to the trigger on close.
 * Both props mirror Base UI's `Dialog.Popup` prop types exactly.
 */
import type { ReactNode } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ModalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required — becomes the dialog's accessible name. */
  title: string
  description?: string
  /** Element to focus when the dialog opens. Default: first tabbable
   * element (the X close button). Form dialogs pass a ref to the first
   * input so keyboard users land on the first field. Same type as Base
   * UI's `Dialog.Popup` `initialFocus`. */
  initialFocus?: Dialog.Popup.Props["initialFocus"]
  /** Element to focus when the dialog closes. Default: the trigger /
   * previously focused element. Same type as Base UI's `Dialog.Popup`
   * `finalFocus`. */
  finalFocus?: Dialog.Popup.Props["finalFocus"]
  children: ReactNode
  footer?: ReactNode
  className?: string
}

function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  finalFocus,
  children,
  footer,
  className,
}: ModalDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg outline-none",
            className
          )}
        >
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </header>
          {children ? <div className="flex-1">{children}</div> : null}
          {footer ? (
            <footer className="flex items-center justify-end gap-2">
              {footer}
            </footer>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { ModalDialog }