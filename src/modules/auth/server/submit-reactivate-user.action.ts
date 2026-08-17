"use server";

/**
 * Server Action wrapper for `users-table.tsx` (Story 1.2 Task 9). See
 * `submit-create-user.action.ts`'s header comment for why this lives in its
 * own file with a file-level `"use server"` rather than an inline directive
 * co-located with `reactivate-user.action.ts`'s plain, directly-testable
 * `reactivateUser()`.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { reactivateUser } from "./reactivate-user.action";

export interface SubmitReactivateUserResult {
  ok: boolean;
  message?: string;
}

export async function submitReactivateUser(
  formData: FormData,
): Promise<SubmitReactivateUserResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  try {
    await reactivateUser(
      { userId: String(formData.get("userId") ?? "") },
      { headers: requestHeaders, tenantId, requestId },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/usuarios");
  return { ok: true };
}
