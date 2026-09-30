"use server";

/**
 * Server Action wrapper for `CatalogForm`'s edit mode (Story 2.1, change
 * 2/6 — Phase 3). Mirror of `submit-create-catalog.action.ts`: same
 * headers/tenant/request-id resolution, `FormData` → `UpdateCatalogInput`
 * mapping (`id` comes from the form's hidden input; `calibrationDate`
 * `""` → `null`), and `AppError` → `SubmitCatalogResult` translation. See
 * that file's header comment for why this lives in its own file with a
 * file-level `"use server"` rather than an inline directive co-located with
 * `update-catalog.action.ts`'s plain, directly-testable `updateCatalog()`.
 *
 * On success it revalidates BOTH the hub and the specific per-kind page
 * (design decision "revalidatePath — two explicit calls").
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { catalogHref } from "../registry";
import type { UpdateCatalogInput } from "../schemas";
import { updateCatalog } from "./update-catalog.action";
import type { SubmitCatalogResult } from "./submit-create-catalog.action";

export async function submitUpdateCatalog(
  formData: FormData,
): Promise<SubmitCatalogResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  const kind = String(formData.get("kind") ?? "") as UpdateCatalogInput["kind"];
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const input: UpdateCatalogInput =
    kind === "equipos"
      ? {
          kind,
          id,
          name,
          model: String(formData.get("model") ?? ""),
          serialNumber: String(formData.get("serialNumber") ?? ""),
          calibrationDate: calibrationDateOrNull(formData.get("calibrationDate")),
        }
      : ({ kind, id, name } as UpdateCatalogInput);

  try {
    await updateCatalog(input, {
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
  revalidatePath(catalogHref(kind));
  return { ok: true };
}

/** `""`/missing → `null` (uncalibrated equipment, FR-9); otherwise the raw
 *  `"yyyy-MM-dd"` string, which the shared schema coerces to a `Date`. */
function calibrationDateOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}