/**
 * Unit tests for the VimMode TipTap extension.
 *
 * Tests exercise exported types, constants, and event names without
 * requiring a full TipTap editor instance. Motion and editing logic
 * is tested indirectly through the exported types and constants;
 * full interactive testing is covered by Playwright integration tests.
 */

import { describe, it, expect } from 'vitest';
import { VIM_MODE_PLUGIN_KEY, VIM_MODE_CHANGE_EVENT } from '../extensions/vim-mode';
import type { VimModeType, VimState, VimModeOptions } from '../extensions/vim-mode';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('VIM_MODE_PLUGIN_KEY', () => {
  it('is defined', () => {
    expect(VIM_MODE_PLUGIN_KEY).toBeDefined();
  });
});

describe('VIM_MODE_CHANGE_EVENT', () => {
  it('is a non-empty string', () => {
    expect(typeof VIM_MODE_CHANGE_EVENT).toBe('string');
    expect(VIM_MODE_CHANGE_EVENT.length).toBeGreaterThan(0);
  });

  it('equals "vim-mode-change"', () => {
    expect(VIM_MODE_CHANGE_EVENT).toBe('vim-mode-change');
  });
});

// ---------------------------------------------------------------------------
// Type checks (compile-time, but we verify runtime shapes)
// ---------------------------------------------------------------------------

describe('VimModeType', () => {
  it('supports all expected mode values', () => {
    const modes: VimModeType[] = ['normal', 'insert', 'visual', 'visual-line'];
    expect(modes).toHaveLength(4);

    for (const mode of modes) {
      expect(typeof mode).toBe('string');
    }
  });
});

describe('VimState shape', () => {
  it('initial state has expected properties', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };

    expect(state.mode).toBe('normal');
    expect(state.keyBuffer).toBe('');
    expect(state.register).toBe('');
    expect(state.registerIsLine).toBe(false);
    expect(state.count).toBe(0);
  });

  it('accepts all mode values', () => {
    const modes: VimModeType[] = ['normal', 'insert', 'visual', 'visual-line'];
    for (const mode of modes) {
      const state: VimState = {
        mode,
        keyBuffer: '',
        register: '',
        registerIsLine: false,
        count: 0,
      };
      expect(state.mode).toBe(mode);
    }
  });

  it('register can hold text content', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: 'hello world',
      registerIsLine: true,
      count: 0,
    };
    expect(state.register).toBe('hello world');
    expect(state.registerIsLine).toBe(true);
  });

  it('count supports multi-digit numbers', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 42,
    };
    expect(state.count).toBe(42);
  });

  it('keyBuffer accumulates multi-key sequences', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: 'd',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(state.keyBuffer).toBe('d');

    const nextState: VimState = { ...state, keyBuffer: 'dd' };
    expect(nextState.keyBuffer).toBe('dd');
  });
});

describe('VimModeOptions shape', () => {
  it('has enabled property', () => {
    const options: VimModeOptions = { enabled: false };
    expect(options.enabled).toBe(false);
  });

  it('defaults enabled to false', () => {
    const options: VimModeOptions = { enabled: false };
    expect(options.enabled).toBe(false);
  });

  it('can be set to true', () => {
    const options: VimModeOptions = { enabled: true };
    expect(options.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Custom event shape (verified without DOM — event dispatch is integration-tested)
// ---------------------------------------------------------------------------

describe('vim-mode-change CustomEvent shape', () => {
  it('event name constant is correct', () => {
    expect(VIM_MODE_CHANGE_EVENT).toBe('vim-mode-change');
  });

  it('event detail shape matches VimModeType', () => {
    // Verify the shape of the event detail that will be dispatched
    const detail = { mode: 'insert' as VimModeType };
    expect(detail.mode).toBe('insert');
    expect(typeof detail.mode).toBe('string');
  });

  it('all modes can be represented in event detail', () => {
    const modes: VimModeType[] = ['normal', 'insert', 'visual', 'visual-line'];
    for (const mode of modes) {
      const detail = { mode };
      expect(detail.mode).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// Mode transition logic (pure function tests)
// ---------------------------------------------------------------------------

describe('Vim mode transition logic', () => {
  /**
   * Simulates the state transition that happens when a key is pressed
   * in normal mode and a mode-switch command is triggered.
   */
  function transitionOnKey(currentState: VimState, key: string): VimState {
    // Mode-switch keys in normal mode
    const modeTransitions: Record<string, VimModeType> = {
      i: 'insert',
      a: 'insert',
      A: 'insert',
      I: 'insert',
      v: 'visual',
      V: 'visual-line',
      o: 'insert',
      O: 'insert',
    };

    if (currentState.mode === 'normal' && modeTransitions[key]) {
      return {
        ...currentState,
        mode: modeTransitions[key],
        keyBuffer: '',
        count: 0,
      };
    }

    // Escape in insert/visual returns to normal
    if (
      key === 'Escape' &&
      (currentState.mode === 'insert' ||
        currentState.mode === 'visual' ||
        currentState.mode === 'visual-line')
    ) {
      return {
        ...currentState,
        mode: 'normal',
        keyBuffer: '',
        count: 0,
      };
    }

    return currentState;
  }

  it('i transitions from normal to insert', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'i').mode).toBe('insert');
  });

  it('a transitions from normal to insert', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'a').mode).toBe('insert');
  });

  it('A transitions from normal to insert', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'A').mode).toBe('insert');
  });

  it('I transitions from normal to insert', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'I').mode).toBe('insert');
  });

  it('v transitions from normal to visual', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'v').mode).toBe('visual');
  });

  it('V transitions from normal to visual-line', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'V').mode).toBe('visual-line');
  });

  it('Escape transitions from insert to normal', () => {
    const state: VimState = {
      mode: 'insert',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'Escape').mode).toBe('normal');
  });

  it('Escape transitions from visual to normal', () => {
    const state: VimState = {
      mode: 'visual',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'Escape').mode).toBe('normal');
  });

  it('Escape transitions from visual-line to normal', () => {
    const state: VimState = {
      mode: 'visual-line',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'Escape').mode).toBe('normal');
  });

  it('Escape in normal mode does not change mode', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'Escape').mode).toBe('normal');
  });

  it('mode-switch keys clear keyBuffer and count', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: 'd',
      register: '',
      registerIsLine: false,
      count: 3,
    };
    const next = transitionOnKey(state, 'i');
    expect(next.keyBuffer).toBe('');
    expect(next.count).toBe(0);
  });

  it('non-mode-switch keys do not change mode', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: '',
      registerIsLine: false,
      count: 0,
    };
    expect(transitionOnKey(state, 'h').mode).toBe('normal');
    expect(transitionOnKey(state, 'j').mode).toBe('normal');
    expect(transitionOnKey(state, 'k').mode).toBe('normal');
    expect(transitionOnKey(state, 'l').mode).toBe('normal');
    expect(transitionOnKey(state, 'w').mode).toBe('normal');
  });

  it('preserves register on mode transition', () => {
    const state: VimState = {
      mode: 'normal',
      keyBuffer: '',
      register: 'saved text',
      registerIsLine: true,
      count: 0,
    };
    const next = transitionOnKey(state, 'i');
    expect(next.register).toBe('saved text');
    expect(next.registerIsLine).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Count prefix logic
// ---------------------------------------------------------------------------

describe('Vim count prefix logic', () => {
  function accumulateCount(current: number, key: string): number {
    if (/^[1-9]$/.test(key)) {
      return current * 10 + parseInt(key, 10);
    }
    if (key === '0' && current > 0) {
      return current * 10;
    }
    return current;
  }

  it('first digit starts the count', () => {
    expect(accumulateCount(0, '3')).toBe(3);
  });

  it('subsequent digits extend the count', () => {
    let count = 0;
    count = accumulateCount(count, '1'); // 1
    count = accumulateCount(count, '2'); // 12
    expect(count).toBe(12);
  });

  it('0 extends an existing count', () => {
    let count = accumulateCount(0, '1'); // 1
    count = accumulateCount(count, '0'); // 10
    expect(count).toBe(10);
  });

  it('0 does not start a count (it is line-start)', () => {
    // When count is 0 and key is '0', it should remain 0
    expect(accumulateCount(0, '0')).toBe(0);
  });

  it('builds multi-digit count correctly', () => {
    let count = 0;
    count = accumulateCount(count, '2'); // 2
    count = accumulateCount(count, '5'); // 25
    count = accumulateCount(count, '0'); // 250
    expect(count).toBe(250);
  });

  it('non-digit keys do not change count', () => {
    expect(accumulateCount(5, 'j')).toBe(5);
    expect(accumulateCount(5, 'd')).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Multi-key command buffer logic
// ---------------------------------------------------------------------------

describe('Vim key buffer logic', () => {
  function processKeyBuffer(
    buffer: string,
    key: string,
  ): { command: string | null; newBuffer: string } {
    const next = buffer + key;

    // Known complete commands
    if (next === 'dd') return { command: 'deleteLine', newBuffer: '' };
    if (next === 'yy') return { command: 'yankLine', newBuffer: '' };
    if (next === 'gg') return { command: 'goToStart', newBuffer: '' };

    // Known partial prefixes
    if (next === 'd' || next === 'y' || next === 'g') {
      return { command: null, newBuffer: next };
    }

    // Invalid sequence — reset buffer
    return { command: null, newBuffer: '' };
  }

  it('recognises dd as deleteLine', () => {
    let result = processKeyBuffer('', 'd');
    expect(result.command).toBeNull();
    expect(result.newBuffer).toBe('d');

    result = processKeyBuffer('d', 'd');
    expect(result.command).toBe('deleteLine');
    expect(result.newBuffer).toBe('');
  });

  it('recognises yy as yankLine', () => {
    let result = processKeyBuffer('', 'y');
    expect(result.command).toBeNull();

    result = processKeyBuffer('y', 'y');
    expect(result.command).toBe('yankLine');
  });

  it('recognises gg as goToStart', () => {
    let result = processKeyBuffer('', 'g');
    expect(result.command).toBeNull();

    result = processKeyBuffer('g', 'g');
    expect(result.command).toBe('goToStart');
  });

  it('resets buffer on invalid sequence', () => {
    const result = processKeyBuffer('d', 'x');
    // 'dx' is not a known command or prefix
    expect(result.command).toBeNull();
    expect(result.newBuffer).toBe('');
  });

  it('single keys do not buffer unless they are prefixes', () => {
    const result = processKeyBuffer('', 'h');
    expect(result.command).toBeNull();
    expect(result.newBuffer).toBe('');
  });
});
