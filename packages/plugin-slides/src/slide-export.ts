/**
 * HTML export for Notesaner Slides presentations.
 *
 * Generates a fully self-contained HTML file — no external CDN or network
 * requests needed — so the export can be opened offline and shared as a
 * single file.
 *
 * Features:
 * - All CSS embedded inline (theme variables + presentation layout)
 * - Markdown converted to HTML (basic implementation, no external deps)
 * - Keyboard navigation (ArrowLeft / ArrowRight / Escape / F)
 * - Slide counter display
 * - Speaker notes section (hidden by default, toggle with `N`)
 * - Configurable transition style (fade | slide | none)
 */

import type { Slide, PresentationFrontmatter } from './slide-parser';
import type { SlideTheme } from './slide-themes';
import { getTheme, themeVarsToStyle } from './slide-themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** Slides to include in the export. */
  slides: Slide[];
  /** Presentation metadata (title, theme, transition). */
  frontmatter: PresentationFrontmatter;
  /** Override the theme used for export (defaults to frontmatter theme or default). */
  themeId?: string;
  /** Whether to include speaker notes in the exported HTML. Default: true. */
  includeSpeakerNotes?: boolean;
}

// ---------------------------------------------------------------------------
// Minimal markdown-to-HTML renderer
// ---------------------------------------------------------------------------

/**
 * Converts a small subset of markdown to HTML suitable for slide content.
 *
 * Supported:
 * - H1–H6 headings
 * - Bold (`**text**`) and italic (`*text*`)
 * - Inline code (`` `code` ``)
 * - Fenced code blocks (``` ``` ```)
 * - Unordered lists (`- item`)
 * - Ordered lists (`1. item`)
 * - Blockquotes (`> text`)
 * - Horizontal rules (`---`) — converted to `<hr>`
 * - Paragraphs (blank-line separated)
 * - Line breaks within paragraphs
 */
function markdownToHtml(md: string): string {
  if (!md.trim()) return '';

  // Escape HTML entities first to prevent injection
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Process fenced code blocks first (before inline transforms)
  const result = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return `<pre><code${langAttr}>${escapeHtml(code.trimEnd())}</code></pre>`;
  });

  // Split into blocks (paragraphs, headings, lists, blockquotes, hr)
  const blocks = result.split(/\n{2,}/);
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Already processed code block
    if (trimmed.startsWith('<pre>')) {
      htmlBlocks.push(trimmed);
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      htmlBlocks.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      htmlBlocks.push('<hr>');
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteContent = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n');
      htmlBlocks.push(`<blockquote>${inlineMarkdown(quoteContent)}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^[-*+]\s/.test(l))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^[-*+]\s+/, ''))}</li>`)
        .join('');
      htmlBlocks.push(`<ul>${items}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^\d+\.\s/.test(l))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^\d+\.\s+/, ''))}</li>`)
        .join('');
      htmlBlocks.push(`<ol>${items}</ol>`);
      continue;
    }

    // Paragraph (default)
    const paragraphHtml = trimmed
      .split('\n')
      .map((l) => inlineMarkdown(l))
      .join('<br>');
    htmlBlocks.push(`<p>${paragraphHtml}</p>`);
  }

  return htmlBlocks.join('\n');
}

/** Applies inline markdown transforms (bold, italic, code, links). */
function inlineMarkdown(text: string): string {
  function escapeHtml(t: string): string {
    return t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Bold+italic
  let result = escapeHtml(text);
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  return result;
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

function buildPresentationCss(theme: SlideTheme, transition: string): string {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

.presentation {
  ${themeVarsToStyle(theme)};
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--slide-bg);
  font-family: var(--slide-font-body);
  font-size: var(--slide-font-size);
  color: var(--slide-text);
  position: relative;
}

.slides-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 4rem 6rem;
  opacity: 0;
  pointer-events: none;
  transition: ${transition === 'fade' ? 'opacity 0.4s ease' : transition === 'slide' ? 'opacity 0.2s ease, transform 0.4s ease' : 'none'};
  ${transition === 'slide' ? 'transform: translateX(100%);' : ''}
}

.slide.active {
  opacity: 1;
  pointer-events: auto;
  ${transition === 'slide' ? 'transform: translateX(0);' : ''}
}

.slide.prev {
  ${transition === 'slide' ? 'opacity: 0; transform: translateX(-100%);' : 'opacity: 0;'}
}

.slide-content {
  width: 100%;
  max-width: 100%;
}

.slide-content h1 {
  font-family: var(--slide-font-heading);
  font-size: 3em;
  font-weight: 700;
  color: var(--slide-heading);
  line-height: 1.15;
  margin-bottom: 0.5em;
}

.slide-content h2 {
  font-family: var(--slide-font-heading);
  font-size: 2.2em;
  font-weight: 600;
  color: var(--slide-heading);
  line-height: 1.2;
  margin-bottom: 0.4em;
}

.slide-content h3 {
  font-family: var(--slide-font-heading);
  font-size: 1.6em;
  font-weight: 600;
  color: var(--slide-heading);
  line-height: 1.25;
  margin-bottom: 0.4em;
}

.slide-content h4, .slide-content h5, .slide-content h6 {
  font-family: var(--slide-font-heading);
  font-size: 1.2em;
  font-weight: 600;
  color: var(--slide-heading);
  margin-bottom: 0.3em;
}

.slide-content p {
  line-height: 1.7;
  margin-bottom: 0.8em;
}

.slide-content ul, .slide-content ol {
  padding-left: 1.5em;
  line-height: 1.8;
  margin-bottom: 0.8em;
}

.slide-content li {
  margin-bottom: 0.2em;
}

.slide-content code {
  font-family: 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 0.88em;
  background: var(--slide-code-bg);
  color: var(--slide-code-text);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.slide-content pre {
  background: var(--slide-code-bg);
  color: var(--slide-code-text);
  border-radius: var(--slide-radius);
  padding: 1.2em 1.5em;
  overflow-x: auto;
  font-size: 0.85em;
  margin-bottom: 0.8em;
  line-height: 1.5;
}

.slide-content pre code {
  background: none;
  padding: 0;
  font-size: inherit;
}

.slide-content blockquote {
  border-left: 4px solid var(--slide-quote);
  padding-left: 1em;
  margin: 0.5em 0 0.8em;
  color: var(--slide-quote);
  font-style: italic;
}

.slide-content a {
  color: var(--slide-accent);
  text-decoration: underline;
}

.slide-content table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.8em;
  font-size: 0.92em;
}

.slide-content th {
  background: var(--slide-table-header-bg);
  color: var(--slide-table-header-text);
  padding: 0.5em 0.75em;
  text-align: left;
  font-weight: 600;
}

.slide-content tr:nth-child(even) td {
  background: var(--slide-table-alt-row);
}

.slide-content td {
  padding: 0.45em 0.75em;
  border-bottom: 1px solid var(--slide-table-alt-row);
}

.slide-counter {
  position: absolute;
  bottom: 1.2rem;
  right: 1.5rem;
  font-size: 0.85em;
  color: var(--slide-indicator);
  font-family: var(--slide-font-body);
  user-select: none;
  z-index: 10;
}

.nav-hint {
  position: absolute;
  bottom: 1.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75em;
  color: var(--slide-indicator);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  user-select: none;
}

.presentation:hover .nav-hint {
  opacity: 1;
}

.speaker-notes {
  background: var(--slide-notes-bg);
  color: var(--slide-notes-text);
  font-family: var(--slide-font-body);
  font-size: 0.95em;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--slide-indicator);
  max-height: 20vh;
  overflow-y: auto;
  display: none;
}

.speaker-notes.visible {
  display: block;
}

.speaker-notes-label {
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-bottom: 0.3em;
}

.progress-bar {
  height: 3px;
  background: var(--slide-accent);
  transition: width 0.3s ease;
  position: absolute;
  bottom: 0;
  left: 0;
}
`.trim();
}

// ---------------------------------------------------------------------------
// JS generation
// ---------------------------------------------------------------------------

function buildPresentationJs(totalSlides: number): string {
  return `
(function() {
  var current = 0;
  var total = ${totalSlides};
  var notesVisible = false;

  var slides = document.querySelectorAll('.slide');
  var counter = document.querySelector('.slide-counter');
  var notes = document.querySelector('.speaker-notes');
  var progressBar = document.querySelector('.progress-bar');

  function show(index) {
    if (index < 0 || index >= total) return;
    slides.forEach(function(s, i) {
      s.classList.remove('active', 'prev');
      if (i === index) s.classList.add('active');
      if (i < index) s.classList.add('prev');
    });
    current = index;
    if (counter) counter.textContent = (current + 1) + ' / ' + total;
    if (progressBar) progressBar.style.width = ((current + 1) / total * 100) + '%';
    // Update speaker notes
    updateNotes();
  }

  function updateNotes() {
    if (!notes) return;
    var activeSlide = slides[current];
    var notesEl = activeSlide && activeSlide.querySelector('[data-notes]');
    notes.querySelector && (notes.querySelector('.speaker-notes-content').textContent = notesEl ? notesEl.getAttribute('data-notes') : '');
  }

  document.addEventListener('keydown', function(e) {
    switch(e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault();
        show(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        show(current - 1);
        break;
      case 'Escape':
        // No-op in exported HTML (no fullscreen API control)
        break;
      case 'f':
      case 'F':
        if (document.fullscreenElement) {
          document.exitFullscreen && document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        }
        break;
      case 'n':
      case 'N':
        notesVisible = !notesVisible;
        if (notes) {
          notes.classList.toggle('visible', notesVisible);
        }
        break;
    }
  });

  // Touch/swipe support
  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      show(dx < 0 ? current + 1 : current - 1);
    }
  }, { passive: true });

  // Click navigation
  document.addEventListener('click', function(e) {
    var x = e.clientX / window.innerWidth;
    if (x > 0.6) show(current + 1);
    else if (x < 0.4) show(current - 1);
  });

  // Init
  show(0);
})();
`.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a self-contained HTML presentation file from the given slides.
 *
 * The returned string is valid HTML5 that can be written to a `.html` file
 * and opened directly in any modern browser.
 *
 * @param options  Export configuration.
 * @returns        Self-contained HTML string.
 */
export function exportToHtml(options: ExportOptions): string {
  const { slides, frontmatter, themeId, includeSpeakerNotes = true } = options;

  const resolvedThemeId = themeId ?? frontmatter.theme ?? 'default';
  const theme = getTheme(resolvedThemeId);
  const transition = frontmatter.transition ?? 'fade';
  const title = frontmatter.title || 'Presentation';

  const css = buildPresentationCss(theme, transition);

  // Build slide HTML
  const slidesHtml = slides
    .map((slide, i) => {
      const contentHtml = markdownToHtml(slide.content);
      const notesAttr = slide.speakerNotes
        ? ` data-notes="${slide.speakerNotes.replace(/"/g, '&quot;')}"`
        : '';
      const activeClass = i === 0 ? ' active' : '';
      return `    <div class="slide${activeClass}" id="slide-${i}" aria-label="Slide ${i + 1} of ${slides.length}">\n      <div class="slide-content"${notesAttr}>${contentHtml}</div>\n    </div>`;
    })
    .join('\n');

  // Build speaker notes HTML (shown for current slide via JS)
  const speakerNotesHtml = includeSpeakerNotes
    ? `\n  <div class="speaker-notes" role="complementary" aria-label="Speaker notes">\n    <div class="speaker-notes-label">Speaker Notes</div>\n    <div class="speaker-notes-content"></div>\n  </div>`
    : '';

  const js = buildPresentationJs(slides.length);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Notesaner Slides">
  <title>${escapeHtmlAttr(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <div class="presentation" role="main">
    <div class="slides-container">
${slidesHtml}
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div>
    </div>
    <div class="slide-counter" aria-live="polite">1 / ${slides.length}</div>
    <div class="nav-hint">← → to navigate &nbsp;|&nbsp; F for fullscreen &nbsp;|&nbsp; N for notes</div>${speakerNotesHtml}
  </div>
  <script>
${js}
  </script>
</body>
</html>`;
}

/**
 * Returns the recommended filename for an exported presentation.
 *
 * @param title  Presentation title from frontmatter.
 */
export function getExportFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return sanitized ? `${sanitized}-presentation.html` : 'presentation.html';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
