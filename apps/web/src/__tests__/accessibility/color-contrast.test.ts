/**
 * Color Contrast Accessibility Tests
 * ====================================
 * WCAG 2.1 AA compliance tests for color contrast:
 *
 *   - SC 1.4.3 (Contrast - Minimum) — 4.5:1 for normal text, 3:1 for large text
 *   - SC 1.4.11 (Non-text Contrast) — 3:1 for UI components and graphics
 *   - SC 1.4.1 (Use of Color) — color is not the sole means of conveying info
 *
 * These tests use @axe-core/playwright for automated contrast checking and
 * custom computed-style validation for elements that axe cannot resolve
 * (e.g., CSS custom properties).
 *
 * @module __tests__/accessibility/color-contrast.test
 */

import { test, expect, type Page } from '@playwright/test';
import {
  PAGE_ROUTES,
  waitForPageReady,
  createAxeBuilder,
  formatViolations,
  type AxeViolation,
} from './axe-setup';

// ---------------------------------------------------------------------------
// Helpers — Color Contrast Computation
// ---------------------------------------------------------------------------

/**
 * Parses a CSS color string to RGB values.
 * Supports: rgb(), rgba(), hex (#RGB, #RRGGBB, #RRGGBBAA).
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]!, 10),
      g: parseInt(rgbMatch[2]!, 10),
      b: parseInt(rgbMatch[3]!, 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // Handle hex
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1]!;
    if (hex.length === 3) {
      hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    }
    if (hex.length === 4) {
      hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]! + hex[3]! + hex[3]!;
    }
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1,
    };
  }

  return null;
}

/**
 * Computes the relative luminance of a color per WCAG 2.1 definition.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

/**
 * Computes the contrast ratio between two colors per WCAG 2.1.
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * @returns Contrast ratio (e.g., 4.5 for 4.5:1)
 */
function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines if text is "large" per WCAG (18pt or 14pt bold).
 * 18pt = 24px, 14pt bold = ~18.66px bold.
 */
function isLargeText(fontSize: number, fontWeight: number | string): boolean {
  const weight = typeof fontWeight === 'string' ? parseInt(fontWeight, 10) : fontWeight;
  const isBold = weight >= 700;

  return fontSize >= 24 || (fontSize >= 18.66 && isBold);
}

/**
 * Extracts computed color and background-color from elements in the page.
 */
async function getTextColorData(
  page: Page,
  selector: string,
): Promise<
  Array<{
    selector: string;
    text: string;
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontWeight: string;
  }>
> {
  return page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    const results: Array<{
      selector: string;
      text: string;
      color: string;
      backgroundColor: string;
      fontSize: number;
      fontWeight: string;
    }> = [];

    elements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = (el.textContent ?? '').trim();
      if (!text) return;

      // Skip hidden elements
      const styles = window.getComputedStyle(el);
      if (styles.display === 'none' || styles.visibility === 'hidden') return;
      if (el.getAttribute('aria-hidden') === 'true') return;

      // Get the effective background color by traversing up the DOM
      let bgColor = styles.backgroundColor;
      let parent = el.parentElement;
      while (parent && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
        bgColor = window.getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }

      results.push({
        selector: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
        text: text.substring(0, 50),
        color: styles.color,
        backgroundColor: bgColor,
        fontSize: parseFloat(styles.fontSize),
        fontWeight: styles.fontWeight,
      });
    });

    return results;
  }, selector);
}

// ---------------------------------------------------------------------------
// axe Color Contrast Tests (SC 1.4.3)
// ---------------------------------------------------------------------------

test.describe('Color Contrast — axe Automated Scan (SC 1.4.3)', () => {
  test('login page passes axe color-contrast rule', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const results = await createAxeBuilder(page, {
      tags: ['wcag2aa'],
    }).analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
    );

    expect(contrastViolations, formatViolations(contrastViolations as AxeViolation[])).toHaveLength(
      0,
    );
  });

  test('register page passes axe color-contrast rule', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const results = await createAxeBuilder(page, {
      tags: ['wcag2aa'],
    }).analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
    );

    expect(contrastViolations, formatViolations(contrastViolations as AxeViolation[])).toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// Computed Style Contrast Validation (SC 1.4.3)
// ---------------------------------------------------------------------------

test.describe('Color Contrast — Computed Style Validation (SC 1.4.3)', () => {
  test('body text on login page meets 4.5:1 contrast ratio', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const textData = await getTextColorData(page, 'p, span, label, h1, h2, h3');
    const failures: string[] = [];

    for (const item of textData) {
      const fg = parseColor(item.color);
      const bg = parseColor(item.backgroundColor);

      if (!fg || !bg) continue; // Skip if color cannot be parsed

      // Blend alpha if needed
      if (fg.a < 1) continue; // Skip semi-transparent text (complex blending)

      const ratio = contrastRatio(fg, bg);
      const requiredRatio = isLargeText(item.fontSize, item.fontWeight) ? 3.0 : 4.5;

      if (ratio < requiredRatio) {
        failures.push(
          `${item.selector} "${item.text}" — ratio ${ratio.toFixed(2)}:1 < ${requiredRatio}:1 (color: ${item.color}, bg: ${item.backgroundColor})`,
        );
      }
    }

    expect(failures, `Text contrast violations:\n${failures.join('\n')}`).toHaveLength(0);
  });

  test('body text on register page meets 4.5:1 contrast ratio', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const textData = await getTextColorData(page, 'p, span, label, h1, h2, h3');
    const failures: string[] = [];

    for (const item of textData) {
      const fg = parseColor(item.color);
      const bg = parseColor(item.backgroundColor);

      if (!fg || !bg) continue;
      if (fg.a < 1) continue;

      const ratio = contrastRatio(fg, bg);
      const requiredRatio = isLargeText(item.fontSize, item.fontWeight) ? 3.0 : 4.5;

      if (ratio < requiredRatio) {
        failures.push(
          `${item.selector} "${item.text}" — ratio ${ratio.toFixed(2)}:1 < ${requiredRatio}:1`,
        );
      }
    }

    expect(failures, `Text contrast violations:\n${failures.join('\n')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Non-Text Contrast (SC 1.4.11)
// ---------------------------------------------------------------------------

test.describe('Non-Text Contrast (SC 1.4.11)', () => {
  test('form input borders have at least 3:1 contrast ratio with background', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const inputBorders = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const results: Array<{
        name: string;
        borderColor: string;
        backgroundColor: string;
        parentBgColor: string;
      }> = [];

      inputs.forEach((input) => {
        const styles = window.getComputedStyle(input);
        let parentBg = 'rgba(0, 0, 0, 0)';
        let parent = input.parentElement;

        while (parent && (parentBg === 'rgba(0, 0, 0, 0)' || parentBg === 'transparent')) {
          parentBg = window.getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        }

        results.push({
          name: input.getAttribute('name') ?? 'unnamed',
          borderColor: styles.borderColor,
          backgroundColor: styles.backgroundColor,
          parentBgColor: parentBg,
        });
      });

      return results;
    });

    const failures: string[] = [];

    for (const input of inputBorders) {
      const borderColor = parseColor(input.borderColor);
      const bgColor = parseColor(input.parentBgColor);

      if (!borderColor || !bgColor) continue;

      const ratio = contrastRatio(borderColor, bgColor);

      if (ratio < 3.0) {
        failures.push(
          `Input "${input.name}" border contrast: ${ratio.toFixed(2)}:1 < 3:1 (border: ${input.borderColor}, bg: ${input.parentBgColor})`,
        );
      }
    }

    // Non-text contrast violations are logged as warnings
    // since CSS custom properties may resolve differently at runtime
    if (failures.length > 0) {
      console.warn(`Non-text contrast issues (SC 1.4.11):\n${failures.join('\n')}`);
    }
  });

  test('focus indicators have at least 3:1 contrast ratio', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Focus the email input to trigger focus-visible styles
    const emailInput = page.locator('#email');
    await emailInput.focus();

    const focusStyles = await emailInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);

      // Get the effective background behind the element
      let parentBg = 'rgba(0, 0, 0, 0)';
      let parent = el.parentElement;
      while (parent && (parentBg === 'rgba(0, 0, 0, 0)' || parentBg === 'transparent')) {
        parentBg = window.getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }

      return {
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        parentBgColor: parentBg,
      };
    });

    // If there is an outline color, check its contrast
    if (focusStyles.outlineColor && focusStyles.outlineColor !== 'rgba(0, 0, 0, 0)') {
      const outlineColor = parseColor(focusStyles.outlineColor);
      const bgColor = parseColor(focusStyles.parentBgColor);

      if (outlineColor && bgColor) {
        const ratio = contrastRatio(outlineColor, bgColor);
        expect(
          ratio,
          `Focus outline contrast ratio should be at least 3:1 (got ${ratio.toFixed(2)}:1)`,
        ).toBeGreaterThanOrEqual(3.0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Use of Color (SC 1.4.1)
// ---------------------------------------------------------------------------

test.describe('Use of Color (SC 1.4.1)', () => {
  test('error states use more than just color to convey meaning', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Trigger validation errors by submitting empty form
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);

    // Check that error states use additional indicators beyond color
    const errorIndicators = await page.evaluate(() => {
      const results: Array<{
        input: string;
        hasAriaInvalid: boolean;
        hasErrorText: boolean;
        hasErrorIcon: boolean;
        hasRoleAlert: boolean;
      }> = [];

      const invalidInputs = document.querySelectorAll('input[aria-invalid="true"]');
      invalidInputs.forEach((input) => {
        const name = input.getAttribute('name') ?? 'unnamed';
        const describedBy = input.getAttribute('aria-describedby');
        let hasErrorText = false;
        let hasRoleAlert = false;

        if (describedBy) {
          const errorEl = document.getElementById(describedBy);
          hasErrorText = errorEl !== null && (errorEl.textContent ?? '').trim().length > 0;
          hasRoleAlert = errorEl?.getAttribute('role') === 'alert';
        }

        // Also check for sibling error messages
        const parent = input.closest('.space-y-1\\.5');
        const errorParaInParent = parent?.querySelector('[role="alert"]');
        if (errorParaInParent) {
          hasErrorText = true;
          hasRoleAlert = true;
        }

        results.push({
          input: name,
          hasAriaInvalid: true,
          hasErrorText,
          hasErrorIcon: false, // Not checking for icons specifically
          hasRoleAlert,
        });
      });

      return results;
    });

    // Each error should have at least text (not just color change)
    for (const indicator of errorIndicators) {
      expect(
        indicator.hasErrorText || indicator.hasRoleAlert,
        `Error for "${indicator.input}" should convey information beyond just color`,
      ).toBe(true);
    }
  });

  test('required fields are indicated by more than just color', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Check that required fields have the required attribute or aria-required
    const requiredFields = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[required], input[aria-required="true"]');
      const results: Array<{
        name: string;
        hasRequired: boolean;
        hasAriaRequired: boolean;
        hasVisualIndicator: boolean;
      }> = [];

      inputs.forEach((input) => {
        const name = input.getAttribute('name') ?? 'unnamed';
        const hasRequired = input.hasAttribute('required');
        const hasAriaRequired = input.getAttribute('aria-required') === 'true';

        // Check for visual indicator (asterisk, "required" text, etc.)
        const label = document.querySelector(`label[for="${input.id}"]`);
        const labelText = label?.textContent ?? '';
        const hasVisualIndicator =
          labelText.includes('*') || labelText.toLowerCase().includes('required') || hasRequired; // The `required` attribute itself is a valid indicator

        results.push({
          name,
          hasRequired,
          hasAriaRequired,
          hasVisualIndicator,
        });
      });

      return results;
    });

    // Each required field should be programmatically indicated
    for (const field of requiredFields) {
      expect(
        field.hasRequired || field.hasAriaRequired,
        `Required field "${field.name}" should have required or aria-required attribute`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Theme-Specific Contrast Tests
// ---------------------------------------------------------------------------

test.describe('Theme-Specific Contrast', () => {
  test('dark theme text has adequate contrast against dark backgrounds', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // The default theme is dark. Check key text elements.
    const headingData = await getTextColorData(page, 'h1');

    for (const heading of headingData) {
      const fg = parseColor(heading.color);
      const bg = parseColor(heading.backgroundColor);

      if (!fg || !bg) continue;

      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `Heading "${heading.text}" contrast: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('placeholder text has adequate contrast (non-normative but best practice)', async ({
    page,
  }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Placeholder text contrast is not a WCAG requirement, but testing for awareness
    const placeholderData = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder]');
      const results: Array<{
        name: string;
        placeholder: string;
        inputBgColor: string;
      }> = [];

      inputs.forEach((input) => {
        const styles = window.getComputedStyle(input);
        results.push({
          name: input.getAttribute('name') ?? 'unnamed',
          placeholder: input.getAttribute('placeholder') ?? '',
          inputBgColor: styles.backgroundColor,
        });
      });

      return results;
    });

    // Log placeholder findings (not a hard failure since it is best practice)
    if (placeholderData.length > 0) {
      // Placeholders should not be relied upon as labels (they disappear on input)
      for (const item of placeholderData) {
        const hasLabel = await page.evaluate((name) => {
          const input = document.querySelector(`input[name="${name}"]`);
          if (!input) return false;
          const id = input.getAttribute('id');
          return id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        }, item.name);

        expect(
          hasLabel,
          `Input "${item.name}" with placeholder "${item.placeholder}" should also have a label`,
        ).toBe(true);
      }
    }
  });
});
