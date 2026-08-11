/**
 * Phase 5.5 — confirms `eslint.config.mjs`'s `no-restricted-imports` rule
 * (AD-3) actually catches a planted direct import of the generated Prisma
 * client from outside `src/shared/db`, and does NOT flag the same import
 * inside `src/shared/db` itself (the wrapper is the one place allowed to
 * import it). Runs the REAL flat config via ESLint's Node API against
 * virtual fixture text — no DB needed, but co-located with the rest of
 * Phase 5 per this batch's file layout.
 */
import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIRECT_IMPORT_FIXTURE =
  'import { PrismaClient } from "../generated/prisma/client";\n' +
  "export const client = PrismaClient;\n";

// One shared instance: eslint-config-next's typescript rules build a full
// TS program (project service) against tsconfig.json on first use, which is
// slow (~100s cold). A shared instance amortizes that cost across both
// assertions instead of paying it twice.
const eslint = new ESLint({ cwd: process.cwd() });

describe("eslint.config.mjs — db-access boundary (AD-3)", () => {
  it(
    "flags a direct import of the generated Prisma client outside src/shared/db",
    async () => {
      const results = await eslint.lintText(DIRECT_IMPORT_FIXTURE, {
        filePath: path.join(process.cwd(), "src/modules/planted-violation.ts"),
      });

      const messages = results[0]?.messages ?? [];
      expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(
        true,
      );
    },
    120_000,
  );

  it(
    "does NOT flag the same import from inside src/shared/db (the wrapper itself)",
    async () => {
      const results = await eslint.lintText(DIRECT_IMPORT_FIXTURE, {
        filePath: path.join(process.cwd(), "src/shared/db/planted-fixture.ts"),
      });

      const messages = results[0]?.messages ?? [];
      expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(
        false,
      );
    },
    120_000,
  );
});
