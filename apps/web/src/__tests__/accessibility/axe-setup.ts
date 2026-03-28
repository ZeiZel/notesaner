/**
 * axe-core Integration Setup
 * ==========================
 * Centralized configuration for @axe-core/playwright, providing reusable
 * helpers for WCAG 2.1 AA accessibility testing across the Notesaner frontend.
 *
 * Exports:
 *   - createAxeBuilder()   — pre-configured AxeBuilder targeting WCAG 2.1 AA
 *   - checkAccessibility() — run axe scan and assert zero violations
 *   - formatViolations()   — human-readable violation summary for test output
 *   - A11Y_TAGS           — WCAG tag constants for selective rule targeting
 *   - PAGE_ROUTES          — key application routes for cross-page scanning
 *
 * @module __tests__/accessibility/axe-setup
 */

import { type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * WCAG 2.1 AA tags used to scope axe rules.
 * These tags map to the axe-core rule tag taxonomy.
 * @see https://www.deque.com/axe/core-documentation/api-documentation/#axe-core-tags
 */
export const A11Y_TAGS = {
  /** WCAG 2.0 Level A */
  WCAG_2_0_A: 'wcag2a',
  /** WCAG 2.0 Level AA */
  WCAG_2_0_AA: 'wcag2aa',
  /** WCAG 2.1 Level A */
  WCAG_2_1_A: 'wcag21a',
  /** WCAG 2.1 Level AA */
  WCAG_2_1_AA: 'wcag21aa',
  /** Best practices (not formal WCAG requirements) */
  BEST_PRACTICE: 'best-practice',
} as const;

/**
 * Default WCAG tags to test against — targets WCAG 2.1 AA compliance.
 */
export const DEFAULT_WCAG_TAGS = [
  A11Y_TAGS.WCAG_2_0_A,
  A11Y_TAGS.WCAG_2_0_AA,
  A11Y_TAGS.WCAG_2_1_A,
  A11Y_TAGS.WCAG_2_1_AA,
] as const;

/**
 * Key application routes for cross-page a11y testing.
 * Uses realistic path patterns; dynamic segments use placeholder values.
 */
export const PAGE_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  WORKSPACE_HOME: '/workspaces/test-workspace-id',
  EDITOR: '/workspaces/test-workspace-id/notes/test-note-id',
  SETTINGS_GENERAL: '/workspaces/test-workspace-id/settings/general',
  SETTINGS_MEMBERS: '/workspaces/test-workspace-id/settings/members',
  SETTINGS_APPEARANCE: '/workspaces/test-workspace-id/settings/appearance',
  GRAPH: '/workspaces/test-workspace-id/graph',
  PLUGINS: '/workspaces/test-workspace-id/plugins',
} as const;

/**
 * Known axe rule IDs to exclude from scans.
 *
 * Some rules produce false positives in test environments (e.g., color-contrast
 * checks on elements with dynamic theme CSS variables that axe cannot resolve).
 * Each exclusion is documented with the rationale.
 */
export const EXCLUDED_RULES: string[] = [
  // color-contrast can produce false positives with CSS custom properties
  // that axe cannot resolve at scan time. Color contrast is tested separately
  // in color-contrast.test.ts with explicit computed-style validation.
  // 'color-contrast',
];

// ---------------------------------------------------------------------------
// Axe Result Types (re-exported for convenience)
// ---------------------------------------------------------------------------

export interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

export interface AxeResults {
  violations: AxeViolation[];
  passes: Array<{ id: string; description: string }>;
  incomplete: Array<{ id: string; description: string }>;
  inapplicable: Array<{ id: string; description: string }>;
}

// ---------------------------------------------------------------------------
// createAxeBuilder
// ---------------------------------------------------------------------------

interface CreateAxeBuilderOptions {
  /**
   * Override WCAG tags to test against.
   * Defaults to WCAG 2.1 AA (Level A + AA).
   */
  tags?: readonly string[];

  /**
   * Additional rule IDs to disable for this specific scan.
   * Merged with EXCLUDED_RULES.
   */
  disableRules?: string[];

  /**
   * CSS selectors to exclude from the scan.
   * Useful for third-party widgets or elements under active development.
   */
  excludeSelectors?: string[];

  /**
   * CSS selectors to include in the scan (narrows scope).
   * If provided, only these elements are tested.
   */
  includeSelectors?: string[];
}

/**
 * Creates a pre-configured AxeBuilder instance targeting WCAG 2.1 AA.
 *
 * @param page - Playwright Page object
 * @param options - Configuration overrides
 * @returns Configured AxeBuilder ready for .analyze()
 *
 * @example
 * ```ts
 * const results = await createAxeBuilder(page).analyze();
 * expect(results.violations).toHaveLength(0);
 * ```
 */
export function createAxeBuilder(page: Page, options: CreateAxeBuilderOptions = {}): AxeBuilder {
  const {
    tags = DEFAULT_WCAG_TAGS,
    disableRules = [],
    excludeSelectors = [],
    includeSelectors = [],
  } = options;

  let builder = new AxeBuilder({ page })
    .withTags([...tags])
    .disableRules([...EXCLUDED_RULES, ...disableRules]);

  // Apply include/exclude selectors
  for (const selector of excludeSelectors) {
    builder = builder.exclude(selector);
  }

  for (const selector of includeSelectors) {
    builder = builder.include(selector);
  }

  return builder;
}

// ---------------------------------------------------------------------------
// checkAccessibility
// ---------------------------------------------------------------------------

interface CheckAccessibilityOptions extends CreateAxeBuilderOptions {
  /**
   * Custom assertion message prefix.
   */
  label?: string;
}

/**
 * Runs an axe accessibility scan and returns violations.
 *
 * Does NOT throw on its own — returns the violations array so the caller
 * can use Playwright's expect() for better error messages.
 *
 * @param page - Playwright Page object
 * @param options - Configuration overrides
 * @returns Array of violations (empty if fully accessible)
 *
 * @example
 * ```ts
 * const violations = await checkAccessibility(page, { label: 'Login page' });
 * expect(violations, formatViolations(violations)).toHaveLength(0);
 * ```
 */
export async function checkAccessibility(
  page: Page,
  options: CheckAccessibilityOptions = {},
): Promise<AxeViolation[]> {
  const builder = createAxeBuilder(page, options);
  const results = await builder.analyze();
  return results.violations as AxeViolation[];
}

// ---------------------------------------------------------------------------
// formatViolations
// ---------------------------------------------------------------------------

/**
 * Formats axe violations into a human-readable string for test failure output.
 *
 * @param violations - Array of axe violations
 * @returns Formatted string with violation details
 */
export function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return 'No accessibility violations found.';

  const header = `\n${'='.repeat(72)}\nACCESSIBILITY VIOLATIONS: ${violations.length} issue(s) found\n${'='.repeat(72)}\n`;

  const details = violations
    .map((v, index) => {
      const nodes = v.nodes
        .map(
          (node) =>
            `    - Target: ${node.target.join(', ')}\n      HTML: ${node.html.substring(0, 200)}\n      Fix: ${node.failureSummary ?? 'See help URL'}`,
        )
        .join('\n');

      return [
        `\n[${index + 1}] ${v.id} (${v.impact ?? 'unknown'} impact)`,
        `    ${v.help}`,
        `    WCAG: ${v.tags.filter((t) => t.startsWith('wcag')).join(', ')}`,
        `    Help: ${v.helpUrl}`,
        `    Affected elements (${v.nodes.length}):`,
        nodes,
      ].join('\n');
    })
    .join('\n');

  return header + details;
}

// ---------------------------------------------------------------------------
// Utility: waitForPageReady
// ---------------------------------------------------------------------------

/**
 * Waits for the page to be fully loaded and interactive before running a11y scans.
 * Ensures dynamic content and lazy-loaded components are rendered.
 *
 * @param page - Playwright Page object
 */
export async function waitForPageReady(page: Page): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');

  // Wait for any loading spinners to disappear
  const spinner = page.locator('[class*="animate-spin"]');
  if ((await spinner.count()) > 0) {
    await spinner
      .first()
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => {
        // Spinner may have already disappeared — safe to continue
      });
  }

  // Give React a tick to hydrate and settle
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Utility: injectAxeAndScan — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Full scan pipeline: wait for page ready, inject axe, analyze, return formatted results.
 *
 * @param page - Playwright Page object
 * @param options - Configuration overrides
 * @returns Object with violations array and formatted string
 */
export async function injectAxeAndScan(
  page: Page,
  options: CheckAccessibilityOptions = {},
): Promise<{ violations: AxeViolation[]; formatted: string }> {
  await waitForPageReady(page);
  const violations = await checkAccessibility(page, options);
  return {
    violations,
    formatted: formatViolations(violations),
  };
}
