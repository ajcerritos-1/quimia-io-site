"use client";

/**
 * Off-canvas drawer for phone (Story 1.5 Task 5, AC 2). Built directly on
 * `@base-ui/react/dialog` — already an installed dependency `button.tsx`/
 * other primitives already wrap — rather than adding a new dialog library.
 * This project's shadcn registry config (`components.json`) has no
 * configured external registries and no existing Sheet/Dialog primitive
 * under `src/components/ui/` today, so this hand-builds a minimal drawer on
 * the primitive directly, same pattern `separator.tsx`/`button.tsx` already
 * use (wrap a `@base-ui/react/*` part, don't reinvent it).
 *
 * `Dialog.Root`'s default `modal={true}` gives focus-trapping, an Escape-key
 * dismissal, and outside-press dismissal for free (Task 5's "focus-trapped,
 * closable via an explicit close control and the overlay/backdrop,
 * dismissible via Escape").
 *
 * Drawer content is `Sidebar` reused as-is (same `visibleNavItems()` call,
 * same nav list) — not a second, parallel nav-rendering implementation.
 */
import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import type { UserRole } from "@/shared/db";
import { Sidebar } from "./sidebar";

export interface NavDrawerProps {
  role: UserRole;
}

// Shared focus-visible treatment (Task 9, AC 2) — same pattern as
// `button.tsx`, reused verbatim for the drawer's trigger and close control.
const iconButtonClassName =
  "inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-white outline-none transition-colors hover:bg-white/10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function NavDrawer({ role }: NavDrawerProps) {
  return (
    <Dialog.Root>
      {/* Trigger only appears on phone (Task 4: "On desktop/tablet, the
       * trigger is hidden — sidebar is already persistent, no drawer to
       * trigger"). */}
      <Dialog.Trigger
        aria-label="Abrir menú de navegación"
        className={`${iconButtonClassName} md:hidden`}
      >
        <Menu aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup
          aria-label="Menú de navegación"
          className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-navy"
        >
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-semibold text-white">Quimia IO</span>
            <Dialog.Close
              aria-label="Cerrar menú de navegación"
              className={iconButtonClassName}
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Sidebar role={role} className="flex flex-1 bg-transparent p-4 pt-0" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
