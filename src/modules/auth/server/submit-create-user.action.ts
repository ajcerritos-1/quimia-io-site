"use server";

/**
 * Server Action wrapper for `create-user-form.tsx` (Story 1.2 Task 7).
 * Mirrors `submit-sign-in.action.ts`'s split: `createUser()` itself stays a
 * plain, directly-testable function (Task 8's RBAC-denial tests call it
 * without going through this wrapper, simulating a direct API call) — this
 * file's ONLY job is resolving the incoming request's headers/tenant/
 * request-id and translating a thrown `AppError` into a plain result.
 *
 * Kept in its OWN file (file-level `"use server"`, not an inline
 * per-function directive co-located in `create-user.action.ts`) — an inline
 * directive inside a module that ALSO exports plain functions importing
 * `transaction`/`writeAuditLog`/the Prisma client did not get tree-shaken
 * out of the CLIENT bundle by Turbopack (`next build` failed trying to
 * resolve Node built-ins like `tls`/`util/types` pulled in transitively via
 * `pg`). A dedicated `"use server"` file avoids that entirely.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { createUser, type CreateUserInput } from "./create-user.action";

export interface SubmitCreateUserResult {
  ok: boolean;
  message?: string;
  /** Field-level messages (e.g. `{ password: "..." }`) — code-review follow-up 2026-08-16. */
  fieldErrors?: Record<string, string>;
}

export async function submitCreateUser(
  formData: FormData,
): Promise<SubmitCreateUserResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  try {
    await createUser(
      {
        email: String(formData.get("email") ?? ""),
        nickname: String(formData.get("nickname") ?? ""),
        name: String(formData.get("name") ?? ""),
        password: String(formData.get("password") ?? ""),
        role: String(formData.get("role") ?? "") as CreateUserInput["role"],
      },
      { headers: requestHeaders, tenantId, requestId },
    );
  } catch (error) {
    if (error instanceof AppError) {
      const details = error.details as
        | { fieldErrors?: Record<string, string[] | undefined> }
        | undefined;
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
        if (messages?.[0]) fieldErrors[field] = messages[0];
      }
      return {
        ok: false,
        message: error.message,
        ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
      };
    }
    throw error;
  }

  revalidatePath("/usuarios");
  return { ok: true };
}
