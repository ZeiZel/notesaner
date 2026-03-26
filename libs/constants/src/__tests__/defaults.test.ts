import { describe, it, expect } from 'vitest';
import {
  SYNC_DEBOUNCE_MS,
  VERSION_SNAPSHOT_INTERVAL_MS,
  MAX_NOTE_SIZE_BYTES,
  MAX_ATTACHMENT_SIZE_BYTES,
  SEARCH_RESULTS_LIMIT,
  GRAPH_MAX_NODES,
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
  PLUGIN_REGISTRY_TAG,
  NOTE_FILE_EXTENSION,
  FRONTMATTER_DELIMITER,
  WIKI_LINK_REGEX,
  EMBED_REGEX,
  BLOCK_REF_REGEX,
  HEADING_LINK_REGEX,
} from '../defaults';

// ── Scalar constants ──────────────────────────────────────────────────────────

describe('scalar constants', () => {
  it('SYNC_DEBOUNCE_MS is 500', () => {
    expect(SYNC_DEBOUNCE_MS).toBe(500);
  });

  it('VERSION_SNAPSHOT_INTERVAL_MS is 5 minutes in milliseconds', () => {
    expect(VERSION_SNAPSHOT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('MAX_NOTE_SIZE_BYTES is 10 MB', () => {
    expect(MAX_NOTE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('MAX_ATTACHMENT_SIZE_BYTES is 50 MB', () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('SEARCH_RESULTS_LIMIT is 50', () => {
    expect(SEARCH_RESULTS_LIMIT).toBe(50);
  });

  it('GRAPH_MAX_NODES is 5000', () => {
    expect(GRAPH_MAX_NODES).toBe(5000);
  });

  it('JWT_ACCESS_TOKEN_TTL is "15m"', () => {
    expect(JWT_ACCESS_TOKEN_TTL).toBe('15m');
  });

  it('JWT_REFRESH_TOKEN_TTL is "7d"', () => {
    expect(JWT_REFRESH_TOKEN_TTL).toBe('7d');
  });

  it('PLUGIN_REGISTRY_TAG is "notesaner-plugin"', () => {
    expect(PLUGIN_REGISTRY_TAG).toBe('notesaner-plugin');
  });

  it('NOTE_FILE_EXTENSION is ".md"', () => {
    expect(NOTE_FILE_EXTENSION).toBe('.md');
  });

  it('FRONTMATTER_DELIMITER is "---"', () => {
    expect(FRONTMATTER_DELIMITER).toBe('---');
  });
});

// ── Regex patterns ────────────────────────────────────────────────────────────
// Tests validate that each regex matches the expected input strings and
// correctly rejects non-matching ones. The `g` flag on the originals means
// we must reset lastIndex between calls or use a fresh copy.

describe('WIKI_LINK_REGEX', () => {
  const re = () => new RegExp(WIKI_LINK_REGEX.source, 'g');

  it('matches a plain wiki link', () => {
    const m = '[[My Note]]'.match(re());
    expect(m).not.toBeNull();
    expect(m![0]).toBe('[[My Note]]');
  });

  it('captures the target in group 1', () => {
    const m = re().exec('[[Target Note]]');
    expect(m![1]).toBe('Target Note');
  });

  it('captures an optional display alias in group 2', () => {
    const m = re().exec('[[Target|Alias]]');
    expect(m![1]).toBe('Target');
    expect(m![2]).toBe('Alias');
  });

  it('does not match a plain markdown link', () => {
    expect('[text](url)'.match(re())).toBeNull();
  });
});

describe('EMBED_REGEX', () => {
  const re = () => new RegExp(EMBED_REGEX.source, 'g');

  it('matches an embed link', () => {
    expect('![[image.png]]'.match(re())).not.toBeNull();
  });

  it('captures the embed target in group 1', () => {
    const m = re().exec('![[diagram.svg]]');
    expect(m![1]).toBe('diagram.svg');
  });

  it('does not match a non-embed wiki link', () => {
    expect('[[Note]]'.match(re())).toBeNull();
  });
});

describe('BLOCK_REF_REGEX', () => {
  const re = () => new RegExp(BLOCK_REF_REGEX.source, 'g');

  it('matches a block reference', () => {
    expect('[[SomeNote#^abc123]]'.match(re())).not.toBeNull();
  });

  it('captures the note name in group 1 and block id in group 2', () => {
    const m = re().exec('[[SomeNote#^block-id]]');
    expect(m![1]).toBe('SomeNote');
    expect(m![2]).toBe('block-id');
  });

  it('does not match a plain wiki link', () => {
    expect('[[SomeNote]]'.match(re())).toBeNull();
  });

  it('does not match a heading link (no ^ prefix)', () => {
    expect('[[SomeNote#Heading]]'.match(re())).toBeNull();
  });
});

describe('HEADING_LINK_REGEX', () => {
  const re = () => new RegExp(HEADING_LINK_REGEX.source, 'g');

  it('matches a heading link', () => {
    expect('[[SomeNote#Introduction]]'.match(re())).not.toBeNull();
  });

  it('captures note name in group 1 and heading in group 2', () => {
    const m = re().exec('[[SomeNote#Introduction]]');
    expect(m![1]).toBe('SomeNote');
    expect(m![2]).toBe('Introduction');
  });

  it('captures an optional display alias in group 3', () => {
    const m = re().exec('[[SomeNote#Introduction|Intro]]');
    expect(m![3]).toBe('Intro');
  });

  it('does not match a plain wiki link', () => {
    expect('[[SomeNote]]'.match(re())).toBeNull();
  });
});
