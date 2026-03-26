// ESLint 9 Flat Config for Notesaner monorepo.
//
// Required devDependencies (add to package.json if not present):
//   typescript-eslint       — unified TypeScript parser + plugin for ESLint 9
//   @nx/eslint-plugin       — NX enforce-module-boundaries and related rules
//
// Design decisions:
//   - Uses the modern `typescript-eslint` unified package instead of the older
//     @typescript-eslint/parser + @typescript-eslint/eslint-plugin split, as
//     recommended by the typescript-eslint project for ESLint 9 flat configs.
//   - Separate rule configs are applied for apps/ vs libs/ to express
//     different quality expectations (apps can log, libs must not).
//   - Test files get relaxed rules because test code legitimately uses
//     patterns that are disallowed in production code (any, non-null, etc.).

import tseslint from 'typescript-eslint';
import nxPlugin from '@nx/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  // ── Global ignores ──────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.nx/**',
      '**/coverage/**',
      '**/.turbo/**',
      'pnpm-lock.yaml',
    ],
  },

  // ── Base TypeScript config (all TS/TSX files) ────────────────────────────
  // `tseslint.configs.recommended` gives us:
  //   - @typescript-eslint/parser as the language parser
  //   - @typescript-eslint/eslint-plugin rules at recommended severity
  // We extend it with project-aware rules that need type information.
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@nx': nxPlugin,
    },
    languageOptions: {
      parserOptions: {
        // Point at the workspace tsconfig so type-aware lint rules work.
        // Each project's own tsconfig extends tsconfig.base.json.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── TypeScript rules ──────────────────────────────────────────────
      // Flag unused variables as errors — prevents dead code accumulating.
      // Leading underscore prefix is the conventional escape hatch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Warn on explicit `any` — forces deliberate acknowledgment of type
      // unsafety rather than silent suppression.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Prefer const over let for values that are never reassigned.
      'prefer-const': 'error',
      // Allow non-null assertions but warn — they carry reviewer burden.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Forbid floating promises — unhandled rejections are silent failures.
      '@typescript-eslint/no-floating-promises': 'error',
      // Require consistent return in try/catch async functions.
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      // Disallow require() — use ES module imports consistently.
      '@typescript-eslint/no-require-imports': 'error',

      // ── NX boundary rules ────────────────────────────────────────────
      // Enforces the NX project dependency graph so no project can import
      // from another project that it is not allowed to depend on.
      // Tags are declared in each project's project.json (tags array).
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              // apps can consume libs and shared packages
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: ['scope:lib', 'scope:shared'],
            },
            {
              // libs can consume other libs and shared packages
              sourceTag: 'scope:lib',
              onlyDependOnLibsWithTags: ['scope:lib', 'scope:shared'],
            },
            {
              // shared packages (packages/*) may only depend on each other
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },

  // ── Apps-specific overrides ──────────────────────────────────────────────
  // App code runs in a controlled environment with a logger — raw console
  // output is a code smell (log levels, structured logs, etc. should be used).
  {
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ── Libs-specific overrides ──────────────────────────────────────────────
  // Library code is public API consumed by apps and other libs. It has no
  // logger context and should never write to stdout/stderr directly.
  {
    files: ['libs/**/*.ts', 'packages/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },

  // ── Test files ────────────────────────────────────────────────────────────
  // Test helpers legitimately use any, non-null assertions, console output,
  // and unhandled promises (e.g., expect(...).rejects). Relax accordingly.
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    },
  },

  // ── Plain JavaScript config files ────────────────────────────────────────
  // Config files (vitest.config.ts, eslint.config.mjs, etc.) are already
  // covered by the TS configs above. This block handles any remaining .js/.mjs
  // files that are not TypeScript (e.g., legacy scripts).
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
