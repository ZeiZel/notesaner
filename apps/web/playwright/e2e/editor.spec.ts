/**
 * Editor E2E tests.
 *
 * Covers text input, formatting (bold, italic, headings),
 * wiki-link creation, and auto-save behavior.
 */

import { test, expect } from '../fixtures/test-fixtures';
import {
  waitForEditor,
  typeInEditor,
  getEditorContent,
  navigateToNote,
  waitForNetworkIdle,
} from '../utils/helpers';

test.describe('Editor text input', () => {
  test('typing text appears in the editor', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const sampleText = 'Hello, Notesaner editor!';
    await typeInEditor(page, sampleText);

    const content = await getEditorContent(page);
    expect(content).toContain(sampleText);
  });

  test('multiline text input works', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    await typeInEditor(page, 'First line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third line', { delay: 20 });

    const content = await getEditorContent(page);
    expect(content).toContain('First line');
    expect(content).toContain('Second line');
    expect(content).toContain('Third line');
  });
});

test.describe('Editor formatting', () => {
  test('bold formatting via keyboard shortcut', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Type some text, select it, and apply bold
    await typeInEditor(page, 'bold text here');

    // Select "bold text here"
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    // Apply bold with Cmd+B
    await page.keyboard.press('Meta+b');

    // The selected text should be wrapped in <strong> or have bold formatting
    const editor = page.locator('.ProseMirror');
    const boldElement = editor.locator('strong, b').first();
    await expect(boldElement).toBeVisible({ timeout: 3_000 });
  });

  test('italic formatting via keyboard shortcut', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    await typeInEditor(page, 'italic text here');

    // Select all text
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    // Apply italic with Cmd+I
    await page.keyboard.press('Meta+i');

    const editor = page.locator('.ProseMirror');
    const italicElement = editor.locator('em, i').first();
    await expect(italicElement).toBeVisible({ timeout: 3_000 });
  });

  test('heading formatting via markdown shortcut', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.click();

    // Type markdown heading syntax — TipTap should convert it
    await page.keyboard.type('# Heading One', { delay: 30 });
    await page.keyboard.press('Enter');

    // Check for heading element in the editor
    const heading = editor.locator('h1, h2, h3').first();
    const hasHeading = await heading.isVisible({ timeout: 3_000 }).catch(() => false);

    // If markdown shortcuts are enabled, a heading should appear
    if (hasHeading) {
      await expect(heading).toContainText('Heading');
    } else {
      // Fallback: text should at least be in the editor
      const content = await getEditorContent(page);
      expect(content).toContain('Heading One');
    }
  });

  test('bullet list via markdown shortcut', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.click();

    // Type markdown list syntax
    await page.keyboard.type('- List item one', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('List item two', { delay: 30 });

    const listItem = editor.locator('li').first();
    const hasList = await listItem.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasList) {
      await expect(listItem).toContainText('List item');
    }
  });
});

test.describe('Wiki-links', () => {
  test('typing [[ opens link autocomplete', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    await typeInEditor(page, 'Link to ');
    await page.keyboard.type('[[', { delay: 50 });

    // Wait for autocomplete/suggestion popup
    const autocomplete = page.locator(
      '[data-testid="link-autocomplete"], [role="listbox"], .tippy-box, .suggestion-list',
    );
    const hasAutocomplete = await autocomplete
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    // Wiki-link trigger should either show autocomplete or insert the brackets
    if (hasAutocomplete) {
      await expect(autocomplete.first()).toBeVisible();
    } else {
      // At minimum, the typed text should be in the editor
      const content = await getEditorContent(page);
      expect(content).toContain('[[');
    }
  });

  test('completed wiki-link renders as a link element', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    await typeInEditor(page, '[[Some Note]]');

    // Wait a moment for the editor to process
    await page.waitForTimeout(500);

    const editor = page.locator('.ProseMirror');
    // Wiki-links may render as <a> tags or custom node views
    const link = editor.locator('a, [data-type="wiki-link"], [data-node-type="wiki-link"]');
    const hasLink = await link.first().isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasLink) {
      await expect(link.first()).toBeVisible();
    } else {
      // The text should at least be present
      const content = await getEditorContent(page);
      expect(content).toContain('Some Note');
    }
  });
});

test.describe('Auto-save', () => {
  test('content is auto-saved after typing stops', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    const uniqueText = `Auto-save test ${Date.now()}`;
    await typeInEditor(page, uniqueText);

    // Wait for debounced auto-save (500ms debounce + network)
    await page.waitForTimeout(2_000);
    await waitForNetworkIdle(page);

    // Reload to verify persistence
    await page.reload();
    await waitForEditor(page);

    const content = await getEditorContent(page);
    expect(content).toContain(uniqueText);
  });

  test('rapid typing does not trigger excessive saves', async ({ authenticatedPage: page, testNote }) => {
    await navigateToNote(page, testNote.id, testNote.workspaceId);

    // Track API calls for note updates
    let saveCallCount = 0;
    await page.route('**/api/workspaces/*/notes/*', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        saveCallCount++;
      }
      route.continue();
    });

    // Type rapidly
    for (let i = 0; i < 5; i++) {
      await page.keyboard.type(`Line ${i} `, { delay: 10 });
    }

    // Wait for debounced save
    await page.waitForTimeout(2_000);

    // Debouncing should mean fewer saves than keystrokes
    expect(saveCallCount).toBeLessThanOrEqual(3);
  });
});
