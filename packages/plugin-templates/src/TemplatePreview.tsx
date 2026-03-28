/**
 * TemplatePreview component.
 *
 * Renders a live preview of a template with variable substitution applied.
 * Used inside the TemplatePicker's preview pane.
 *
 * The preview uses a monospace code block styled with Tailwind classes to
 * distinguish it from regular note content.
 */

import { useMemo } from 'react';
import type { TemplateEntry } from './template-store';
import type { CustomVariableValues } from './template-store';
import { renderTemplate } from './template-engine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplatePreviewProps {
  /** The template to preview. */
  template: TemplateEntry;
  /** Current custom variable values entered by the user. */
  variables: CustomVariableValues;
  /** Author name for {{author}} substitution. */
  author?: string;
  /** Note title for {{title}} substitution. */
  noteTitle?: string;
  /** Maximum number of characters to render before truncating. Default 2000. */
  maxLength?: number;
  /** Additional CSS classes. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePreview({
  template,
  variables,
  author = '',
  noteTitle = '',
  maxLength = 2000,
  className = '',
}: TemplatePreviewProps) {
  const rendered = useMemo(() => {
    const result = renderTemplate(template.body, {
      title: noteTitle || template.meta.name,
      author,
      variables,
    });
    return result.content;
  }, [template.body, template.meta.name, noteTitle, author, variables]);

  const truncated = rendered.length > maxLength;
  const displayContent = truncated ? rendered.slice(0, maxLength) + '\n\n...' : rendered;

  return (
    <div className={`template-preview flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Preview
        </span>
        {truncated && <span className="text-xs text-muted-foreground">(truncated)</span>}
      </div>
      <div
        className="relative overflow-auto rounded-md border bg-muted/30 p-4"
        style={{ maxHeight: '400px' }}
      >
        <pre
          className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
          aria-label="Template preview"
        >
          {displayContent}
        </pre>
      </div>
    </div>
  );
}
