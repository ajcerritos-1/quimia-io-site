"use client";

/**
 * Sign-in form (Phase 6.6, design.md "File Changes"). Client-side Zod
 * validation for empty/malformed input (ordinary form UX, not an AC-4
 * concern); on submit, calls `submitSignIn` (the Server Action wrapping
 * `signIn()` from `sign-in.action.ts`, PR 4a). Any AUTH failure — wrong
 * password, inactive user, inactive/unknown tenant, unknown identifier —
 * renders the exact same single generic message, with no field-specific
 * hint (AC-4). Built on this repo's Base UI-flavored shadcn primitives
 * (`Field`/`Input`/`Label`/`Button` under `src/components/ui`) — this
 * style ships no `react-hook-form`-based `form` block (confirmed via the
 * shadcn CLI registry for the `base-nova` style), so validation is plain
 * Zod + React 19's `useActionState`, not `react-hook-form`.
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
import { submitSignIn } from "../server/submit-sign-in.action";

const signInSchema = z.object({
  identifier: z.string().min(1, "Enter your email or nickname."),
  password: z.string().min(1, "Enter your password."),
});

interface SignInFormState {
  ok: boolean;
  message: string;
  fieldErrors: { identifier?: string; password?: string };
}

const initialState: SignInFormState = {
  ok: false,
  message: "",
  fieldErrors: {},
};

async function signInFormAction(
  _previous: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const parsed = signInSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: SignInFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "identifier" || field === "password") {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { ok: false, message: "", fieldErrors };
  }

  const result = await submitSignIn(parsed.data);
  if (result.ok) {
    return { ok: true, message: "", fieldErrors: {} };
  }
  return { ok: false, message: result.message, fieldErrors: {} };
}

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(
    signInFormAction,
    initialState,
  );

  if (state.ok) {
    return (
      <p data-testid="sign-in-success" role="status">
        Signed in successfully.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors.identifier)}>
          <FieldLabel htmlFor="identifier">Email or nickname</FieldLabel>
          <FieldContent>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              aria-invalid={Boolean(state.fieldErrors.identifier)}
            />
            <FieldError>{state.fieldErrors.identifier}</FieldError>
          </FieldContent>
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(state.fieldErrors.password)}
            />
            <FieldError>{state.fieldErrors.password}</FieldError>
          </FieldContent>
        </Field>

        {/*
          AC-4: exactly ONE generic message, never tied to a specific
          field — deliberately not rendered via <FieldError>, which is
          scoped per-field.
        */}
        {state.message ? (
          <p data-testid="sign-in-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
