"use server";

/**
 * Server Action wrapper for `CatalogTable`'s "Desactivar" row button (Story
 * 2.1, change 2/6 — Phase 3). Mirror of `submit-deactivate-user.action.ts`:
 * resolves the request's headers/tenant/request-id, maps the hidden
 * `{ kind, id }` inputs → `CatalogIdInput`, and translates a thrown
 * `AppError` into a plain `SubmitCatalogResult`. `deactivateCatalog()` itself
 * stays a plain, directly-testable function (Phase 2's integration tests call
 * it directly). See `submit-create-catalog.action.ts`'s header comment for
 * why this lives in its own `"use server"` file.
 *
 * On success it revalidates BOTH the hub and the specific per-kind page
 * (design decision "revalidatePath — two explicit calls").
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { catalogHref } from "../registry";
import { deactivateCatalog, type CatalogIdInput } from "./deactivate-catalog.action";
import type { SubmitCatalogResult } from "./submit-create-catalog.action";

export async function submitDeactivateCatalog(
  formData: FormData,
): Promise<SubmitCatalogResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  const input: CatalogIdInput = {
    kind: String(formData.get("kind") ?? "") as CatalogIdInput["kind"],
    id: String(formData.get("id") ?? ""),
  };

  try {
    await deactivateCatalog(input, {
      headers: requestHeaders,
      tenantId,
      requestId,
    });
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

  revalidatePath("/configuracion");
  revalidatePath(catalogHref(input.kind));
  return { ok: true };
}