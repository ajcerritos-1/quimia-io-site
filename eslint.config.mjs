import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client — never hand-edited, never linted.
    "src/generated/**",
  ]),
  {
    // AD-3 / tenant-isolation spec: the only path to the database is the
    // Prisma Client Extension wrapper in `src/shared/db`. No other module
    // may import the generated client directly — that would bypass RLS
    // scoping (scoped mode) and the bootstrap-mode allowlist entirely.
    ignores: ["src/shared/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/generated/prisma", "**/generated/prisma/**"],
              message:
                "Direct imports from src/generated/prisma are forbidden outside src/shared/db (AD-3). Use the wrapper exported from src/shared/db instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
