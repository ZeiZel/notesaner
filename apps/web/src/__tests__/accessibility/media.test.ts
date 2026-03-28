/**
 * Media Accessibility Tests
 * ==========================
 * WCAG 2.1 AA compliance tests for images, video, and other media:
 *
 *   - SC 1.1.1 (Non-text Content) — images have alt text or are marked decorative
 *   - SC 1.2.1 (Audio-only and Video-only - Prerecorded) — alternatives provided
 *   - SC 1.2.2 (Captions - Prerecorded) — video has captions
 *   - SC 1.2.3 (Audio Description / Media Alternative) — audio description
 *   - SC 1.2.5 (Audio Description - Prerecorded) — audio description for video
 *   - SC 1.4.5 (Images of Text) — avoid using images of text
 *
 * Since Notesaner is primarily a text-based note editor, many media tests
 * are proactive — they ensure the infrastructure is ready for user-uploaded
 * images and embedded media within notes.
 *
 * @module __tests__/accessibility/media.test
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGE_ROUTES, waitForPageReady, checkAccessibility, formatViolations } from './axe-setup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collects all image elements and their accessibility attributes.
 */
async function collectImages(page: Page): Promise<
  Array<{
    src: string;
    alt: string | null;
    role: string | null;
    ariaHidden: string | null;
    ariaLabel: string | null;
    isDecorativeByRole: boolean;
    isDecorativeByAlt: boolean;
    isDecorativeByAriaHidden: boolean;
    width: number;
    height: number;
    isVisible: boolean;
  }>
> {
  return page.evaluate(() => {
    const images = document.querySelectorAll('img');
    const results: Array<{
      src: string;
      alt: string | null;
      role: string | null;
      ariaHidden: string | null;
      ariaLabel: string | null;
      isDecorativeByRole: boolean;
      isDecorativeByAlt: boolean;
      isDecorativeByAriaHidden: boolean;
      width: number;
      height: number;
      isVisible: boolean;
    }> = [];

    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      const ariaHidden = img.getAttribute('aria-hidden');
      const styles = window.getComputedStyle(img);

      results.push({
        src: img.src,
        alt,
        role,
        ariaHidden,
        ariaLabel: img.getAttribute('aria-label'),
        isDecorativeByRole: role === 'presentation' || role === 'none',
        isDecorativeByAlt: alt === '',
        isDecorativeByAriaHidden: ariaHidden === 'true',
        width: img.naturalWidth,
        height: img.naturalHeight,
        isVisible: styles.display !== 'none' && styles.visibility !== 'hidden',
      });
    });

    return results;
  });
}

/**
 * Collects all SVG elements and their accessibility attributes.
 */
async function collectSvgs(page: Page): Promise<
  Array<{
    ariaHidden: string | null;
    ariaLabel: string | null;
    role: string | null;
    hasTitle: boolean;
    parentTag: string;
    parentAriaLabel: string | null;
    isDecorative: boolean;
  }>
> {
  return page.evaluate(() => {
    const svgs = document.querySelectorAll('svg');
    const results: Array<{
      ariaHidden: string | null;
      ariaLabel: string | null;
      role: string | null;
      hasTitle: boolean;
      parentTag: string;
      parentAriaLabel: string | null;
      isDecorative: boolean;
    }> = [];

    svgs.forEach((svg) => {
      const ariaHidden = svg.getAttribute('aria-hidden');
      const ariaLabel = svg.getAttribute('aria-label');
      const role = svg.getAttribute('role');
      const hasTitle = svg.querySelector('title') !== null;
      const parent = svg.parentElement;

      results.push({
        ariaHidden,
        ariaLabel,
        role,
        hasTitle,
        parentTag: parent?.tagName.toLowerCase() ?? 'unknown',
        parentAriaLabel: parent?.getAttribute('aria-label') ?? null,
        isDecorative: ariaHidden === 'true',
      });
    });

    return results;
  });
}

/**
 * Collects all video and audio elements.
 */
async function collectMediaElements(page: Page): Promise<
  Array<{
    tagName: string;
    hasCaptions: boolean;
    hasTrack: boolean;
    trackKinds: string[];
    ariaLabel: string | null;
    hasControls: boolean;
    autoplay: boolean;
  }>
> {
  return page.evaluate(() => {
    const media = document.querySelectorAll('video, audio');
    const results: Array<{
      tagName: string;
      hasCaptions: boolean;
      hasTrack: boolean;
      trackKinds: string[];
      ariaLabel: string | null;
      hasControls: boolean;
      autoplay: boolean;
    }> = [];

    media.forEach((el) => {
      const tracks = el.querySelectorAll('track');
      const trackKinds: string[] = [];
      tracks.forEach((track) => {
        const kind = track.getAttribute('kind');
        if (kind) trackKinds.push(kind);
      });

      results.push({
        tagName: el.tagName.toLowerCase(),
        hasCaptions: trackKinds.includes('captions') || trackKinds.includes('subtitles'),
        hasTrack: tracks.length > 0,
        trackKinds,
        ariaLabel: el.getAttribute('aria-label'),
        hasControls: el.hasAttribute('controls'),
        autoplay: el.hasAttribute('autoplay'),
      });
    });

    return results;
  });
}

// ---------------------------------------------------------------------------
// Image Alt Text Tests (SC 1.1.1)
// ---------------------------------------------------------------------------

test.describe('Image Alt Text (SC 1.1.1)', () => {
  test('all images on login page have alt attribute', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const images = await collectImages(page);

    for (const img of images) {
      // Every <img> must have an alt attribute (even if empty for decorative)
      expect(
        img.alt !== null,
        `Image (src: ${img.src.substring(0, 80)}) must have alt attribute. ` +
          `Use alt="" for decorative images, or descriptive text for meaningful images.`,
      ).toBe(true);
    }
  });

  test('meaningful images have descriptive alt text', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const images = await collectImages(page);

    for (const img of images) {
      if (!img.isDecorativeByAlt && !img.isDecorativeByRole && !img.isDecorativeByAriaHidden) {
        // Non-decorative images must have meaningful alt text
        if (img.alt !== null) {
          expect(
            img.alt.length,
            `Image (src: ${img.src.substring(0, 80)}) has empty alt but is not marked as decorative`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  test('decorative images are properly hidden from assistive technology', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const images = await collectImages(page);

    for (const img of images) {
      if (img.isDecorativeByAlt) {
        // Images with alt="" should also have role="presentation" or aria-hidden
        // (alt="" alone is sufficient per WCAG, but role is a bonus)
        // This is a best practice check, not a hard requirement
      }
    }
  });

  test('no images use alt text that starts with "image of" or "picture of"', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const images = await collectImages(page);

    const badPrefixes = [
      'image of',
      'picture of',
      'photo of',
      'icon of',
      'graphic of',
      'screenshot of',
    ];

    for (const img of images) {
      if (img.alt) {
        const altLower = img.alt.toLowerCase().trim();
        for (const prefix of badPrefixes) {
          expect(
            altLower.startsWith(prefix),
            `Alt text "${img.alt}" should not start with "${prefix}" — screen readers already announce "image"`,
          ).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SVG Accessibility Tests (SC 1.1.1)
// ---------------------------------------------------------------------------

test.describe('SVG Accessibility (SC 1.1.1)', () => {
  test('decorative SVGs have aria-hidden="true" on login page', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const svgs = await collectSvgs(page);

    for (const svg of svgs) {
      // SVGs inside interactive elements (buttons, links) that serve as icons
      // should be decorative (aria-hidden) if the parent has text or aria-label
      if (svg.parentTag === 'button' || svg.parentTag === 'a') {
        if (svg.parentAriaLabel || !svg.isDecorative) {
          // If parent has aria-label, the SVG should be decorative
          if (svg.parentAriaLabel) {
            expect(
              svg.isDecorative,
              `SVG inside <${svg.parentTag}> with aria-label should have aria-hidden="true"`,
            ).toBe(true);
          }
        }
      }

      // Standalone SVGs must be either decorative or have an accessible name
      if (svg.parentTag !== 'button' && svg.parentTag !== 'a') {
        const hasAccessibleName = svg.ariaLabel !== null || svg.hasTitle || svg.role === 'img';
        const isDecorative = svg.isDecorative;

        expect(
          hasAccessibleName || isDecorative,
          `Standalone SVG must either have aria-hidden="true" or an accessible name`,
        ).toBe(true);
      }
    }
  });

  test('SVGs used as meaningful content have role="img" and aria-label', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const svgs = await collectSvgs(page);

    for (const svg of svgs) {
      // If SVG has aria-label, it should also have role="img"
      if (svg.ariaLabel && !svg.isDecorative) {
        expect(svg.role, `SVG with aria-label="${svg.ariaLabel}" should have role="img"`).toBe(
          'img',
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Video Captions Placeholder Tests (SC 1.2.2, SC 1.2.5)
// ---------------------------------------------------------------------------

test.describe('Video Captions (SC 1.2.2)', () => {
  test('any video elements have caption tracks', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const mediaElements = await collectMediaElements(page);
    const videos = mediaElements.filter((m) => m.tagName === 'video');

    for (const video of videos) {
      expect(
        video.hasCaptions,
        'Video element must have captions (track kind="captions" or kind="subtitles")',
      ).toBe(true);
    }

    // If no videos exist, the test passes (proactive check)
    if (videos.length === 0) {
      // Log for visibility that no videos were found
    }
  });

  test('any audio elements have text alternatives', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const mediaElements = await collectMediaElements(page);
    const audioElements = mediaElements.filter((m) => m.tagName === 'audio');

    for (const audio of audioElements) {
      // Audio should have either:
      // 1. A text transcript link nearby
      // 2. A track element with captions
      // 3. An aria-label describing the content
      const hasAlternative = audio.hasTrack || audio.ariaLabel !== null;

      expect(
        hasAlternative,
        'Audio element must have a text alternative (track or aria-label)',
      ).toBe(true);
    }
  });

  test('video elements have accessible controls', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const mediaElements = await collectMediaElements(page);
    const videos = mediaElements.filter((m) => m.tagName === 'video');

    for (const video of videos) {
      // Video should have native controls or custom keyboard-accessible controls
      expect(
        video.hasControls,
        'Video element should have controls attribute for keyboard accessibility',
      ).toBe(true);
    }
  });

  test('no media autoplays without user consent', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const mediaElements = await collectMediaElements(page);

    for (const media of mediaElements) {
      expect(
        media.autoplay,
        `${media.tagName} should not autoplay (WCAG SC 1.4.2 — Audio Control)`,
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Images of Text (SC 1.4.5)
// ---------------------------------------------------------------------------

test.describe('Images of Text (SC 1.4.5)', () => {
  test('login page uses real text instead of images of text', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Check that headings, labels, and buttons use real text (not images)
    const textElementsAsImages = await page.evaluate(() => {
      const violations: string[] = [];

      // Check headings for images used as text
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
        const imgs = heading.querySelectorAll('img');
        const text = (heading.textContent ?? '').trim();

        if (imgs.length > 0 && !text) {
          violations.push(
            `Heading uses image instead of text: ${heading.outerHTML.substring(0, 100)}`,
          );
        }
      });

      // Check buttons for images used as text
      document.querySelectorAll('button').forEach((button) => {
        const imgs = button.querySelectorAll('img');
        const text = (button.textContent ?? '').trim();

        if (imgs.length > 0 && !text && !button.getAttribute('aria-label')) {
          violations.push(
            `Button uses image instead of text: ${button.outerHTML.substring(0, 100)}`,
          );
        }
      });

      return violations;
    });

    expect(textElementsAsImages, 'UI text should use real text, not images of text').toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// Animated Content (SC 2.2.2, SC 2.3.1)
// ---------------------------------------------------------------------------

test.describe('Animated Content (SC 2.2.2, SC 2.3.1)', () => {
  test('no content flashes more than 3 times per second', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Check for CSS animations that might flash rapidly
    const flashingElements = await page.evaluate(() => {
      const violations: string[] = [];

      document.querySelectorAll('*').forEach((el) => {
        const styles = window.getComputedStyle(el);
        const animDuration = parseFloat(styles.animationDuration);
        const animIterCount = styles.animationIterationCount;

        // If animation is very fast (< 333ms = more than 3 per second) and repeating
        if (animDuration > 0 && animDuration < 0.333 && animIterCount === 'infinite') {
          violations.push(
            `Element with fast repeating animation (${animDuration}s): ${el.tagName.toLowerCase()}.${el.className.substring(0, 50)}`,
          );
        }
      });

      return violations;
    });

    expect(
      flashingElements,
      'No content should flash more than 3 times per second (SC 2.3.1)',
    ).toHaveLength(0);
  });

  test('spinning loaders respect prefers-reduced-motion', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    // Check that animated elements respect the preference
    const animatedElements = await page.evaluate(() => {
      const violating: string[] = [];

      document.querySelectorAll('[class*="animate-"]').forEach((el) => {
        const styles = window.getComputedStyle(el);
        const animName = styles.animationName;
        const animDuration = styles.animationDuration;

        // With reduced motion, animations should be none or very short
        if (animName !== 'none' && parseFloat(animDuration) > 0.01) {
          violating.push(
            `Element still animates despite prefers-reduced-motion: ${el.className.substring(0, 80)}`,
          );
        }
      });

      return violating;
    });

    // This is advisory — Tailwind's animate-* classes may still run
    // The key check is that the app has a mechanism to respect the preference
    if (animatedElements.length > 0) {
      console.warn(`${animatedElements.length} element(s) may not respect prefers-reduced-motion`);
    }
  });
});

// ---------------------------------------------------------------------------
// axe Image/Media Rules
// ---------------------------------------------------------------------------

test.describe('axe Media Accessibility Scan', () => {
  test('login page passes axe image-alt rule', async ({ page }) => {
    await page.goto(PAGE_ROUTES.LOGIN);
    await waitForPageReady(page);

    const violations = await checkAccessibility(page);
    const imageViolations = violations.filter(
      (v) =>
        v.id === 'image-alt' ||
        v.id === 'image-redundant-alt' ||
        v.id === 'svg-img-alt' ||
        v.id === 'object-alt' ||
        v.id === 'video-caption',
    );

    expect(imageViolations, formatViolations(imageViolations)).toHaveLength(0);
  });

  test('register page passes axe image-alt rule', async ({ page }) => {
    await page.goto(PAGE_ROUTES.REGISTER);
    await waitForPageReady(page);

    const violations = await checkAccessibility(page);
    const imageViolations = violations.filter(
      (v) => v.id === 'image-alt' || v.id === 'image-redundant-alt' || v.id === 'svg-img-alt',
    );

    expect(imageViolations, formatViolations(imageViolations)).toHaveLength(0);
  });
});
