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
 * The password field enforces the SAME `MIN_PASSWORD_LENGTH` Better Auth
 * and `create-user.action.ts`'s server-side Zod schema use (AD-8, no
 * divergent client-side check) — a server-side rejection of a too-short
 * password now maps back to this field's own error display via
 * `submitCreateUser`'s `fieldErrors`, not just a generic top-level banner.
 */
import { useActionState } from "react";
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
import { UserRole } from "@/shared/db";
import { MIN_PASSWORD_LENGTH } from "../server/auth";
import { submitCreateUser } from "../server/submit-create-user.action";
import { ROLE_LABELS } from "./users-table";

const createUserFormSchema = z.object({
  name: z.string().min(1, "Ingresa un nombre."),
  nickname: z.string().min(1, "Ingresa un nickname."),
  email: z.email("Ingresa un email válido."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    ),
  role: z.enum(UserRole),
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

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserFormAction,
    initialState,
  );

  return (
    <form action={formAction} noValidate className="max-w-md">
      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <FieldContent>
            <Input
              id="name"
              name="name"
              type="text"
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
            <select
              id="role"
              name="role"
              defaultValue={UserRole.quimico}
              aria-invalid={Boolean(state.fieldErrors.role)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando..." : "Crear usuario"}
        </Button>
      </FieldGroup>
    </form>
  );
}
