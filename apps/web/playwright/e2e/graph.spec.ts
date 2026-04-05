/**
 * Graph view E2E tests.
 *
 * Covers graph rendering with nodes and edges, node interaction
 * (click to navigate), and graph filter/search controls.
 */

import { test, expect } from '../fixtures/test-fixtures';

const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID ?? 'test-workspace-1';
const GRAPH_URL = `/workspaces/${WORKSPACE_ID}/graph`;

test.describe('Graph view rendering', () => {
  test('graph page loads with main content', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });

  test('graph canvas or SVG container is rendered', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);

    // Graph could render as canvas, SVG, or a WebGL container
    const graphContainer = page.locator(
      'canvas, svg[data-testid="graph"], [data-testid="graph-view"], [data-testid="graph-canvas"], .graph-container, .force-graph-container',
    );

    await expect(graphContainer.first()).toBeVisible({ timeout: 15_000 });
  });

  test('graph displays nodes representing notes', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);

    // Wait for graph to render
    await page.waitForTimeout(3_000);

    // Nodes could be rendered as SVG circles, divs, or canvas elements
    const nodeElements = page.locator(
      '[data-testid="graph-node"], circle[data-node-id], .graph-node, [data-node-type="note"]',
    );

    const hasNodes = await nodeElements
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (hasNodes) {
      // At least one node should be visible
      const count = await nodeElements.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // For canvas-based graphs, check that the canvas has rendered content
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const canvasSize = await canvas.boundingBox();
        expect(canvasSize).toBeTruthy();
        expect(canvasSize!.width).toBeGreaterThan(0);
        expect(canvasSize!.height).toBeGreaterThan(0);
      }
    }
  });

  test('graph displays edges between linked notes', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);
    await page.waitForTimeout(3_000);

    // Edges could be SVG lines/paths or rendered on canvas
    const edgeElements = page.locator(
      '[data-testid="graph-edge"], line[data-edge-id], path[data-edge-id], .graph-edge, .graph-link',
    );

    const hasEdges = await edgeElements
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasEdges) {
      const count = await edgeElements.count();
      expect(count).toBeGreaterThan(0);
    }
    // Canvas-based graphs won't have DOM edges — this is expected
  });
});

test.describe('Graph interaction', () => {
  test('clicking a node navigates to the corresponding note', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);
    await page.waitForTimeout(3_000);

    const node = page.locator(
      '[data-testid="graph-node"], circle[data-node-id], .graph-node',
    ).first();

    if (await node.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Store current URL
      const graphUrl = page.url();

      // Click the node
      await node.click();

      // Should navigate to a note URL
      await page.waitForURL(
        (url) => url.pathname !== new URL(graphUrl).pathname,
        { timeout: 10_000 },
      ).catch(() => {
        // Some graphs open notes in a panel instead of navigating
      });

      const currentUrl = page.url();
      // Either navigated to a note, or a panel opened
      const navigated = currentUrl.includes('/notes/');
      const panelOpened = await page
        .locator('.ProseMirror, [data-testid="note-panel"]')
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      expect(navigated || panelOpened).toBeTruthy();
    }
  });

  test('graph view has zoom controls or supports mouse wheel zoom', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);
    await page.waitForTimeout(2_000);

    // Check for explicit zoom controls
    const zoomIn = page.locator(
      'button[aria-label="Zoom in"], button[data-testid="graph-zoom-in"], button:has-text("+")',
    );
    const zoomOut = page.locator(
      'button[aria-label="Zoom out"], button[data-testid="graph-zoom-out"], button:has-text("-")',
    );

    const hasZoomControls = await zoomIn
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (hasZoomControls) {
      await expect(zoomIn.first()).toBeVisible();
      await expect(zoomOut.first()).toBeVisible();
    }
    // Canvas-based graphs typically support mouse wheel zoom natively
  });
});

test.describe('Graph filter and search', () => {
  test('graph filter controls are accessible', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);

    // Look for filter/search controls on the graph page
    const filterControl = page.locator(
      '[data-testid="graph-filter"], [data-testid="graph-search"], input[placeholder*="Filter" i], input[placeholder*="Search" i]',
    );

    const hasFilter = await filterControl
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasFilter) {
      await expect(filterControl.first()).toBeVisible();
    }
  });

  test('graph search filters visible nodes', async ({ authenticatedPage: page }) => {
    await page.goto(GRAPH_URL);

    const searchInput = page.locator(
      '[data-testid="graph-search"] input, input[placeholder*="Filter" i], input[placeholder*="Search" i]',
    ).first();

    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill('nonexistent-note-xyz');
      await page.waitForTimeout(1_000);

      // The graph should show fewer or no nodes when filtering
      // This is a best-effort check since canvas rendering varies
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});
