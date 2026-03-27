import { describe, it, expect } from 'vitest';
import { MarkdownExtractor } from '../processors/markdown-extractor';

describe('MarkdownExtractor', () => {
  describe('extract', () => {
    it('returns empty strings for empty input', () => {
      const result = MarkdownExtractor.extract('');
      expect(result.headingsText).toBe('');
      expect(result.bodyText).toBe('');
      expect(result.frontmatter).toEqual({});
    });

    it('extracts heading text from ATX headings', () => {
      const md = `# Main Title\n\n## Section One\n\n### Sub Section\n\nSome body text here.`;
      const { headingsText, bodyText } = MarkdownExtractor.extract(md);

      expect(headingsText).toContain('Main Title');
      expect(headingsText).toContain('Section One');
      expect(headingsText).toContain('Sub Section');
      expect(bodyText).toContain('Some body text here');
      // Headings should not appear in body
      expect(bodyText).not.toContain('Main Title');
    });

    it('strips frontmatter from body and headings', () => {
      const md = `---
title: My Note
tags: [typescript, testing]
---

# Actual Heading

Body content.`;
      const { headingsText, bodyText, frontmatter } = MarkdownExtractor.extract(md);

      expect(frontmatter['title']).toBe('My Note');
      expect(frontmatter['tags']).toBe('typescript testing');
      expect(headingsText).toBe('Actual Heading');
      expect(bodyText).toContain('Body content');
      // Frontmatter should not appear in body
      expect(bodyText).not.toContain('My Note');
    });

    it('handles markdown without frontmatter', () => {
      const md = `# Title\n\nBody paragraph.`;
      const { headingsText, bodyText, frontmatter } = MarkdownExtractor.extract(md);

      expect(headingsText).toBe('Title');
      expect(bodyText).toContain('Body paragraph');
      expect(frontmatter).toEqual({});
    });

    it('strips markdown syntax from body text', () => {
      const md = `**Bold text** and _italic text_ and \`inline code\`.

[Link text](https://example.com) and ![Image alt](image.png).

> Blockquote content.

- List item one
- List item two`;

      const { bodyText } = MarkdownExtractor.extract(md);

      expect(bodyText).toContain('Bold text');
      expect(bodyText).toContain('italic text');
      expect(bodyText).toContain('Blockquote content');
      expect(bodyText).toContain('List item one');
      // Raw markdown syntax should be stripped
      expect(bodyText).not.toContain('**');
      expect(bodyText).not.toContain('_italic_');
      expect(bodyText).not.toContain('https://example.com');
      expect(bodyText).not.toContain('image.png');
    });

    it('strips fenced code blocks from body', () => {
      const md = `Some prose before.

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

Some prose after.`;

      const { bodyText } = MarkdownExtractor.extract(md);

      expect(bodyText).toContain('Some prose before');
      expect(bodyText).toContain('Some prose after');
      expect(bodyText).not.toContain('const x = 1');
    });

    it('handles wiki links by keeping the link target text', () => {
      const md = `See [[My Other Note]] and [[Note With Alias|Display Text]].`;
      const { bodyText } = MarkdownExtractor.extract(md);

      expect(bodyText).toContain('My Other Note');
    });

    it('does not fail on unclosed frontmatter delimiter', () => {
      const md = `---
title: Broken
# Not closed frontmatter

Body content.`;
      const result = MarkdownExtractor.extract(md);
      // Should not throw; treat whole file as body
      expect(result).toBeDefined();
    });

    it('handles multiline frontmatter list values', () => {
      const md = `---
title: A Note
tags:
  - tag1
  - tag2
  - tag3
---

Body.`;
      const { frontmatter } = MarkdownExtractor.extract(md);

      expect(frontmatter['title']).toBe('A Note');
      expect(frontmatter['tags']).toBe('tag1 tag2 tag3');
    });

    it('separates multiple heading levels correctly', () => {
      const md = `# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n\nBody.`;
      const { headingsText } = MarkdownExtractor.extract(md);

      expect(headingsText).toContain('H1');
      expect(headingsText).toContain('H2');
      expect(headingsText).toContain('H6');
    });
  });

  describe('frontmatterToSearchText', () => {
    it('returns empty string for empty frontmatter', () => {
      expect(MarkdownExtractor.frontmatterToSearchText({})).toBe('');
    });

    it('joins values with spaces', () => {
      const fm = { title: 'My Title', author: 'John Doe', status: 'published' };
      const result = MarkdownExtractor.frontmatterToSearchText(fm);

      expect(result).toContain('My Title');
      expect(result).toContain('John Doe');
      expect(result).toContain('published');
    });

    it('skips keys starting with underscore', () => {
      const fm = { _internal: 'hidden', title: 'visible' };
      const result = MarkdownExtractor.frontmatterToSearchText(fm);

      expect(result).not.toContain('hidden');
      expect(result).toContain('visible');
    });

    it('truncates long frontmatter to 10000 chars', () => {
      const longValue = 'x'.repeat(15_000);
      const fm = { content: longValue };
      const result = MarkdownExtractor.frontmatterToSearchText(fm);

      expect(result.length).toBeLessThanOrEqual(10_000);
    });
  });
});
