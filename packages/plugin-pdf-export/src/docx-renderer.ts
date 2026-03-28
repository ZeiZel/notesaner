/**
 * docx-renderer — Convert note content to DOCX XML format.
 *
 * Builds a minimal but complete OOXML package (docx) from markdown content.
 * No heavy external library — we generate the XML directly following the
 * Office Open XML standard for word-processing documents.
 *
 * The output is a zip-like structure represented as a flat object:
 *   { 'word/document.xml': '...xml...', '[Content_Types].xml': '...', ... }
 *
 * The caller (BatchExportPanel / zip-utils) assembles this into an actual .docx
 * (which is a zip file with the above entries).
 *
 * Supported markdown elements:
 *   - Headings (h1–h6) → Heading1–Heading6 styles
 *   - Paragraphs → Normal style
 *   - Bold, italic, bold-italic, strikethrough, underline inline runs
 *   - Inline code → Code Character style
 *   - Fenced code blocks → Code Block style
 *   - Unordered lists (single level) → List Bullet style
 *   - Ordered lists (single level)   → List Number style
 *   - Horizontal rule → separator paragraph
 *   - Blockquote → Quote style
 *   - Tables → OOXML table with header row
 *   - Images → placeholder alt-text paragraph (base64 embeds not yet supported)
 *   - Math blocks → placeholder paragraph
 *   - Hard line breaks (two trailing spaces or \n in same paragraph)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map of DOCX entry path → XML/binary content string. */
export type DocxEntries = Record<string, string>;

/** Options for DOCX rendering. */
export interface DocxRenderOptions {
  /** Raw markdown content. */
  markdown: string;
  /** Note title (used as the first heading). */
  title?: string;
  /** Author name for document properties. */
  author?: string;
  /** Base font size in half-points (e.g. 24 = 12pt). */
  halfPointFontSize?: number;
  /** Font family for body text. */
  fontFamily?: string;
  /** Whether to include a table of contents placeholder. */
  includeToc?: boolean;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapRpr(props: string): string {
  return props ? `<w:rPr>${props}</w:rPr>` : '';
}

function makeRun(text: string, props: string = ''): string {
  const rpr = wrapRpr(props);
  return `<w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function makeParagraph(content: string, styleId = 'Normal', extraPpr = ''): string {
  const ppr = `<w:pPr><w:pStyle w:val="${styleId}"/>${extraPpr}</w:pPr>`;
  return `<w:p>${ppr}${content}</w:p>`;
}

function makeHyperlinkRun(text: string, url: string): string {
  // Note: actual hyperlink requires relationship entry; here we render as underlined text
  // to keep the renderer self-contained.
  const props = '<w:u w:val="single"/><w:color w:val="0563C1"/>';
  return `<w:r>${wrapRpr(props)}<w:t xml:space="preserve">${xmlEscape(text)} (${xmlEscape(url)})</w:t></w:r>`;
}

// ---------------------------------------------------------------------------
// Inline markdown parser
// ---------------------------------------------------------------------------

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  link?: string; // URL for hyperlinks
  isImage?: boolean;
  imageAlt?: string;
}

function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];

  // We process the text in a single pass using a stack of active decorations.
  // Supported patterns (in order of precedence):
  //   ![alt](url)  — image
  //   [text](url)  — link
  //   `code`       — inline code
  //   ***text***   — bold italic
  //   **text**     — bold
  //   *text*       — italic
  //   ~~text~~     — strikethrough
  //   __text__     — underline (DOCX convention)

  const patterns: Array<{
    re: RegExp;
    type: Exclude<keyof InlineSegment, 'text'>;
    group?: number;
    extra?: Partial<InlineSegment>;
  }> = [
    // Images — emit as [Image: alt] run
    {
      re: /!\[([^\]]*)\]\([^)]+\)/,
      type: 'isImage',
      extra: {},
    },
    // Links
    { re: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link', group: 1, extra: {} },
    // Inline code
    { re: /`([^`]+)`/, type: 'code', group: 1 },
    // Bold italic
    { re: /\*\*\*(.+?)\*\*\*/, type: 'bold', group: 1, extra: { italic: true } },
    // Bold
    { re: /\*\*(.+?)\*\*/, type: 'bold', group: 1 },
    // Italic
    { re: /\*(.+?)\*/, type: 'italic', group: 1 },
    // Strikethrough
    { re: /~~(.+?)~~/, type: 'strikethrough', group: 1 },
    // Underline (__text__)
    { re: /__(.+?)__/, type: 'underline', group: 1 },
  ];

  let remaining = text;

  while (remaining.length > 0) {
    let earliest: { index: number; length: number; seg: InlineSegment } | null = null;

    for (const pat of patterns) {
      const match = pat.re.exec(remaining);
      if (!match) continue;

      const idx = match.index;
      if (earliest === null || idx < earliest.index) {
        let seg: InlineSegment;

        if (pat.type === 'isImage') {
          const altMatch = /!\[([^\]]*)\]/.exec(match[0]);
          seg = { text: `[Image: ${altMatch?.[1] ?? ''}]`, isImage: true };
        } else if (pat.type === 'link') {
          const urlMatch = /\]\(([^)]+)\)$/.exec(match[0]);
          seg = {
            text: pat.group ? (match[pat.group] ?? '') : match[0],
            link: urlMatch?.[1] ?? '',
            ...pat.extra,
          };
        } else {
          seg = {
            text: pat.group ? (match[pat.group] ?? '') : match[0],
            [pat.type]: true,
            ...pat.extra,
          };
        }

        earliest = { index: idx, length: match[0].length, seg };
      }
    }

    if (!earliest) {
      // No more matches — rest is plain text
      if (remaining) segments.push({ text: remaining });
      break;
    }

    // Text before the match
    if (earliest.index > 0) {
      segments.push({ text: remaining.slice(0, earliest.index) });
    }

    segments.push(earliest.seg);
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return segments;
}

function segmentToXml(seg: InlineSegment): string {
  if (seg.link) {
    return makeHyperlinkRun(seg.text, seg.link);
  }

  const props: string[] = [];
  if (seg.code) props.push('<w:rStyle w:val="CodeChar"/>');
  if (seg.bold) props.push('<w:b/><w:bCs/>');
  if (seg.italic) props.push('<w:i/><w:iCs/>');
  if (seg.strikethrough) props.push('<w:strike/>');
  if (seg.underline) props.push('<w:u w:val="single"/>');
  if (seg.isImage) props.push('<w:color w:val="666666"/>');

  return makeRun(seg.text, props.join(''));
}

function renderInlineMarkdown(text: string): string {
  const segs = parseInlineSegments(text);
  return segs.map(segmentToXml).join('');
}

// ---------------------------------------------------------------------------
// Block-level markdown parser
// ---------------------------------------------------------------------------

type BlockNode =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul-item'; text: string }
  | { type: 'ol-item'; text: string; num: number }
  | { type: 'hr' }
  | { type: 'math'; content: string }
  | { type: 'table'; header: string[]; alignments: string[]; rows: string[][] }
  | { type: 'toc-placeholder' };

function parseMarkdownBlocks(content: string): BlockNode[] {
  const lines = content.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  let inFence = false;
  let fenceChar = '';
  let fenceLang = '';
  let fenceLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    const fenceMatch = /^(`{3,}|~{3,})(\w*)/.exec(line);
    if (!inFence && fenceMatch) {
      inFence = true;
      fenceChar = fenceMatch[1][0];
      fenceLang = fenceMatch[2] || '';
      fenceLines = [];
      i++;
      continue;
    }
    if (inFence) {
      if (line.startsWith(fenceChar.repeat(3))) {
        blocks.push({ type: 'code', lang: fenceLang, lines: fenceLines });
        inFence = false;
        fenceChar = '';
        fenceLang = '';
        fenceLines = [];
      } else {
        fenceLines.push(line);
      }
      i++;
      continue;
    }

    // Math blocks
    if (line.trim() === '$$') {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'math', content: mathLines.join('\n') });
      continue;
    }

    // ATX headings
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ') || line === '>') {
      const quoteLines: string[] = [line.startsWith('> ') ? line.slice(2) : ''];
      while (i + 1 < lines.length && (lines[i + 1].startsWith('> ') || lines[i + 1] === '>')) {
        i++;
        quoteLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      i++;
      continue;
    }

    // Table (detect by | character in first two lines)
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[-:| ]+\|?\s*$/.test(lines[i + 1])) {
      const header = parseTableRow(line);
      i++; // skip separator
      const alignLine = lines[i];
      const alignments = parseTableAlignments(alignLine);
      i++;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, alignments, rows });
      continue;
    }

    // Unordered list
    const ulMatch = /^\s*([-*+])\s+(.*)$/.exec(line);
    if (ulMatch) {
      blocks.push({ type: 'ul-item', text: ulMatch[2] });
      i++;
      continue;
    }

    // Ordered list
    const olMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (olMatch) {
      blocks.push({ type: 'ol-item', text: olMatch[2], num: parseInt(olMatch[1], 10) });
      i++;
      continue;
    }

    // Blank line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — accumulate lines
    const paraLines: string[] = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !/^(#{1,6}\s|`{3}|~{3}|> |-{3,}|\*{3,}|_{3,}|\s*[-*+]\s|\d+\.\s|\$\$)/.test(lines[i + 1])
    ) {
      i++;
      paraLines.push(lines[i]);
    }
    blocks.push({ type: 'paragraph', lines: paraLines });
    i++;
  }

  return blocks;
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
}

function parseTableAlignments(line: string): string[] {
  return parseTableRow(line).map((cell) => {
    if (/^:-+:$/.test(cell)) return 'center';
    if (/^-+:$/.test(cell)) return 'right';
    return 'left';
  });
}

// ---------------------------------------------------------------------------
// Block → OOXML
// ---------------------------------------------------------------------------

const HEADING_STYLE_MAP: Record<number, string> = {
  1: 'Heading1',
  2: 'Heading2',
  3: 'Heading3',
  4: 'Heading4',
  5: 'Heading5',
  6: 'Heading6',
};

function blockToXml(block: BlockNode): string {
  switch (block.type) {
    case 'heading': {
      const style = HEADING_STYLE_MAP[block.level] ?? 'Heading1';
      return makeParagraph(renderInlineMarkdown(block.text), style);
    }

    case 'paragraph': {
      const content = block.lines.join(' ');
      return makeParagraph(renderInlineMarkdown(content));
    }

    case 'code': {
      const runs = block.lines
        .map((line) => makeRun(line, '<w:rStyle w:val="CodeChar"/>'))
        .join('<w:r><w:br/></w:r>');
      return makeParagraph(runs, 'CodeBlock');
    }

    case 'blockquote': {
      return block.lines
        .filter((l) => l.trim())
        .map((l) => makeParagraph(renderInlineMarkdown(l), 'Quote'))
        .join('\n');
    }

    case 'ul-item': {
      return makeParagraph(renderInlineMarkdown(block.text), 'ListBullet');
    }

    case 'ol-item': {
      return makeParagraph(renderInlineMarkdown(block.text), 'ListNumber');
    }

    case 'hr': {
      const pBdrBottom =
        '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D0D0D0"/></w:pBdr>';
      return makeParagraph('', 'Normal', pBdrBottom);
    }

    case 'math': {
      const run = makeRun(`[Math: ${block.content}]`, '<w:i/><w:color w:val="555555"/>');
      return makeParagraph(run, 'Normal');
    }

    case 'table': {
      return renderTable(block.header, block.alignments, block.rows);
    }

    case 'toc-placeholder': {
      return makeParagraph(makeRun('[Table of Contents]', '<w:b/>'), 'TOCHeading');
    }

    default:
      return '';
  }
}

function renderTable(header: string[], alignments: string[], rows: string[][]): string {
  const allRows = [header, ...rows];
  const xmlRows = allRows.map((row, rowIdx) => {
    const cells = row.map((cell, colIdx) => {
      const jc = alignments[colIdx] ?? 'left';
      const tcPr = `<w:tcPr><w:jc w:val="${jc}"/></w:tcPr>`;
      const cellContent =
        rowIdx === 0
          ? makeParagraph(makeRun(cell, '<w:b/>'), 'TableHeader')
          : makeParagraph(renderInlineMarkdown(cell), 'TableContents');
      return `<w:tc>${tcPr}${cellContent}</w:tc>`;
    });
    const trPr = rowIdx === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
    return `<w:tr>${trPr}${cells.join('')}</w:tr>`;
  });

  const tblPr = `
    <w:tblPr>
      <w:tblStyle w:val="TableGrid"/>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:left w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:bottom w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:right w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:insideH w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:insideV w:val="single" w:sz="4" w:color="D0D0D0"/>
      </w:tblBorders>
    </w:tblPr>`;

  return `<w:tbl>${tblPr}${xmlRows.join('\n')}</w:tbl>`;
}

// ---------------------------------------------------------------------------
// DOCX XML file generators
// ---------------------------------------------------------------------------

function generateDocumentXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:oel="http://schemas.microsoft.com/office/2019/extlst"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"
  xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 w16se w16cid wp14">
  <w:body>
${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function generateStylesXml(fontFamily: string, halfPointFontSize: number): string {
  const font = fontFamily || 'Calibri';
  const sz = halfPointFontSize || 24; // 24 half-points = 12pt

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${xmlEscape(font)}" w:hAnsi="${xmlEscape(font)}"/>
        <w:sz w:val="${sz}"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>

  <!-- Normal -->
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>

  <!-- Heading 1–6 -->
  ${[1, 2, 3, 4, 5, 6]
    .map(
      (n) => `
  <w:style w:type="paragraph" w:styleId="Heading${n}">
    <w:name w:val="heading ${n}"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="${360 - n * 20}" w:after="160"/>
      <w:outlineLvl w:val="${n - 1}"/>
    </w:pPr>
    <w:rPr>
      <w:b/><w:bCs/>
      <w:sz w:val="${Math.max(sz + 20 - n * 4, 20)}"/>
      <w:color w:val="${n <= 2 ? '1a1a1a' : '2a2a2a'}"/>
    </w:rPr>
  </w:style>`,
    )
    .join('')}

  <!-- Quote -->
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="720"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:rPr>
      <w:i/><w:iCs/>
      <w:color w:val="555555"/>
    </w:rPr>
  </w:style>

  <!-- Code Block -->
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>
      <w:ind w:left="360" w:right="360"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:sz w:val="${Math.max(sz - 4, 16)}"/>
    </w:rPr>
  </w:style>

  <!-- Code Character -->
  <w:style w:type="character" w:styleId="CodeChar">
    <w:name w:val="Code Character"/>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:sz w:val="${Math.max(sz - 4, 16)}"/>
      <w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>
    </w:rPr>
  </w:style>

  <!-- List Bullet -->
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
      <w:ind w:left="720" w:hanging="360"/>
    </w:pPr>
  </w:style>

  <!-- List Number -->
  <w:style w:type="paragraph" w:styleId="ListNumber">
    <w:name w:val="List Number"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>
      <w:ind w:left="720" w:hanging="360"/>
    </w:pPr>
  </w:style>

  <!-- Table Grid -->
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:left w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:bottom w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:right w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:insideH w:val="single" w:sz="4" w:color="D0D0D0"/>
        <w:insideV w:val="single" w:sz="4" w:color="D0D0D0"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>

  <!-- Table Header -->
  <w:style w:type="paragraph" w:styleId="TableHeader">
    <w:name w:val="Table Header"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:bCs/></w:rPr>
  </w:style>

  <!-- Table Contents -->
  <w:style w:type="paragraph" w:styleId="TableContents">
    <w:name w:val="Table Contents"/>
    <w:basedOn w:val="Normal"/>
  </w:style>

  <!-- TOC Heading -->
  <w:style w:type="paragraph" w:styleId="TOCHeading">
    <w:name w:val="TOC Heading"/>
    <w:basedOn w:val="Heading1"/>
  </w:style>
</w:styles>`;
}

function generateNumberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:nsid w:val="00AB1234"/>
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#x2022;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:nsid w:val="00AB5678"/>
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;
}

function generateRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
    Target="numbering.xml"/>
</Relationships>`;
}

function generateRootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;
}

function generateContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;
}

function generateCorePropertiesXml(author: string, title: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(title)}</dc:title>
  <dc:creator>${xmlEscape(author)}</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a note to DOCX entry map.
 *
 * Returns a flat object mapping DOCX entry paths to their XML/string content.
 * Pass this to `createDocxBlob()` or `zipUtils.createZipBlob()` to produce a
 * binary .docx file.
 *
 * @param options  Rendering options
 * @returns        Map of OOXML entry path → content
 */
export function renderToDocx(options: DocxRenderOptions): DocxEntries {
  const {
    markdown,
    title = 'Untitled Note',
    author = 'Notesaner',
    halfPointFontSize = 24,
    fontFamily = 'Calibri',
    includeToc = false,
  } = options;

  // Parse markdown into blocks
  const blocks = parseMarkdownBlocks(markdown);

  // Add title block at the start
  const allBlocks: BlockNode[] = [
    { type: 'heading', level: 1, text: title },
    ...(includeToc ? [{ type: 'toc-placeholder' as const }] : []),
    ...blocks,
  ];

  // Convert blocks to OOXML
  const bodyXml = allBlocks.map(blockToXml).join('\n');

  const documentXml = generateDocumentXml(bodyXml);
  const stylesXml = generateStylesXml(fontFamily, halfPointFontSize);
  const numberingXml = generateNumberingXml();
  const contentTypesXml = generateContentTypesXml();
  const rootRelsXml = generateRootRelationshipsXml();
  const wordRelsXml = generateRelationshipsXml();
  const corePropsXml = generateCorePropertiesXml(author, title);

  return {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': rootRelsXml,
    'word/document.xml': documentXml,
    'word/styles.xml': stylesXml,
    'word/numbering.xml': numberingXml,
    'word/_rels/document.xml.rels': wordRelsXml,
    'docProps/core.xml': corePropsXml,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for testing
// ---------------------------------------------------------------------------

export {
  parseMarkdownBlocks,
  parseInlineSegments,
  renderInlineMarkdown,
  renderTable,
  type BlockNode,
  type InlineSegment,
};
