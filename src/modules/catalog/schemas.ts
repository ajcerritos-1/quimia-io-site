/**
 * Shared client-safe Zod schemas for catalog create/update (Story 2.1, change
 * 2/6). Mirrors `src/modules/auth/server/password-policy.ts`'s zero-other-
 * imports pattern: the ONLY import here is `zod`, which is itself client-safe
 * (no `src/shared/db` in its module graph), so the client form and the plain
 * server actions can both import these without leaking Prisma/`pg` into the
 * client bundle. The server's `safeParse` remains the authoritative source of
 * truth (AD-8 "no divergent check").
 *
 * The `z.discriminatedUnion("kind", [...])` gives each mutation's `switch
 * (kind)` a narrowed, typed payload; Equipment is the only superset (`model`,
 * `serialNumber`, `calibrationDate?`). `calibrationDate` normalizes `""` and
 * `null` to `null` via a preprocess at the FormData boundary, so the HTML
 * `<input type="date">` `"yyyy-MM-dd"` string coerces to a `Date` for Prisma
 * and `null` for "uncalibrated equipment" (FR-9).
 */
import { z } from "zod";

const name = z.string().min(1, "Ingresa un nombre.");
const calibrationDate = z
  .preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable())
  .optional();

export const catalogCreateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("metodos"), name }),
  z.object({ kind: z.literal("tecnicas"), name }),
  z.object({
    kind: z.literal("equipos"),
    name,
    model: z.string().min(1, "Ingresa el modelo."),
    serialNumber: z.string().min(1, "Ingresa el número de serie."),
    calibrationDate,
  }),
  z.object({ kind: z.literal("recipientes"), name }),
  z.object({ kind: z.literal("tipos-de-muestra"), name }),
]);

export const catalogUpdateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("metodos"), id: z.string().min(1), name }),
  z.object({ kind: z.literal("tecnicas"), id: z.string().min(1), name }),
  z.object({
    kind: z.literal("equipos"),
    id: z.string().min(1),
    name,
    model: z.string().min(1, "Ingresa el modelo."),
    serialNumber: z.string().min(1, "Ingresa el número de serie."),
    calibrationDate,
  }),
  z.object({ kind: z.literal("recipientes"), id: z.string().min(1), name }),
  z.object({ kind: z.literal("tipos-de-muestra"), id: z.string().min(1), name }),
]);

export type CreateCatalogInput = z.input<typeof catalogCreateSchema>;
export type UpdateCatalogInput = z.input<typeof catalogUpdateSchema>;
