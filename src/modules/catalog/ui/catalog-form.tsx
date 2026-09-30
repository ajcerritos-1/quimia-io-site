"use client";

/**
 * Generic create/edit form for the five supporting catalogs (Story 2.1,
 * change 2/6 — Phase 4). Driven entirely by `CATALOGS[kind].fields`: one
 * `Field` + `Input` per registry field, with NO per-kind branching beyond
 * what the registry drives (`type: "date"` renders `<Input type="date">` for
 * equipment's `calibrationDate`).
 *
 * `initialValues` present → edit mode (uncontrolled `defaultValue` pre-fill,
 * hidden `id` input, submits via `submitUpdateCatalog`); absent → create mode
 * (submits via `submitCreateCatalog`). Client-side `catalogCreateSchema` /
 * `catalogUpdateSchema` `safeParse` blocks submit and shows `fieldErrors`;
 * `useActionState` handles the server result; `useEffect(state.ok)` fires
 * `onSuccess` (the hosting dialog auto-closes). Pattern:
 * `src/modules/auth/ui/create-user-form.tsx` (read-only).
 *
 * `CatalogRow` is the client-side structural twin of the server's
 * `SerializedCatalogRow` (`catalog-queries.ts` is `server-only` — importing
 * it here would leak Prisma/`pg` into the client bundle, AD-3).
 * TypeScript's structural typing makes server rows assignable to it.
 */
import { useEffect, useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CATALOGS, type CatalogSlug } from "../registry";
import { catalogCreateSchema, catalogUpdateSchema } from "../schemas";
import { submitCreateCatalog } from "../server/submit-create-catalog.action";
import { submitUpdateCatalog } from "../server/submit-update-catalog.action";

export interface CatalogRow {
  id: string;
  isActive: boolean;
  /** Keyed by the registry field names; equipment's calibrationDate is
   *  "yyyy-MM-dd" | null (server → client safe shape). */
  values: Record<string, string | null>;
}

interface CatalogFormState {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
}

const initialState: CatalogFormState = {
  ok: false,
  message: "",
  fieldErrors: {},
};

export interface CatalogFormProps {
  kind: CatalogSlug;
  /** Present → edit mode (pre-fill + submitUpdateCatalog); absent → create. */
  initialValues?: CatalogRow;
  /** Ref to the first field's input. The hosting dialog passes the same ref
   *  it gives `ModalDialog`'s `initialFocus`, so keyboard users land on the
   *  first field when the dialog opens (Epic 2 form-dialog pattern). */
  firstFieldRef?: React.RefObject<HTMLInputElement | null>;
  /** Called when the submission succeeds — the hosting dialog uses this to
   *  auto-close (the revalidated table showing the change is the success
   *  feedback). */
  onSuccess?: () => void;
  /** When provided, renders a "Cancelar" button beside the submit that
   *  invokes it (the hosting dialog closes itself). */
  onCancel?: () => void;
}

export function CatalogForm({
  kind,
  initialValues,
  firstFieldRef,
  onSuccess,
  onCancel,
}: CatalogFormProps) {
  const isEdit = initialValues !== undefined;
  const { label, fields } = CATALOGS[kind];
  const schema = isEdit ? catalogUpdateSchema : catalogCreateSchema;
  const firstFieldName = Object.keys(fields)[0];

  async function catalogFormAction(
    _previous: CatalogFormState,
    formData: FormData,
  ): Promise<CatalogFormState> {
    const raw = {
      kind: formData.get("kind") ?? kind,
      ...(isEdit ? { id: formData.get("id") ?? "" } : {}),
      name: formData.get("name") ?? "",
      ...(kind === "equipos"
        ? {
            model: formData.get("model") ?? "",
            serialNumber: formData.get("serialNumber") ?? "",
            calibrationDate: formData.get("calibrationDate") ?? "",
          }
        : {}),
    };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: CatalogFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in fields) {
          fieldErrors[field] ??= issue.message;
        }
      }
      return { ok: false, message: "", fieldErrors };
    }

    const result = isEdit
      ? await submitUpdateCatalog(formData)
      : await submitCreateCatalog(formData);
    if (result.ok) {
      return {
        ok: true,
        message: isEdit
          ? "Cambios guardados correctamente."
          : "Elemento creado correctamente.",
        fieldErrors: {},
      };
    }

    const fieldErrors: CatalogFormState["fieldErrors"] = {};
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      if (field in fields) fieldErrors[field] = message;
    }

    return {
      ok: false,
      message:
        Object.keys(fieldErrors).length > 0
          ? ""
          : (result.message ?? "No se pudo guardar el elemento."),
      fieldErrors,
    };
  }

  const [state, formAction, isPending] = useActionState(
    catalogFormAction,
    initialState,
  );

  // Auto-close the hosting dialog on success. Validation failures keep the
  // dialog open with field errors; the dialog remounts the form fresh
  // (initialState, ok: false) on every open, so this fires at most once
  // per successful submission.
  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="kind" value={kind} />
      {isEdit && initialValues ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
      <FieldGroup>
        {Object.entries(fields).map(([fieldName, fieldDef]) => (
          <Field key={fieldName} data-invalid={Boolean(state.fieldErrors[fieldName])}>
            <FieldLabel htmlFor={fieldName}>{fieldDef.label}</FieldLabel>
            <FieldContent>
              <Input
                id={fieldName}
                name={fieldName}
                type={fieldDef.type}
                defaultValue={initialValues?.values[fieldName] ?? ""}
                ref={fieldName === firstFieldName ? firstFieldRef : undefined}
                aria-invalid={Boolean(state.fieldErrors[fieldName])}
              />
              <FieldError>{state.fieldErrors[fieldName]}</FieldError>
            </FieldContent>
          </Field>
        ))}

        {state.message ? (
          <p
            data-testid="catalog-form-message"
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEdit
                ? "Guardando..."
                : "Creando..."
              : isEdit
                ? "Guardar cambios"
                : `Crear ${label}`}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}