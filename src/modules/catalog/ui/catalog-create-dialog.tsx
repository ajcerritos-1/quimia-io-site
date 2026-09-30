"use client";

/**
 * "Crear {label}" modal for the per-kind catalog pages (Story 2.1, change
 * 2/6 — Phase 4). Self-contained dialog mirroring `create-user-dialog.tsx`:
 * header trigger `Button` + the shared `ModalDialog` shell + `CatalogForm`
 * in create mode (no `initialValues`). Auto-closes on success — the submit
 * wrapper's double `revalidatePath` refreshes the table behind it, so the
 * visible feedback is the new row appearing.
 *
 * The trigger and the form's submit share the same label, "Crear {label}"
 * (the standard admin pattern: the page-level primary action is the modal's
 * confirm action). e2e scopes its queries to `getByRole("dialog")` once the
 * modal is open.
 */
import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { CATALOGS, type CatalogSlug } from "../registry";
import { CatalogForm } from "./catalog-form";

export function CatalogCreateDialog({ kind }: { kind: CatalogSlug }) {
  const [open, setOpen] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const label = CATALOGS[kind].label;

  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);
  const handleSuccess = useCallback(() => setOpen(false), []);
  const handleCancel = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Plus aria-hidden="true" />
        Crear {label}
      </Button>
      <ModalDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={`Crear ${label}`}
        description="Completa los datos del nuevo elemento. Podrás desactivarlo o reactivarlo desde la tabla."
        initialFocus={firstFieldRef}
      >
        <CatalogForm
          kind={kind}
          firstFieldRef={firstFieldRef}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ModalDialog>
    </>
  );
}