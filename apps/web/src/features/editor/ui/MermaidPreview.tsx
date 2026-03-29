'use client';

/**
 * MermaidPreview — Ant Design-styled toolbar button and insert menu for
 * Mermaid diagram blocks in the TipTap editor.
 *
 * This component does NOT duplicate the diagram rendering logic — that lives
 * in libs/editor-core/src/components/MermaidView.tsx. Instead, it provides:
 *
 * 1. A toolbar `<Button>` with a dropdown listing available diagram types.
 * 2. An insert handler that calls `editor.chain().insertMermaidBlock(...)`.
 * 3. An Ant Design `<Alert>` for cases where the mermaid extension is not
 *    registered in the editor (graceful degradation).
 * 4. An optional standalone preview panel (`<MermaidStandalonePreview>`)
 *    that renders a given Mermaid source string outside of TipTap — useful
 *    for read-only contexts such as note preview pages.
 *
 * Ant Design components used: Button, Dropdown, Alert, Card, Space, Typography.
 * No raw HTML block-level elements — layout is achieved via Box abstraction.
 *
 * @see libs/editor-core/src/extensions/mermaid-block.ts
 * @see apps/web/src/features/editor/lib/mermaid-extension.ts
 */

import { useCallback, useEffect, useRef, useState, useId } from 'react';
import { Alert, Button, Card, Dropdown, Space, Typography, type MenuProps } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import type { Editor } from '@tiptap/core';
import { cn } from '@notesaner/ui';
import { Box } from '@/shared/ui';
import {
  insertMermaidBlock,
  hasMermaidExtension,
  MERMAID_TOOLBAR_ITEMS,
  resolveMermaidTheme,
  detectDiagramType,
  type MermaidDiagramType,
  type MermaidTheme,
} from '../lib/mermaid-extension';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Minimal mermaid API type shim (matches editor-core's internal shim)
// ---------------------------------------------------------------------------

interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MermaidToolbarButtonProps {
  /**
   * The active TipTap editor instance. When `null` or when the mermaid
   * extension is not registered, the button is disabled.
   */
  editor: Editor | null;
  /**
   * Additional CSS class names for the container.
   */
  className?: string;
}

export interface MermaidStandalonePreviewProps {
  /**
   * Raw Mermaid diagram source code to render.
   */
  source: string;
  /**
   * Override the Mermaid theme. When omitted, the document theme is used.
   */
  theme?: MermaidTheme;
  /**
   * Additional CSS class names for the Card wrapper.
   */
  className?: string;
  /**
   * Optional title shown in the Card header.
   */
  title?: string;
}

// ---------------------------------------------------------------------------
// MermaidToolbarButton
// ---------------------------------------------------------------------------

/**
 * Toolbar button that opens a dropdown menu of Mermaid diagram types.
 * Selecting an item inserts a pre-filled Mermaid block at the cursor.
 *
 * Renders an Ant Design `<Button>` with `<Dropdown>` for the type menu.
 * Falls back to a disabled state when the editor or extension is unavailable.
 */
export function MermaidToolbarButton({ editor, className }: MermaidToolbarButtonProps) {
  const isExtensionActive = hasMermaidExtension(editor);
  const isEditorEditable = editor?.isEditable ?? false;
  const isDisabled = !isExtensionActive || !isEditorEditable;

  const handleInsert = useCallback(
    (diagramType: MermaidDiagramType) => {
      if (!editor || isDisabled) return;
      insertMermaidBlock(editor, diagramType);
    },
    [editor, isDisabled],
  );

  const menuItems: MenuProps['items'] = MERMAID_TOOLBAR_ITEMS.map((item) => ({
    key: item.diagramType,
    label: (
      <Box className="flex flex-col gap-0.5 py-0.5">
        <Text strong className="text-xs leading-none">
          {item.label}
        </Text>
        <Text type="secondary" className="text-[11px] leading-snug">
          {item.description}
        </Text>
      </Box>
    ),
    onClick: () => handleInsert(item.diagramType),
  }));

  return (
    <Box className={cn('inline-flex items-center', className)}>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        disabled={isDisabled}
        placement="bottomLeft"
      >
        <Button
          type="text"
          size="small"
          icon={<MermaidIcon />}
          disabled={isDisabled}
          title={isDisabled ? 'Mermaid extension not available' : 'Insert Mermaid diagram'}
          aria-label="Insert Mermaid diagram"
          className="flex items-center gap-1 font-medium"
        >
          <Space size={4}>
            Diagram
            <PlusOutlined style={{ fontSize: 10 }} />
          </Space>
        </Button>
      </Dropdown>
    </Box>
  );
}

MermaidToolbarButton.displayName = 'MermaidToolbarButton';

// ---------------------------------------------------------------------------
// MermaidExtensionWarning
// ---------------------------------------------------------------------------

/**
 * Alert shown when the mermaid extension is not registered in the editor.
 * Renders as an Ant Design warning `<Alert>`.
 */
export function MermaidExtensionWarning({ className }: { className?: string }) {
  return (
    <Alert
      type="warning"
      showIcon
      message="Mermaid extension not loaded"
      description="The mermaid extension is not registered in this editor instance. Diagram blocks will not render."
      className={className}
      closable
    />
  );
}

MermaidExtensionWarning.displayName = 'MermaidExtensionWarning';

// ---------------------------------------------------------------------------
// MermaidStandalonePreview
// ---------------------------------------------------------------------------

/**
 * Read-only Mermaid diagram preview panel rendered outside of TipTap.
 *
 * Useful for rendering Mermaid source code in contexts that don't use a
 * full TipTap editor (e.g., note reading mode, preview panels).
 *
 * Renders an Ant Design `<Card>` with:
 * - A diagram preview on the right (live-rendered via mermaid.js)
 * - A collapsible source code pane on the left
 * - Inline `<Alert>` for syntax errors
 *
 * The mermaid library is dynamically imported to avoid bundle-time cost.
 */
export function MermaidStandalonePreview({
  source,
  theme,
  className,
  title,
}: MermaidStandalonePreviewProps) {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [codeVisible, setCodeVisible] = useState<boolean>(false);
  const [mermaidApi, setMermaidApi] = useState<MermaidAPI | null>(null);
  const [mermaidLoadError, setMermaidLoadError] = useState<string | null>(null);

  const renderCountRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable unique ID for mermaid.render() calls.
  const diagramId = useId().replace(/:/g, '_');

  const resolvedTheme: MermaidTheme = theme ?? resolveMermaidTheme('default');
  const diagramTypeLabel = detectDiagramType(source) ?? 'mermaid';

  // -------------------------------------------------------------------------
  // Load mermaid dynamically (once per mount)
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadMermaid() {
      try {
        const mod = (await import('mermaid')) as { default: MermaidAPI };
        if (cancelled) return;

        const api = mod.default;
        api.initialize({
          startOnLoad: false,
          theme: resolvedTheme,
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        setMermaidApi(api);
      } catch (e) {
        if (!cancelled) {
          setMermaidLoadError(e instanceof Error ? e.message : 'Failed to load Mermaid library');
          setIsLoading(false);
        }
      }
    }

    void loadMermaid();
    return () => {
      cancelled = true;
    };
    // resolvedTheme intentionally excluded from the deps array — theme changes
    // are handled by re-calling api.initialize() inside renderDiagram, not
    // by re-loading the mermaid module.
  }, []);

  // -------------------------------------------------------------------------
  // Render diagram whenever mermaidApi or source changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!mermaidApi) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void renderDiagram(mermaidApi);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // renderDiagram is declared as a local function inside the component and
    // recreated on each render, so it's intentionally excluded from deps.
  }, [source, mermaidApi]);

  async function renderDiagram(api: MermaidAPI) {
    if (!source.trim()) {
      setSvgHtml('');
      setError(null);
      setIsLoading(false);
      return;
    }

    const thisRender = ++renderCountRef.current;
    setIsLoading(true);
    setError(null);

    try {
      api.initialize({
        startOnLoad: false,
        theme: resolvedTheme,
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });

      const { svg } = await api.render(`${diagramId}-${thisRender}`, source);

      if (thisRender !== renderCountRef.current) return;
      setSvgHtml(svg);
      setError(null);
    } catch (e) {
      if (thisRender !== renderCountRef.current) return;
      const msg =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Invalid Mermaid syntax';
      setError(msg.replace(/\x1b\[[0-9;]*m/g, '').trim());
      setSvgHtml('');
    } finally {
      if (thisRender === renderCountRef.current) {
        setIsLoading(false);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const cardTitle = (
    <Box className="flex items-center gap-2">
      <MermaidIcon />
      <Text className="text-xs font-semibold uppercase tracking-wide">
        {title ?? diagramTypeLabel}
      </Text>
      <Button
        type="text"
        size="small"
        onClick={() => setCodeVisible((v) => !v)}
        className="ml-auto text-[11px]"
        aria-label={codeVisible ? 'Hide source' : 'Show source'}
      >
        {codeVisible ? 'Hide source' : 'Show source'}
      </Button>
    </Box>
  );

  return (
    <Card
      size="small"
      title={cardTitle}
      className={cn('ns-mermaid-preview', className)}
      styles={{ body: { padding: 0 } }}
    >
      {/* Error: failed to load mermaid.js */}
      {mermaidLoadError && (
        <Box className="p-4">
          <Alert
            type="error"
            showIcon
            message="Mermaid library unavailable"
            description={mermaidLoadError}
          />
        </Box>
      )}

      {/* Split pane layout */}
      {!mermaidLoadError && (
        <Box className={cn('grid', codeVisible ? 'grid-cols-2' : 'grid-cols-1')}>
          {/* Source pane */}
          {codeVisible && (
            <Box
              className="overflow-auto border-r"
              style={{ borderColor: 'var(--ns-color-border)' }}
            >
              <Box
                as="pre"
                className="m-0 p-3 text-[12px] leading-relaxed"
                style={{
                  fontFamily: 'var(--ns-font-mono, ui-monospace, monospace)',
                  backgroundColor: 'var(--ns-color-background-surface, #f8fafc)',
                  color: 'var(--ns-color-foreground, #1e293b)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  minHeight: 160,
                  overflowX: 'auto',
                }}
              >
                <code>{source}</code>
              </Box>
            </Box>
          )}

          {/* Preview pane */}
          <Box
            className="relative flex min-h-[160px] items-center justify-center overflow-auto p-4"
            style={{ backgroundColor: 'var(--ns-color-background, #ffffff)' }}
          >
            {isLoading && !svgHtml && (
              <Box className="flex items-center gap-2 text-xs text-gray-400">
                <LoadingOutlined spin />
                Rendering diagram…
              </Box>
            )}

            {/* Syntax error */}
            {error && !isLoading && (
              <Box className="w-full">
                <Alert
                  type="error"
                  showIcon
                  message="Diagram syntax error"
                  description={
                    <Box
                      as="pre"
                      className="m-0 mt-1 max-h-24 overflow-auto text-[11px]"
                      style={{
                        fontFamily: 'var(--ns-font-mono, monospace)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {error}
                    </Box>
                  }
                />
              </Box>
            )}

            {/* Rendered SVG */}
            {svgHtml && !error && (
              <Box
                className="ns-mermaid-svg-container flex w-full justify-center"
                // SVG content is generated by Mermaid and is trusted output.
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            )}

            {/* Empty state */}
            {!svgHtml && !error && !isLoading && (
              <Text type="secondary" className="text-xs">
                {mermaidApi ? 'No diagram content' : 'Loading Mermaid…'}
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Card>
  );
}

MermaidStandalonePreview.displayName = 'MermaidStandalonePreview';

// ---------------------------------------------------------------------------
// Minimal inline SVG icon for the Mermaid brand mark
// ---------------------------------------------------------------------------

function MermaidIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Simplified flow-graph shape representing Mermaid */}
      <rect x="2" y="3" width="5" height="4" rx="1" />
      <rect x="17" y="3" width="5" height="4" rx="1" />
      <rect x="9.5" y="17" width="5" height="4" rx="1" />
      <line x1="7" y1="5" x2="17" y2="5" />
      <line x1="12" y1="5" x2="12" y2="17" />
    </svg>
  );
}
