import { describe, it, expect } from 'vitest';
import { getComponentRegistry, getComponentMeta, COMPONENT_SDK_VERSION } from '../registry';

const EXPECTED_IDS = [
  'NoteCard',
  'FileTreeItem',
  'StatusBarItem',
  'SidebarPanel',
  'ToolbarButton',
  'CalloutBlock',
  'CodeBlock',
  'SearchResultItem',
] as const;

describe('component registry', () => {
  it('exports the expected SDK version', () => {
    expect(COMPONENT_SDK_VERSION).toBe('1.0.0');
  });

  it('returns 8 overridable components', () => {
    const registry = getComponentRegistry();
    expect(registry).toHaveLength(8);
  });

  it('includes all expected component IDs', () => {
    const ids = getComponentRegistry().map((c) => c.id);
    for (const id of EXPECTED_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('every component has a non-empty starterTemplate', () => {
    for (const meta of getComponentRegistry()) {
      expect(meta.starterTemplate.length).toBeGreaterThan(50);
    }
  });

  it('every component has at least one required prop', () => {
    for (const meta of getComponentRegistry()) {
      const hasRequired = meta.props.some((p) => p.required);
      expect(hasRequired).toBe(true);
    }
  });

  describe('getComponentMeta', () => {
    it('returns meta for a known component', () => {
      const meta = getComponentMeta('NoteCard');
      expect(meta).toBeDefined();
      expect(meta?.displayName).toBe('Note Card');
    });

    it('returns undefined for an unknown component', () => {
      const meta = getComponentMeta('Unknown' as Parameters<typeof getComponentMeta>[0]);
      expect(meta).toBeUndefined();
    });
  });
});
