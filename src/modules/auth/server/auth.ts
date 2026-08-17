/**
 * Better Auth configuration (design.md "Better Auth Config"). Binds Better
 * Auth's Prisma adapter to `authPrisma` — the tenant-ambient Proxy from
 * `src/shared/db` (D1) — never a raw client. Every read/write Better Auth
 * performs against `user` therefore runs inside whatever scoped context is
 * active for the CURRENT request (established by the sign-in action or
 * middleware, D2) and is subject to RLS exactly like any other module.
 *
 * `isActive` rejection happens here, in `databaseHooks.session.create.before`
 * (D11, AC-4) — NOT as a post-signIn check in the action. A post-hoc check
 * would already have minted a session; rejecting inside creation means the
 * session row for an inactive user is never persisted at all.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth";
import { createId } from "@paralleldrive/cuid2";
import { authPrisma, scoped } from "../../../shared/db";
import { getContext } from "../../../shared/context/request-context";
import type { TenantContext } from "../../../shared/db";
import { env } from "../../../shared/config/env";

/**
 * The ONE generic failure body for AC-4: unknown tenant, inactive tenant,
 * unknown identifier, wrong password, inactive user all resolve to this
 * exact code/message — no field-specific or account-state hint, ever.
 */
export const AUTH_INVALID_CREDENTIALS = {
  code: "AUTH_INVALID_CREDENTIALS",
  message: "Invalid credentials.",
} as const;

// NFR-2, centralized here (AD-8) rather than left to the UI form. Exported
// so any other module that needs this same policy (e.g. Story 1.2's
// create-user Zod schema) reads THIS value instead of hardcoding a second,
// possibly-divergent length check.
export const MIN_PASSWORD_LENGTH = 12;

export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    autoSignIn: true,
  },
  user: {
    modelName: "user",
    additionalFields: {
      tenantId: { type: "string", required: true, input: false },
      nickname: { type: "string", required: true, input: false },
      role: { type: "string", required: true, input: false },
      isActive: {
        type: "boolean",
        required: true,
        input: false,
        defaultValue: true,
      },
    },
  },
  session: {
    additionalFields: {
      tenantId: { type: "string", required: true, input: false },
    },
    // Re-read the user row every request instead of trusting a cached
    // cookie — isActive/role must stay authoritative (design.md).
    cookieCache: { enabled: false },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const context = getContext();
          if (!context) {
            // No tenant context means this session-create attempt did not
            // go through the sign-in action's runWithContext — AD-3 forbids
            // an unscoped fallback (same posture as the ambient proxy).
            throw new APIError("UNAUTHORIZED", AUTH_INVALID_CREDENTIALS);
          }
          const tenantContext: TenantContext = {
            tenantId: context.tenant.tenantId,
            role: context.tenant.role as TenantContext["role"],
          };
          const user = await scoped(tenantContext).user.findUnique({
            where: { id: session.userId },
          });
          if (!user?.isActive) {
            throw new APIError("UNAUTHORIZED", AUTH_INVALID_CREDENTIALS);
          }
          return {
            data: { ...session, tenantId: context.tenant.tenantId },
          };
        },
      },
    },
  },
  advanced: {
    database: { generateId: () => createId() },
  },
});
