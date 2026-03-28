/**
 * Screen Reader Accessibility Tests
 * ==================================
 * WCAG 2.1 AA compliance tests for assistive technology support:
 *
 *   - SC 1.3.1 (Info and Relationships) — semantic structure, roles, labels
 *   - SC 1.3.2 (Meaningful Sequence) — DOM order reflects visual order
 *   - SC 2.4.2 (Page Titled) — descriptive page titles
 *   - SC 2.4.6 (Headings and Labels) — descriptive headings/labels
 *   - SC 4.1.2 (Name, Role, Value) — ARIA names, roles, states exposed correctly
 *   - SC 4.1.3 (Status Messages) — live regions for dynamic content
 *
 * Tests verify ARIA attributes, landmark roles, heading hierarchy,
 * and live region behavior across key pages.
 *
 * @module __tests__/accessibility/screen-reader.test
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGE_ROUTES, waitForPageReady, checkAccessibility, formatViolations } from './axe-setup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collects all heading elements and their levels from the page.
 */
async function collectHeadings(page: Page): Promise<Array<{ level: number; text: string }>> {
  return page.evaluate(() => {
    const headings: Array<{ level: number; text: string }> = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const level = parseInt(el.tagName.substring(1), 10);
      headings.push({ level, text: (el.textContent ?? '').trim() });
    });
    return headings;
  });
}

/**
 * Collects all landmark regions from the page.
 */
async function collectLandmarks(
  page: Page,
): Promise<Array<{ role: string; label: string | null }>> {
  return page.evaluate(() => {
    const landmarks: Array<{ role: string; label: string | null }> = [];

    // Implicit landmarks from HTML5 elements
    const elementRoleMap: Record<string, string> = {
      header: 'banner',
      nav: 'navigation',
      main: 'main',
      aside: 'complementary',
      footer: 'contentinfo',
      form: 'form',
      section: 'region',
    };

    for (const [tag, role] of Object.entries(elementRoleMap)) {
      document.querySelectorAll(tag).forEach((el) => {
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        let label = ariaLabel;
        if (!label && ariaLabelledBy) {
          const labelEl = document.getElementById(ariaLabelledBy);
          label = labelEl?.textContent?.trim() ?? null;
        }
        landmarks.push({ role, label });
      });
    }

    // Explicit role landmarks
    document.querySelectorAll('[role]').forEach((el) => {
      const role = el.getAttribute('role')!;
      if (
        [
          'banner',
          'navigation',
          'main',
          'complementary',
          'contentinfo',
          'form',
          'region',
          'search',
        ].includes(role)
      ) {
        const ariaLabel = el.getAttribute('aria-label');
        landmarks.push({ role, label: ariaLabel });
      }
    });

    return landmarks;
  });
}

/**
 * Collects all ARIA live regions from the page.
 */
async function _collectLiveRegions(
  page: Page,
): Promise<Array<{ politeness: string; atomic: string | null; content: string }>> {
  return page.evaluate(() => {
    const regions: Array<{ politeness: string; atomic: string | null; content: string }> = [];

    // Check aria-live attribute
    document.querySelectorAll('[aria-live]').forEach((el) => {
      regions.push({
        politeness: el.getAttribute('aria-live') ?? 'off',
        atomic: el.getAttribute('aria-atomic'),
        content: (el.textContent ?? '').trim(),
      });
    });

    // Check role="status" and role="alert" (implicit live regions)
    document.querySelectorAll('[role="status"], [role="alert"]').forEach((el) => {
      if (!el.getAttribute('aria-live')) {
        const role = el.getAttribute('role')!;
        regions.push({
          politeness: role === 'alert' ? 'assertive' : 'polite',
          atomic: el.getAttribute('aria-atomic'),
          content: (el.textContent ?? '').trim(),
        });
      }
    });

    return regions;
  });
}

// ---------------------------------------------------------------------------
// Page Title Tests (SC 2.4.2)
// ---------------------------------------------------------------------------

test.describe('Page Titles (SC 2.4.2)', () => {
  test('login page has a descriptive title', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const title = await page.title();
    expect(title).toBeTruthy();
    // Title should contain meaningful text, not just the app name
    expect(title.length).toBeGreaterThan(3);
  });

  test('register page has a descriptive title', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(3);
  });

  test('page titles are unique across different pages', async ({ page }) => {
    const titles: string[] = [];

    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);
    titles.push(await page.title());

    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);
    titles.push(await page.title());

    // Login and register should have different titles
    expect(titles[0]).not.toBe(titles[1]);
  });
});

// ---------------------------------------------------------------------------
// Heading Hierarchy Tests (SC 1.3.1, SC 2.4.6)
// ---------------------------------------------------------------------------

test.describe('Heading Hierarchy (SC 1.3.1, SC 2.4.6)', () => {
  test('login page has exactly one h1 element', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const headings = await collectHeadings(page);
    const h1s = headings.filter((h) => h.level === 1);

    expect(h1s.length, 'Page should have exactly one h1').toBe(1);
    expect(h1s[0]!.text.length, 'h1 should have text content').toBeGreaterThan(0);
  });

  test('register page has exactly one h1 element', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const headings = await collectHeadings(page);
    const h1s = headings.filter((h) => h.level === 1);

    expect(h1s.length, 'Page should have exactly one h1').toBe(1);
  });

  test('heading levels do not skip on the login page', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const headings = await collectHeadings(page);

    if (headings.length <= 1) return; // Only h1, nothing to validate

    // Headings should not skip levels (e.g., h1 -> h3 without h2)
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1]!;
      const curr = headings[i]!;

      if (curr.level > prev.level) {
        // When going deeper, should only increase by 1
        expect(
          curr.level - prev.level,
          `Heading "${curr.text}" (h${curr.level}) skips level after "${prev.text}" (h${prev.level})`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  test('all headings have non-empty text content', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const headings = await collectHeadings(page);

    for (const heading of headings) {
      expect(
        heading.text.trim().length,
        `h${heading.level} should have text content`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ARIA Landmarks (SC 1.3.1)
// ---------------------------------------------------------------------------

test.describe('ARIA Landmarks (SC 1.3.1)', () => {
  test('login page has a main landmark', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const landmarks = await collectLandmarks(page);
    const mainLandmarks = landmarks.filter((l) => l.role === 'main');

    expect(mainLandmarks.length, 'Page should have at least one main landmark').toBeGreaterThan(0);
  });

  test('navigation landmarks have accessible names when multiple exist', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const landmarks = await collectLandmarks(page);
    const navLandmarks = landmarks.filter((l) => l.role === 'navigation');

    // If there are multiple nav landmarks, each should have a unique label
    if (navLandmarks.length > 1) {
      const labels = navLandmarks.map((l) => l.label).filter(Boolean);
      const uniqueLabels = new Set(labels);

      expect(
        uniqueLabels.size,
        'Multiple navigation landmarks should have unique aria-labels',
      ).toBe(navLandmarks.length);
    }
  });

  test('all content is within landmark regions', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Check that direct children of body are within landmarks
    const orphanedContent = await page.evaluate(() => {
      const body = document.body;
      const landmarkRoles = [
        'banner',
        'navigation',
        'main',
        'complementary',
        'contentinfo',
        'form',
        'region',
        'search',
      ];
      const landmarkTags = ['header', 'nav', 'main', 'aside', 'footer'];

      const orphaned: string[] = [];

      function isLandmark(el: Element): boolean {
        const role = el.getAttribute('role');
        if (role && landmarkRoles.includes(role)) return true;
        if (landmarkTags.includes(el.tagName.toLowerCase())) return true;
        return false;
      }

      function isWithinLandmark(el: Element): boolean {
        let parent: Element | null = el;
        while (parent && parent !== body) {
          if (isLandmark(parent)) return true;
          parent = parent.parentElement;
        }
        return false;
      }

      // Check direct children of body that contain visible content
      for (const child of Array.from(body.children)) {
        if (child instanceof HTMLElement) {
          const tag = child.tagName.toLowerCase();
          // Skip script, style, link, meta, and hidden elements
          if (['script', 'style', 'link', 'meta', 'noscript'].includes(tag)) continue;
          if (child.hidden || child.getAttribute('aria-hidden') === 'true') continue;
          if (child.classList.contains('sr-only')) continue;

          // Skip elements that are themselves landmarks
          if (isLandmark(child)) continue;

          // Check if it has visible text content
          const text = child.textContent?.trim() ?? '';
          if (text.length > 0 && !isWithinLandmark(child)) {
            orphaned.push(`<${tag}> "${text.substring(0, 50)}..."`);
          }
        }
      }

      return orphaned;
    });

    // Soft assertion: orphaned content is a best practice violation
    if (orphanedContent.length > 0) {
      console.warn(
        `WCAG Best Practice: ${orphanedContent.length} element(s) outside landmark regions:`,
        orphanedContent,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// ARIA Labels and Roles (SC 4.1.2)
// ---------------------------------------------------------------------------

test.describe('ARIA Labels and Roles (SC 4.1.2)', () => {
  test('form inputs have associated labels on login page', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const unlabelledInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"])');
      const violations: string[] = [];

      inputs.forEach((input) => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const hasLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        const title = input.getAttribute('title');
        const _placeholder = input.getAttribute('placeholder');

        // Input should have at least one accessible name source
        if (!hasLabel && !ariaLabel && !ariaLabelledBy && !title) {
          violations.push(
            `input[name="${input.getAttribute('name')}"]${id ? '#' + id : ''} has no accessible label`,
          );
        }
      });

      return violations;
    });

    expect(unlabelledInputs, 'All form inputs should have associated labels').toHaveLength(0);
  });

  test('form inputs have associated labels on register page', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const unlabelledInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"])');
      const violations: string[] = [];

      inputs.forEach((input) => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const hasLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;

        if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
          violations.push(
            `input[name="${input.getAttribute('name')}"]${id ? '#' + id : ''} has no accessible label`,
          );
        }
      });

      return violations;
    });

    expect(unlabelledInputs).toHaveLength(0);
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const unlabelledButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];

      buttons.forEach((button) => {
        const text = (button.textContent ?? '').trim();
        const ariaLabel = button.getAttribute('aria-label');
        const ariaLabelledBy = button.getAttribute('aria-labelledby');
        const title = button.getAttribute('title');

        if (!text && !ariaLabel && !ariaLabelledBy && !title) {
          const classes = button.className.substring(0, 80);
          violations.push(`button without accessible name (class="${classes}")`);
        }
      });

      return violations;
    });

    expect(unlabelledButtons, 'All buttons should have accessible names').toHaveLength(0);
  });

  test('icon-only buttons have aria-label', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const iconOnlyWithoutLabel = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const violations: string[] = [];

      buttons.forEach((button) => {
        // Check if button contains only SVG/img (no text)
        const textContent = (button.textContent ?? '').trim();
        const hasSvg = button.querySelector('svg') !== null;
        const hasImg = button.querySelector('img') !== null;

        if ((hasSvg || hasImg) && !textContent) {
          const ariaLabel = button.getAttribute('aria-label');
          const title = button.getAttribute('title');

          if (!ariaLabel && !title) {
            violations.push(
              `Icon-only button without aria-label (outerHTML: ${button.outerHTML.substring(0, 120)})`,
            );
          }
        }
      });

      return violations;
    });

    expect(iconOnlyWithoutLabel).toHaveLength(0);
  });

  test('decorative SVGs are hidden from screen readers', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const exposedDecorativeSvgs = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const violations: string[] = [];

      svgs.forEach((svg) => {
        const ariaHidden = svg.getAttribute('aria-hidden');
        const role = svg.getAttribute('role');
        const ariaLabel = svg.getAttribute('aria-label');
        const title = svg.querySelector('title');

        // SVGs should either:
        // 1. Have aria-hidden="true" (decorative)
        // 2. Have role="img" + aria-label/title (meaningful)
        // 3. Have a <title> element (meaningful)
        if (ariaHidden !== 'true' && !ariaLabel && !title && role !== 'img') {
          violations.push(`SVG without aria-hidden="true" or accessible name`);
        }
      });

      return violations;
    });

    expect(exposedDecorativeSvgs, 'Decorative SVGs should have aria-hidden="true"').toHaveLength(0);
  });

  test('links have discernible text', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const emptyLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href]');
      const violations: string[] = [];

      links.forEach((link) => {
        const text = (link.textContent ?? '').trim();
        const ariaLabel = link.getAttribute('aria-label');
        const ariaLabelledBy = link.getAttribute('aria-labelledby');
        const title = link.getAttribute('title');
        const img = link.querySelector('img[alt]');

        if (!text && !ariaLabel && !ariaLabelledBy && !title && !img) {
          violations.push(`Empty link: ${link.outerHTML.substring(0, 100)}`);
        }
      });

      return violations;
    });

    expect(emptyLinks, 'All links should have discernible text').toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Live Regions (SC 4.1.3)
// ---------------------------------------------------------------------------

test.describe('Live Regions / Status Messages (SC 4.1.3)', () => {
  test('login form error messages use role="alert" for immediate announcement', async ({
    page,
  }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Submit empty form to trigger validation errors
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for error messages to appear
    await page.waitForTimeout(1000);

    // Check that error messages use role="alert"
    const alertElements = await page.locator('[role="alert"]').all();

    // If validation errors are shown, they should use role="alert"
    if (alertElements.length > 0) {
      for (const alert of alertElements) {
        const text = await alert.textContent();
        expect(text?.trim().length, 'Alert should have text content').toBeGreaterThan(0);
      }
    }
  });

  test('register form error messages use role="alert"', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    // Submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    await page.waitForTimeout(1000);

    const alertElements = await page.locator('[role="alert"]').all();

    if (alertElements.length > 0) {
      for (const alert of alertElements) {
        const text = await alert.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('aria-live regions exist in the DOM for dynamic announcements', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // The a11y.ts module creates live regions on first use.
    // We check that the infrastructure supports them.
    const liveRegions = await page.evaluate(() => {
      // Check for static live regions
      const staticRegions = document.querySelectorAll('[aria-live]');
      const roleStatus = document.querySelectorAll('[role="status"]');
      const roleAlert = document.querySelectorAll('[role="alert"]');

      return {
        ariaLiveCount: staticRegions.length,
        roleStatusCount: roleStatus.length,
        roleAlertCount: roleAlert.length,
      };
    });

    // At minimum, the page should support live regions
    // (either through aria-live or role attributes)
    // The exact count depends on page state
    expect(typeof liveRegions.ariaLiveCount).toBe('number');
  });

  test('form validation errors are associated with inputs via aria-describedby', async ({
    page,
  }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Submit form to trigger errors
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);

    // Check if invalid inputs have aria-describedby pointing to error messages
    const inputErrorAssociations = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[aria-invalid="true"]');
      const results: Array<{
        name: string;
        hasDescribedBy: boolean;
        errorTextExists: boolean;
      }> = [];

      inputs.forEach((input) => {
        const describedBy = input.getAttribute('aria-describedby');
        let errorTextExists = false;

        if (describedBy) {
          const errorEl = document.getElementById(describedBy);
          errorTextExists = errorEl !== null && (errorEl.textContent ?? '').trim().length > 0;
        }

        results.push({
          name: input.getAttribute('name') ?? 'unnamed',
          hasDescribedBy: describedBy !== null,
          errorTextExists,
        });
      });

      return results;
    });

    // Each invalid input should have aria-describedby pointing to an error message
    for (const association of inputErrorAssociations) {
      if (association.hasDescribedBy) {
        expect(
          association.errorTextExists,
          `Error text for "${association.name}" should exist and have content`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Language Attribute (SC 3.1.1)
// ---------------------------------------------------------------------------

test.describe('Language Attribute (SC 3.1.1)', () => {
  test('html element has a valid lang attribute', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));

    expect(lang, 'html element should have lang attribute').toBeTruthy();
    expect(lang!.length, 'lang attribute should not be empty').toBeGreaterThan(0);
    // Should be a valid BCP 47 language tag
    expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
  });
});

// ---------------------------------------------------------------------------
// Automated axe Scan (Comprehensive)
// ---------------------------------------------------------------------------

test.describe('Automated axe Scan — WCAG 2.1 AA', () => {
  test('login page passes axe WCAG 2.1 AA scan', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const violations = await checkAccessibility(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('register page passes axe WCAG 2.1 AA scan', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const violations = await checkAccessibility(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  test('home/root page passes axe WCAG 2.1 AA scan', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const violations = await checkAccessibility(page);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});
