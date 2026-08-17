"use server";

/**
 * Server Action wrapper for `users-table.tsx` (Story 1.2 Task 7). See
 * `submit-create-user.action.ts`'s header comment for why this lives in its
 * own file with a file-level `"use server"` rather than an inline directive
 * co-located with `deactivate-user.action.ts`'s plain, directly-testable
 * `deactivateUser()`.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { deactivateUser } from "./deactivate-user.action";

export interface SubmitDeactivateUserResult {
  ok: boolean;
  message?: string;
}

export async function submitDeactivateUser(
  formData: FormData,
): Promise<SubmitDeactivateUserResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  try {
    await deactivateUser(
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
