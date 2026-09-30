"use client";

/**
 * Generic catalog table (Story 2.1, change 2/6 — Phase 4). Renders a `Card`
 * with an active-count header, a thead band + row hover, `StatusBadge`
 * ("Activo"/"Inactivo"), per-row "Editar" / "Desactivar" / "Reactivar" ghost
 * actions, and the spec's empty state "No hay {label} todavía". Columns are
 * driven by `CATALOGS[kind].fields` — the registry stays the single source
 * of truth (no per-kind branching). Pattern:
 * `src/modules/auth/ui/users-table.tsx` (read-only). Verify against the spec
 * "Empty And Status States" scenarios (catalog-administration).
 *
 * "Desactivar"/"Reactivar" call the submit wrappers directly in a transition
 * (they `revalidatePath` on success, refreshing the Server Component page's
 * data automatically); "Editar" opens the per-row `CatalogEditDialog`.
 */
import { useTransition } from "react";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CATALOGS, type CatalogSlug } from "../registry";
import { submitDeactivateCatalog } from "../server/submit-deactivate-catalog.action";
import { submitReactivateCatalog } from "../server/submit-reactivate-catalog.action";
import { CatalogEditDialog } from "./catalog-edit-dialog";
import type { CatalogRow } from "./catalog-form";

export function CatalogTable({
  kind,
  rows,
}: {
  kind: CatalogSlug;
  rows: CatalogRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const { label, fields } = CATALOGS[kind];
  const firstFieldName = Object.keys(fields)[0];
  const activeCount = rows.filter((row) => row.isActive).length;

  function handleDeactivate(id: string) {
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("id", id);
    startTransition(() => {
      void submitDeactivateCatalog(formData);
    });
  }

  function handleReactivate(id: string) {
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("id", id);
    startTransition(() => {
      void submitReactivateCatalog(formData);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>
          {rows.length} {rows.length === 1 ? "elemento" : "elementos"}{" "}
          registrados · {activeCount}{" "}
          {activeCount === 1 ? "activo" : "activos"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center">
            <Boxes aria-hidden="true" className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No hay {label} todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea el primer elemento con el botón &quot;Crear {label}&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {Object.entries(fields).map(([fieldName, fieldDef]) => (
                    <th
                      key={fieldName}
                      className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {fieldDef.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    {Object.keys(fields).map((fieldName) => (
                      <td key={fieldName} className="px-6 py-3.5 pr-4">
                        {fieldName === firstFieldName ? (
                          <div className="font-medium">{row.values[fieldName]}</div>
                        ) : (
                          <div className="text-muted-foreground">
                            {row.values[fieldName]}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-3.5 pr-4">
                      <StatusBadge
                        variant={row.isActive ? "success" : "neutral"}
                      >
                        {row.isActive ? "Activo" : "Inactivo"}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <CatalogEditDialog kind={kind} row={row} />
                      {row.isActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeactivate(row.id)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleReactivate(row.id)}
                        >
                          Reactivar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}