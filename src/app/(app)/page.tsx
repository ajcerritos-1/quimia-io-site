/**
 * Root landing page (Story 1.5 Task 8, AC 5). Replaces the create-next-app
 * placeholder, which is deleted entirely.
 *
 * `/` is a role-agnostic authenticated placeholder, NOT a role-conditional
 * redirect to `/usuarios` — see this story's own Dev Notes for why: a
 * `recepcionista`/`quimico` has genuinely nowhere else to go yet (Epics 2-11
 * haven't shipped), so redirecting them to `/usuarios` would just trade the
 * old dead end for an immediate 404 (`requireAdmin()` still gates that page,
 * unchanged). Every authenticated role sees this same minimal, professional-
 * tone Spanish placeholder (`UX-DR22`/NFR-9's voice-and-tone standard).
 *
 * The "Ir a Usuarios" shortcut renders only when `isRoleAllowed(actor.role,
 * ["admin"])` is true — the same registry-driven visibility check the
 * sidebar uses, not a second ad-hoc check.
 *
 * Resolves its own actor via `getCurrentActor()` (see `(app)/layout.tsx`'s
 * note on why the layout can't hand it down) — unauthenticated visitors
 * never reach this far; the shell layout already redirected them to
 * `/sign-in` before this page's own body would render.
 *
 * This placeholder is explicitly temporary scaffolding — Epic 10's real
 * Dashboard (`FR-51`) replaces it, not a first draft to iterate on.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { AppError } from "@/shared/http/errors";
import { isRoleAllowed } from "@/modules/auth/roles";
import { getCurrentActor, type Actor } from "@/modules/auth/server/get-current-actor";

async function resolveActor(): Promise<Actor> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await getCurrentActor(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) => actor,
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    throw error;
  }
}

export default async function HomePage() {
  const actor = await resolveActor();
  const canManageUsers = isRoleAllowed(actor.role, ["admin"]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Bienvenido a Quimia IO.</h1>
      <p className="text-sm text-muted-foreground">
        Sesión iniciada correctamente. Usa el menú de navegación para acceder
        a las secciones disponibles para tu rol.
      </p>
      {canManageUsers ? (
        <Link
          href="/usuarios"
          className="w-fit rounded-lg border border-transparent text-sm font-medium text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Ir a Usuarios
        </Link>
      ) : null}
    </div>
  );
}
