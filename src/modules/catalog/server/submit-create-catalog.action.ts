"use server";

/**
 * Server Action wrapper for `CatalogForm`'s create mode (Story 2.1, change
 * 2/6 — Phase 3). Mirrors `submit-create-user.action.ts`'s split:
 * `createCatalog()` itself stays a plain, directly-testable function (Phase
 * 2's integration tests call it without going through this wrapper) — this
 * file's ONLY job is resolving the incoming request's headers/tenant/
 * request-id, mapping `FormData` → `CreateCatalogInput`, and translating a
 * thrown `AppError` into a plain `SubmitCatalogResult`.
 *
 * Kept in its OWN file (file-level `"use server"`, not an inline directive
 * co-located in `create-catalog.action.ts`) — an inline directive inside a
 * module that ALSO exports plain functions importing `transaction`/
 * `writeAuditLog`/the Prisma client did not get tree-shaken out of the
 * CLIENT bundle by Turbopack (`next build` failed trying to resolve Node
 * built-ins like `tls`/`util/types` pulled in transitively via `pg`). A
 * dedicated `"use server"` file avoids that entirely.
 *
 * On success it revalidates BOTH the hub and the specific per-kind page
 * (design decision "revalidatePath — two explicit calls"): a literal
 * `revalidatePath("/configuracion")` invalidates only the hub; the per-kind
 * `/configuracion/{slug}` page is a sibling route and needs its own call.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNRESOLVED_TENANT } from "../../../middleware";
import { AppError } from "../../../shared/http/errors";
import { catalogHref } from "../registry";
import type { CreateCatalogInput } from "../schemas";
import { createCatalog } from "./create-catalog.action";

export interface SubmitCatalogResult {
  ok: boolean;
  message?: string;
  /** Field-level messages (e.g. `{ name: "..." }`) — mirrors submit-create-user.action.ts. */
  fieldErrors?: Record<string, string>;
}

export async function submitCreateCatalog(
  formData: FormData,
): Promise<SubmitCatalogResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) {
    return { ok: false, message: "No se pudo resolver el tenant." };
  }
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();

  const kind = String(formData.get("kind") ?? "") as CreateCatalogInput["kind"];
  const name = String(formData.get("name") ?? "");
  const input: CreateCatalogInput =
    kind === "equipos"
      ? {
          kind,
          name,
          model: String(formData.get("model") ?? ""),
          serialNumber: String(formData.get("serialNumber") ?? ""),
          calibrationDate: calibrationDateOrNull(formData.get("calibrationDate")),
        }
      : ({ kind, name } as CreateCatalogInput);

  try {
    await createCatalog(input, {
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