"use client";

/**
 * Create-user form for `/usuarios` (Story 1.2 Task 7). Same component
 * conventions as `sign-in-form.tsx` (shadcn/Base UI primitives under
 * `src/components/ui`, plain Zod + `useActionState`). Spanish UI copy
 * (UX-DR22, NFR-9).
 *
 * The role field derives from the generated Prisma `UserRole` enum
 * (code-review follow-up 2026-08-16) and reuses `users-table.tsx`'s
 * `ROLE_LABELS` mapping rather than a second hand-typed option list.
 * `UserRole` is imported as a TYPE ONLY (Story 1.3 fix, same reason as
 * `users-table.tsx`'s own Debug Log entry: a runtime import here pulls
 * `src/shared/db`'s Prisma/`pg` module graph into the browser bundle and
 * fails `next build`) — `z.enum` derives from `roles.ts`'s canonical,
 * client-safe `ALL_ROLES` tuple (Review Findings patch 2026-08-17, not from
 * `Object.keys(ROLE_LABELS)`, so the UI-labels object is never the
 * accidental source of truth for which roles are valid), with zero runtime
 * `UserRole` import.
 * The password field enforces the SAME shared `passwordPolicySchema`
 * (`password-policy.ts`, Story 1.4 Task 1/2) Better Auth and
 * `create-user.action.ts`'s server-side Zod schema use (AD-8, no divergent
 * client-side check) — a server-side rejection of a policy-violating
 * password now maps back to this field's own error display via
 * `submitCreateUser`'s `fieldErrors`, not just a generic top-level banner.
 *
 * (2026-09-06 UI polish, Epic 2 pattern seed) The form now renders inside
 * a modal dialog (`CreateUserDialog` hosts it; the page no longer embeds
 * it inline). All validation/state behavior is preserved; two NEW OPTIONAL
 * props wire the dialog lifecycle without touching the action contract:
 * `onSuccess` auto-closes the dialog after a successful creation (the
 * page refreshes via the action's `revalidatePath`, so the visible
 * success feedback is the new row in the table), and `onCancel` renders
 * a Cancelar button beside the submit. The raw `<select>` role field
 * moved to the shared `Select` primitive (`src/components/ui/select.tsx`)
 * — still a native `<select>`, so e2e `selectOption` keeps working.
 */
import { useEffect, useActionState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/shared/db";
import { ALL_ROLES } from "@/modules/auth/roles";
import { passwordPolicySchema } from "../server/password-policy";
import { submitCreateUser } from "../server/submit-create-user.action";
import { ROLE_LABELS } from "./users-table";

const DEFAULT_ROLE: UserRole = "quimico";

const createUserFormSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre."),
  nickname: z.string().min(1, "Ingresa un nickname."),
  email: z.email("Ingresa un email válido."),
  password: passwordPolicySchema,
  role: z.enum(ALL_ROLES),
});

interface CreateUserFormState {
  ok: boolean;
  message: string;
  fieldErrors: {
    name?: string;
    nickname?: string;
    email?: string;
    password?: string;
    role?: string;
  };
}

const initialState: CreateUserFormState = {
  ok: false,
  message: "",
  fieldErrors: {},
};

async function createUserFormAction(
  _previous: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  const parsed = createUserFormSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const fieldErrors: CreateUserFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        field === "name" ||
        field === "nickname" ||
        field === "email" ||
        field === "password" ||
        field === "role"
      ) {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { ok: false, message: "", fieldErrors };
  }

  const result = await submitCreateUser(formData);
  if (result.ok) {
    return { ok: true, message: "Usuario creado correctamente.", fieldErrors: {} };
  }

  const fieldErrors: CreateUserFormState["fieldErrors"] = {};
  for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
    if (
      field === "name" ||
      field === "nickname" ||
      field === "email" ||
      field === "password" ||
      field === "role"
    ) {
      fieldErrors[field] = message;
    }
  }

  return {
    ok: false,
    message:
      Object.keys(fieldErrors).length > 0
        ? ""
        : (result.message ?? "No se pudo crear el usuario."),
    fieldErrors,
  };
}

export interface CreateUserFormProps {
  /** Ref to the first field's input (Nombre). The hosting dialog passes the
   * same ref it gives `ModalDialog`'s `initialFocus`, so keyboard users
   * land on the first field when the dialog opens (Epic 2 form-dialog
   * pattern). */
  firstFieldRef?: React.RefObject<HTMLInputElement | null>;
  /** Called when the creation succeeds — the hosting dialog uses this to
   * auto-close (the revalidated page showing the new row is the success
   * feedback). */
  onSuccess?: () => void;
  /** When provided, renders a "Cancelar" button beside the submit that
   * invokes it (the hosting dialog closes itself). */
  onCancel?: () => void;
}

export function CreateUserForm({
  firstFieldRef,
  onSuccess,
  onCancel,
}: CreateUserFormProps) {
  const [state, formAction, isPending] = useActionState(
    createUserFormAction,
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
      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <FieldContent>
            <Input
              id="name"
              name="name"
              type="text"
              ref={firstFieldRef}
              aria-invalid={Boolean(state.fieldErrors.name)}
            />
            <FieldError>{state.fieldErrors.name}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors.nickname)}>
          <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
          <FieldContent>
            <Input
              id="nickname"
              name="nickname"
              type="text"
              aria-invalid={Boolean(state.fieldErrors.nickname)}
            />
            <FieldError>{state.fieldErrors.nickname}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              name="email"
              type="email"
              aria-invalid={Boolean(state.fieldErrors.email)}
            />
            <FieldError>{state.fieldErrors.email}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors.password)}>
          <FieldLabel htmlFor="password">Contraseña inicial</FieldLabel>
          <FieldContent>
            <Input
              id="password"
              name="password"
              type="password"
              aria-invalid={Boolean(state.fieldErrors.password)}
            />
            <FieldError>{state.fieldErrors.password}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors.role)}>
          <FieldLabel htmlFor="role">Rol</FieldLabel>
          <FieldContent>
            <Select
              id="role"
              name="role"
              defaultValue={DEFAULT_ROLE}
              aria-invalid={Boolean(state.fieldErrors.role)}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <FieldError>{state.fieldErrors.role}</FieldError>
          </FieldContent>
        </Field>

        {state.message ? (
          <p
            data-testid="create-user-message"
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
            {isPending ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
