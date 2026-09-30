"use client";

/**
 * Per-row "Editar" modal for the catalog table (Story 2.1, change 2/6 —
 * Phase 4). Row-level ghost trigger button + the shared `ModalDialog` shell
 * + `CatalogForm` in edit mode, pre-filled from the row's `initialValues`
 * (uncontrolled `defaultValue` + hidden `id`, submits via
 * `submitUpdateCatalog`). Auto-closes on success — the revalidated table
 * shows the updated values.
 *
 * Each row owns its own `CatalogEditDialog` instance (same per-row-state
 * shape as `users-table.tsx`'s per-row controls); the popup unmounts while
 * closed (`ModalDialog` keeps `keepMounted={false}`), so the form remounts
 * fresh with the current row's values on every open.
 */
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { CatalogSlug } from "../registry";
import { CatalogForm, type CatalogRow } from "./catalog-form";

export function CatalogEditDialog({
  kind,
  row,
}: {
  kind: CatalogSlug;
  row: CatalogRow;
}) {
  const [open, setOpen] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback((next: boolean) => setOpen(next), []);
  const handleSuccess = useCallback(() => setOpen(false), []);
  const handleCancel = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Editar
      </Button>
      <ModalDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Editar elemento"
        description="Actualiza los datos del elemento y guarda los cambios."
        initialFocus={firstFieldRef}
      >
        <CatalogForm
          kind={kind}
          initialValues={row}
          firstFieldRef={firstFieldRef}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ModalDialog>
    </>
  );
}