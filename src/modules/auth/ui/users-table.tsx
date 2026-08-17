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
 */
import { useTransition } from "react";
import type { UserRole } from "@/shared/db";
import { DisabledHint } from "@/components/ui/disabled-hint";
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
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Nombre</th>
          <th className="py-2 pr-4 font-medium">Nickname / Email</th>
          <th className="py-2 pr-4 font-medium">Rol</th>
          <th className="py-2 pr-4 font-medium">Estado</th>
          <th className="py-2 pr-4 font-medium">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const isOwnRow = user.id === viewerUserId;
          return (
            <tr key={user.id} className="border-b border-border">
              <td className="py-2 pr-4">{user.name}</td>
              <td className="py-2 pr-4">
                {user.nickname} / {user.email}
              </td>
              <td className="py-2 pr-4">
                <DisabledHint
                  disabled={isOwnRow}
                  reason="No puedes cambiar tu propio rol."
                >
                  <select
                    aria-label={`Rol de ${user.nickname}`}
                    defaultValue={user.role}
                    disabled={isPending || !user.isActive}
                    onChange={(event) =>
                      handleRoleChange(user.id, event.target.value)
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </DisabledHint>
              </td>
              <td className="py-2 pr-4">{user.isActive ? "Activo" : "Inactivo"}</td>
              <td className="py-2 pr-4">
                {user.isActive ? (
                  <DisabledHint
                    disabled={isOwnRow}
                    reason="No puedes desactivar tu propia cuenta."
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeactivate(user.id)}
                      className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </DisabledHint>
                ) : (
                  // No self-action guard needed here: a deactivated actor is
                  // rejected by `getCurrentActor()`'s `isActive` re-check
                  // before ever reaching this page (Story 1.2 Task 9 dev
                  // note), so the viewer's own row can never render this
                  // Reactivar button in practice — left untouched (Story
                  // 1.3 Task 5's own documented judgment call).
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleReactivate(user.id)}
                    className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    Reactivar
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
