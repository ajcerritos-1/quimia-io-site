"use client";

/**
 * "Crear usuario" modal for `/usuarios` (2026-09-06 UI polish, Epic 2
 * pattern seed). Self-contained dialog: renders the header trigger button
 * + the shared `ModalDialog` shell + the existing `CreateUserForm`.
 *
 * Dialog lifecycle decisions (the reusable contract for Epic 2 catalog
 * create/edit forms):
 * - The trigger (a `Button` in the page's `PageHeader` actions slot) and
 *   the modal's submit button share the SAME label, "Crear usuario" — the
 *   standard admin pattern (the page-level primary action is the modal's
 *   confirm action). e2e scopes its queries to `getByRole("dialog")` once
 *   the modal is open.
 * - The dialog AUTO-CLOSES on success: the form's `state.ok` triggers
 *   `onSuccess`, and the server action's `revalidatePath` refreshes the
 *   table behind it — the visible feedback is the new row appearing.
 *   Validation failures keep the dialog open with field errors.
 * - "Cancelar" (outline) simply closes the dialog; both it and the close
 *   (X) control are disabled-agnostic — a submit already in flight still
 *   completes server-side, and the revalidated table reflects it.
 * - Focus on open: the same `firstFieldRef` is threaded into BOTH
 *   `ModalDialog`'s `initialFocus` (so keyboard users land on the first
 *   field, not the X close button — Base UI's default first-tabbable
 *   behavior) and `CreateUserForm`'s `firstFieldRef` prop (attached to
 *   the Nombre input). This is the Epic 2 form-dialog pattern.
 */
import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { CreateUserForm } from "./create-user-form";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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
        Crear usuario
      </Button>
      <ModalDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Crear usuario"
        description="Completa los datos del nuevo usuario. Podrá iniciar sesión con su nickname o email y la contraseña que definas."
        initialFocus={firstFieldRef}
      >
        <CreateUserForm
          firstFieldRef={firstFieldRef}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ModalDialog>
    </>
  );
}