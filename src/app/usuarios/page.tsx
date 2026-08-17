/**
 * Usuarios admin route (Story 1.2 Task 7, AC 1/2/3). Directly-navigable —
 * no sidebar/topbar app shell here (Story 1.5's scope). Gated by
 * `requireAdmin()` at the page level: an unauthenticated visitor is
 * redirected to sign in; a non-admin gets a 404 (do not reveal the route
 * exists to a caller who isn't allowed to use it).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { scoped } from "@/shared/db";
import { AppError } from "@/shared/http/errors";
import { requireAdmin } from "@/modules/auth/server/require-admin";
import { CreateUserForm } from "@/modules/auth/ui/create-user-form";
import { UsersTable, type UserRow } from "@/modules/auth/ui/users-table";

interface LoadUsersResult {
  users: UserRow[];
  /** Story 1.3 Task 5 (AC 6): the signed-in admin's own id, threaded down so
   * `UsersTable` can render their own row's self-action controls disabled. */
  viewerUserId: string;
}

async function loadUsers(): Promise<LoadUsersResult> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await requireAdmin(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) => {
        const users = await scoped({
          tenantId: actor.tenantId,
          role: actor.role,
        }).user.findMany({
          select: {
            id: true,
            name: true,
            nickname: true,
            email: true,
            role: true,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        });
        return { users, viewerUserId: actor.userId };
      },
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    if (error instanceof AppError && error.status === 403) notFound();
    throw error;
  }
}

export default async function UsuariosPage() {
  const { users, viewerUserId } = await loadUsers();

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra los usuarios y sus roles de acceso.
        </p>
      </div>

      <CreateUserForm />

      <UsersTable users={users} viewerUserId={viewerUserId} />
    </div>
  );
}
