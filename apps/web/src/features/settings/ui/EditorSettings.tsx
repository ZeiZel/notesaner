'use client';

/**
 * EditorSettings -- controls for editor typography and tab behaviour.
 *
 * Settings are persisted to localStorage via useSettingsStore.
 * All interactions are synchronous (no network calls) -- no useEffect needed.
 * Styled with Ant Design Select, Slider, Button, Segmented, Typography.
 */

import { Select, Slider, Typography, Segmented, Button, Divider } from 'antd';
import { Box } from '@/shared/ui';
import {
  useSettingsStore,
  FONT_FAMILY_LABELS,
  editorFontFamilyCss,
  type EditorFontFamily,
} from '../model/settings-store';

// ---------------------------------------------------------------------------
// Font preview
// ---------------------------------------------------------------------------

function FontPreview({
  fontFamily,
  fontSize,
  lineHeight,
}: {
  fontFamily: EditorFontFamily;
  fontSize: number;
  lineHeight: number;
}) {
  return (
    <Box
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background-surface)',
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Preview
      </Typography.Text>
      <Box
        style={{
          fontFamily: editorFontFamilyCss(fontFamily),
          fontSize: `${fontSize}px`,
          lineHeight,
          color: 'var(--ns-color-foreground)',
        }}
      >
        The quick brown fox jumps over the lazy dog. <strong>Bold text</strong> and{' '}
        <em>italic text</em> look like this. Here is some{' '}
        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.9em',
            backgroundColor: 'var(--ns-color-background-code)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          inline code
        </code>
        .
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// EditorSettings
// ---------------------------------------------------------------------------

const FONT_OPTIONS = (Object.entries(FONT_FAMILY_LABELS) as [EditorFontFamily, string][]).map(
  ([value, label]) => ({ value, label }),
);

export function EditorSettings() {
  const editor = useSettingsStore((s) => s.editor);
  const updateEditorSettings = useSettingsStore((s) => s.updateEditorSettings);
  const resetEditorSettings = useSettingsStore((s) => s.resetEditorSettings);

  return (
    <Box className="max-w-lg" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FontPreview
        fontFamily={editor.fontFamily}
        fontSize={editor.fontSize}
        lineHeight={editor.lineHeight}
      />

      {/* Font family */}
      <Box>
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Font family
        </Typography.Text>
        <Select
          value={editor.fontFamily}
          onChange={(fontFamily) => updateEditorSettings({ fontFamily })}
          options={FONT_OPTIONS}
          style={{ width: '100%' }}
        />
      </Box>

      {/* Font size */}
      <Box>
        <Box className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            Font size
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 14 }}>
            {editor.fontSize}px
          </Typography.Text>
        </Box>
        <Slider
          min={10}
          max={24}
          step={1}
          value={editor.fontSize}
          onChange={(fontSize) => updateEditorSettings({ fontSize })}
        />
      </Box>

      {/* Line height */}
      <Box>
        <Box className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            Line height
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 14 }}>
            {editor.lineHeight}
          </Typography.Text>
        </Box>
        <Slider
          min={1.2}
          max={2.5}
          step={0.1}
          value={editor.lineHeight}
          onChange={(lineHeight) =>
            updateEditorSettings({ lineHeight: Math.round(lineHeight * 10) / 10 })
          }
        />
      </Box>

      {/* Tab size */}
      <Box>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          Tab size
        </Typography.Text>
        <Segmented
          value={editor.tabSize}
          onChange={(size) => updateEditorSettings({ tabSize: size as number })}
          options={[
            { label: '2 spaces', value: 2 },
            { label: '4 spaces', value: 4 },
            { label: '8 spaces', value: 8 },
          ]}
          block
        />
      </Box>

      <Divider style={{ margin: '4px 0' }} />

      <Button
        type="link"
        size="small"
        onClick={resetEditorSettings}
        style={{ padding: 0, alignSelf: 'flex-start' }}
      >
        Reset to defaults
      </Button>
    </Box>
  );
}
