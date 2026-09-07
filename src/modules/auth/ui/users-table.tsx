"use client";

/**
 * Users table for `/usuarios` (Story 1.2 Task 7/9). Per-row role edit,
 * deactivate, and reactivate — all call the Server Action wrappers directly
 * (Task 5/6/9's `submitUpdateUserRole`/`submitDeactivateUser`/
 * `submitReactivateUser`), which `revalidatePath` on success, refreshing
 * the Server Component page's data automatically. Spanish UI copy
 * (UX-DR22, NFR-9), same as every other Phase 1 screen.
 *
 * `UserRow["role"]` and `ROLE_LABELS` are keyed off the actual generated
 * Prisma `UserRole` enum (code-review follow-up 2026-08-16), not a
 * separately hand-typed string-literal tuple — a future 4th role only needs
 * to change in the schema. `ROLE_LABELS` itself stays a hand-typed mapping
 * (Spanish UI copy is legitimately UI-only) but `Record<UserRole, string>`
 * forces it to cover every enum value.
 *
 * `UserRole` is imported as a TYPE ONLY (Story 1.3 fix — see this story's
 * Debug Log): a runtime `import { UserRole } from "@/shared/db"` in this
 * "use client" component pulls the entire `src/shared/db` module graph
 * (including the Prisma/`pg` adapter) into the BROWSER bundle, which fails
 * `next build` (Node builtins `tls`/`util/types` unresolvable client-side).
 * `ROLE_LABELS`'s keys are therefore plain string literals, not computed
 * `[UserRole.admin]` property keys — `Record<UserRole, string>` still forces
 * exhaustiveness against the real enum type, with zero runtime import.
 *
 * Story 1.3 Task 5: `viewerUserId` identifies the signed-in admin's OWN row
 * so its role `<select>` and Desactivar control render visibly disabled
 * with a stated reason (AC 6) via the shared `DisabledHint` primitive
 * (Task 4) — an admin can never change their own role or deactivate their
 * own account (Story 1.2 AC 5/6), and this closes the gap where that rule
 * was enforced only server-side.
 *
 * (2026-09-06 UI polish, Epic 2 pattern seed) Table restyled for the
 * client demo on the shared catalog primitives: wrapped in a `Card` with a
 * count header, thead band + row hover, `StatusBadge` pills for
 * Activo/Inactivo, the shared `Select` primitive for the per-row role
 * control (STILL a native `<select>` — e2e drives it with `selectOption`),
 * `Button` ghost actions, and an empty state when the tenant has no users.
 * `UserRow`, `ROLE_LABELS`, the three action handlers, and the
 * `DisabledHint` self-row semantics are contract-unchanged.
 */
import { useTransition } from "react";
import { Users } from "lucide-react";
import type { UserRole } from "@/shared/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DisabledHint } from "@/components/ui/disabled-hint";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { submitDeactivateUser } from "../server/submit-deactivate-user.action";
import { submitReactivateUser } from "../server/submit-reactivate-user.action";
import { submitUpdateUserRole } from "../server/submit-update-user-role.action";

export interface UserRow {
  id: string;
  name: string;
  nickname: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  quimico: "Químico",
};

export function UsersTable({
  users,
  viewerUserId,
}: {
  users: UserRow[];
  viewerUserId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(userId: string, role: string) {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("role", role);
    startTransition(() => {
      void submitUpdateUserRole(formData);
    });
  }

  function handleDeactivate(userId: string) {
    const formData = new FormData();
    formData.set("userId", userId);
    startTransition(() => {
      void submitDeactivateUser(formData);
    });
  }

  function handleReactivate(userId: string) {
    const formData = new FormData();
    formData.set("userId", userId);
    startTransition(() => {
      void submitReactivateUser(formData);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios registrados</CardTitle>
        <CardDescription>
          {users.length}{" "}
          {users.length === 1 ? "usuario" : "usuarios"} con acceso al
          laboratorio.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center">
            <Users aria-hidden="true" className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No hay usuarios todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea el primer usuario con el botón &quot;Crear usuario&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Rol
                  </th>
                  <th className="px-6 py-3 pr-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isOwnRow = user.id === viewerUserId;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="px-6 py-3.5 pr-4">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.nickname}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 pr-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-3.5 pr-4">
                        <DisabledHint
                          disabled={isOwnRow}
                          reason="No puedes cambiar tu propio rol."
                        >
                          <Select
                            aria-label={`Rol de ${user.nickname}`}
                            defaultValue={user.role}
                            disabled={isPending || !user.isActive}
                            onChange={(event) =>
                              handleRoleChange(user.id, event.target.value)
                            }
                            className="w-auto min-w-32"
                          >
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </DisabledHint>
                      </td>
                      <td className="px-6 py-3.5 pr-4">
                        <StatusBadge
                          variant={user.isActive ? "success" : "neutral"}
                        >
                          {user.isActive ? "Activo" : "Inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {user.isActive ? (
                          <DisabledHint
                            disabled={isOwnRow}
                            reason="No puedes desactivar tu propia cuenta."
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleDeactivate(user.id)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Desactivar
                            </Button>
                          </DisabledHint>
                        ) : (
                          // This branch is structurally unreachable for the viewer's
                          // own row in practice: a deactivated actor is rejected by
                          // `getCurrentActor()`'s `isActive` re-check before ever
                          // reaching this page (Story 1.2 Task 9 dev note). Story
                          // 1.3 Task 5 originally left this button undecorated on
                          // that basis; Review Findings patch 2026-08-17 wraps it in
                          // `DisabledHint` anyway — free defense-in-depth now that
                          // the primitive exists, in case that invariant ever stops
                          // holding.
                          <DisabledHint
                            disabled={isOwnRow}
                            reason="No puedes reactivar tu propia cuenta."
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleReactivate(user.id)}
                            >
                              Reactivar
                            </Button>
                          </DisabledHint>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
