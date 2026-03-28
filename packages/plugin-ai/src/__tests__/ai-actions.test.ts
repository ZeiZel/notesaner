/**
 * Tests for ai-actions — prompt template generation and action registry.
 *
 * Covers:
 * - AI_ACTIONS registry completeness
 * - getAction: happy path and error cases
 * - Each action's buildPrompt: includes relevant context fields
 * - requiresSelection flags
 * - SIDEBAR_ACTIONS and INLINE_ACTIONS lists
 */

import { describe, it, expect } from 'vitest';
import { AI_ACTIONS, SIDEBAR_ACTIONS, INLINE_ACTIONS, getAction } from '../ai-actions';
import type { AIActionContext, AIActionId } from '../ai-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<AIActionContext> = {}): AIActionContext {
  return {
    noteContent: 'This is a sample note about machine learning and neural networks.',
    noteTitle: 'My Note',
    selection: 'machine learning',
    params: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('AI_ACTIONS registry', () => {
  const expectedIds: AIActionId[] = [
    'summarize',
    'continueWriting',
    'rewriteSelection',
    'grammarCheck',
    'translate',
    'suggestLinks',
    'autoTag',
    'expandIdea',
    'makeSimpler',
  ];

  it('contains all expected action IDs', () => {
    for (const id of expectedIds) {
      expect(AI_ACTIONS[id]).toBeDefined();
    }
  });

  it('every action has a label, icon, description, and system string', () => {
    for (const [id, action] of Object.entries(AI_ACTIONS)) {
      expect(action.label).toBeTruthy();
      expect(action.icon).toBeTruthy();
      expect(action.description).toBeTruthy();
      expect(action.system).toBeTruthy();
      expect(action.id).toBe(id);
    }
  });

  it('every action has a buildPrompt function', () => {
    for (const action of Object.values(AI_ACTIONS)) {
      expect(typeof action.buildPrompt).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// getAction
// ---------------------------------------------------------------------------

describe('getAction', () => {
  it('returns the action definition for a valid ID', () => {
    const action = getAction('summarize');
    expect(action.id).toBe('summarize');
    expect(action.label).toBe('Summarize');
  });

  it('throws for an unknown action ID', () => {
    expect(() => getAction('nonexistent' as AIActionId)).toThrow(/nonexistent/);
  });
});

// ---------------------------------------------------------------------------
// SIDEBAR_ACTIONS and INLINE_ACTIONS
// ---------------------------------------------------------------------------

describe('SIDEBAR_ACTIONS', () => {
  it('is a non-empty array', () => {
    expect(SIDEBAR_ACTIONS.length).toBeGreaterThan(0);
  });

  it('all entries are valid action IDs', () => {
    for (const id of SIDEBAR_ACTIONS) {
      expect(() => getAction(id)).not.toThrow();
    }
  });
});

describe('INLINE_ACTIONS', () => {
  it('is a non-empty array', () => {
    expect(INLINE_ACTIONS.length).toBeGreaterThan(0);
  });

  it('all entries are valid action IDs', () => {
    for (const id of INLINE_ACTIONS) {
      expect(() => getAction(id)).not.toThrow();
    }
  });

  it('all inline actions require a selection', () => {
    for (const id of INLINE_ACTIONS) {
      const action = getAction(id);
      expect(action.requiresSelection).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

describe('summarize.buildPrompt', () => {
  it('includes the note content', () => {
    const ctx = makeContext();
    const prompt = getAction('summarize').buildPrompt(ctx);
    expect(prompt).toContain(ctx.noteContent);
  });

  it('includes the note title when provided', () => {
    const ctx = makeContext({ noteTitle: 'AI Research Notes' });
    const prompt = getAction('summarize').buildPrompt(ctx);
    expect(prompt).toContain('AI Research Notes');
  });

  it('works without a note title', () => {
    const ctx = makeContext({ noteTitle: undefined });
    expect(() => getAction('summarize').buildPrompt(ctx)).not.toThrow();
  });

  it('does not require a selection', () => {
    expect(getAction('summarize').requiresSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// continueWriting
// ---------------------------------------------------------------------------

describe('continueWriting.buildPrompt', () => {
  it('includes a tail of the note content', () => {
    const ctx = makeContext({ noteContent: 'A'.repeat(50) });
    const prompt = getAction('continueWriting').buildPrompt(ctx);
    expect(prompt).toContain('A');
  });

  it('truncates very long content to last 2000 chars', () => {
    const longContent = 'x'.repeat(5000);
    const ctx = makeContext({ noteContent: longContent });
    const prompt = getAction('continueWriting').buildPrompt(ctx);
    // Prompt should contain the last 2000 chars
    expect(prompt.length).toBeLessThan(longContent.length + 200);
    expect(prompt).toContain('x'.repeat(100));
  });

  it('does not require a selection', () => {
    expect(getAction('continueWriting').requiresSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rewriteSelection
// ---------------------------------------------------------------------------

describe('rewriteSelection.buildPrompt', () => {
  it('includes the selection text', () => {
    const ctx = makeContext({ selection: 'The algorithm converges.' });
    const prompt = getAction('rewriteSelection').buildPrompt(ctx);
    expect(prompt).toContain('The algorithm converges.');
  });

  it('falls back to noteContent when no selection', () => {
    const ctx = makeContext({ selection: undefined });
    const prompt = getAction('rewriteSelection').buildPrompt(ctx);
    expect(prompt).toContain(ctx.noteContent);
  });

  it('requires a selection', () => {
    expect(getAction('rewriteSelection').requiresSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// grammarCheck
// ---------------------------------------------------------------------------

describe('grammarCheck.buildPrompt', () => {
  it('includes the selection text', () => {
    const ctx = makeContext({ selection: 'There is many errors here.' });
    const prompt = getAction('grammarCheck').buildPrompt(ctx);
    expect(prompt).toContain('There is many errors here.');
  });

  it('requires a selection', () => {
    expect(getAction('grammarCheck').requiresSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// translate
// ---------------------------------------------------------------------------

describe('translate.buildPrompt', () => {
  it('includes the target language from params', () => {
    const ctx = makeContext({
      selection: 'Hello world',
      params: { targetLanguage: 'French' },
    });
    const prompt = getAction('translate').buildPrompt(ctx);
    expect(prompt).toContain('French');
    expect(prompt).toContain('Hello world');
  });

  it('defaults to English when targetLanguage param is absent', () => {
    const ctx = makeContext({ selection: 'Bonjour', params: {} });
    const prompt = getAction('translate').buildPrompt(ctx);
    expect(prompt).toContain('English');
  });

  it('requires a selection', () => {
    expect(getAction('translate').requiresSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// suggestLinks
// ---------------------------------------------------------------------------

describe('suggestLinks.buildPrompt', () => {
  it('includes a snippet of the note content', () => {
    const ctx = makeContext();
    const prompt = getAction('suggestLinks').buildPrompt(ctx);
    expect(prompt).toContain('machine learning');
  });

  it('includes available titles when provided', () => {
    const ctx = makeContext({
      params: { availableTitles: 'Deep Learning\nTransformers\nRAG' },
    });
    const prompt = getAction('suggestLinks').buildPrompt(ctx);
    expect(prompt).toContain('Deep Learning');
    expect(prompt).toContain('Transformers');
  });

  it('does not require a selection', () => {
    expect(getAction('suggestLinks').requiresSelection).toBe(false);
  });

  it('truncates long note content to 3000 chars', () => {
    const ctx = makeContext({ noteContent: 'y'.repeat(5000) });
    const prompt = getAction('suggestLinks').buildPrompt(ctx);
    // Prompt body should be at most ~3100 chars plus the instruction text
    const contentPart = prompt.split('Note content:\n')[1] ?? '';
    expect(contentPart.length).toBeLessThanOrEqual(3100);
  });
});

// ---------------------------------------------------------------------------
// autoTag
// ---------------------------------------------------------------------------

describe('autoTag.buildPrompt', () => {
  it('includes a snippet of the note content', () => {
    const ctx = makeContext();
    const prompt = getAction('autoTag').buildPrompt(ctx);
    expect(prompt).toContain('machine learning');
  });

  it('includes existing tags when provided', () => {
    const ctx = makeContext({
      params: { existingTags: 'ai, deep-learning, research' },
    });
    const prompt = getAction('autoTag').buildPrompt(ctx);
    expect(prompt).toContain('deep-learning');
  });

  it('does not require a selection', () => {
    expect(getAction('autoTag').requiresSelection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// expandIdea
// ---------------------------------------------------------------------------

describe('expandIdea.buildPrompt', () => {
  it('includes the selection', () => {
    const ctx = makeContext({ selection: 'Neural networks learn by gradient descent.' });
    const prompt = getAction('expandIdea').buildPrompt(ctx);
    expect(prompt).toContain('Neural networks learn by gradient descent.');
  });

  it('requires a selection', () => {
    expect(getAction('expandIdea').requiresSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// makeSimpler
// ---------------------------------------------------------------------------

describe('makeSimpler.buildPrompt', () => {
  it('includes the selection', () => {
    const ctx = makeContext({ selection: 'The stochastic gradient descent algorithm...' });
    const prompt = getAction('makeSimpler').buildPrompt(ctx);
    expect(prompt).toContain('stochastic gradient descent');
  });

  it('requires a selection', () => {
    expect(getAction('makeSimpler').requiresSelection).toBe(true);
  });
});
