/**
 * The app shell (Story 1.5 Task 6, AC 1/2/4/5). A Next.js route group —
 * `(app)` adds no URL segment, so every route nested inside it keeps its
 * existing URL (`(app)/usuarios/page.tsx` still serves at `/usuarios`,
 * `(app)/page.tsx` still serves at `/`). This is the standard Next.js
 * pattern for one shared layout across several routes with no path segment
 * added — not a custom higher-order-component wrapper.
 *
 * Resolves the actor via `getCurrentActor()` — not `requireAdmin`/
 * `requireRole`, since the shell is shared across every role. Follows
 * `usuarios/page.tsx`'s exact existing pattern for resolving
 * `CurrentActorRequest` from `headers()` and its exact `catch` pattern: an
 * `AppError` with `status === 401` (no session / inactive user) redirects to
 * `/sign-in`. The shell does NOT handle 403 — it imposes no role
 * restriction of its own; a nested page (like `/usuarios`) still enforces
 * its OWN role gate exactly as it does today, unchanged (AC 4).
 *
 * Breakpoint: desktop/tablet (>= Tailwind's `md`, 768px) gets the full,
 * always-visible sidebar (`Sidebar`'s `hidden md:flex`); phone (< 768px)
 * gets the off-canvas drawer (`NavDrawer`, composed inside `Topbar`). No
 * exact px value is pinned by any project document — this is epics.md's own
 * two-state AC, not `EXPERIENCE.md`'s optional three-tier/icon-collapsed
 * tablet variant (out of scope, see this story's Dev Notes).
 *
 * This layout and any nested page (e.g. `(app)/page.tsx`) each
 * independently resolve the actor — Next.js Server Components don't pass
 * data from a layout down to its nested page via props (a layout only
 * receives `children`), so this is the established, correct pattern in this
 * codebase, not duplication to eliminate. Both share the same
 * `resolveActor()` helper (code review P3), and the underlying
 * `getCurrentActor()` resolution is memoized per request (code review P4),
 * so the two independent calls don't pay for duplicate session/user queries.
 */
import "server-only";
import { resolveActor } from "@/modules/auth/server/resolve-actor";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const actor = await resolveActor();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar role={actor.role} className="hidden md:flex" />
      <div className="flex flex-1 flex-col">
        <Topbar role={actor.role} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
